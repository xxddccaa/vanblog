import axios from 'axios';
import { createHash } from 'crypto';
import { config } from 'src/config';
import { AiQaProvider } from './ai-qa.provider';

jest.mock('axios');
jest.mock('src/config', () => ({
  config: {
    fastgptInternalUrl: 'http://fastgpt-app:3000',
    fastgptRootPassword: 'change-me-now',
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AiQaProvider', () => {
  const originalFastgptRootPassword = config.fastgptRootPassword;

  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.request.mockReset();
    config.fastgptRootPassword = originalFastgptRootPassword;
  });

  const createSettingModel = () => ({
    findOne: jest.fn().mockReturnValue({
      lean: () => ({
        exec: jest.fn().mockResolvedValue(null),
      }),
    }),
    updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
  });

  const createProvider = (overrides: Record<string, any> = {}) => {
    const settingModel = createSettingModel();
    const structuredDataService = {
      getSetting: jest.fn().mockResolvedValue(null),
      upsertSetting: jest.fn().mockResolvedValue(undefined),
      getCategoriesByNames: jest.fn().mockResolvedValue([]),
      getCategoryByName: jest.fn().mockResolvedValue(null),
      listDocuments: jest.fn().mockResolvedValue([]),
      listAiQaConversations: jest.fn().mockResolvedValue({ total: 0, conversations: [] }),
      getAiQaConversation: jest.fn().mockResolvedValue(null),
      getAiQaConversationByChatId: jest.fn().mockResolvedValue(null),
      getAiQaConversationDetail: jest.fn().mockResolvedValue(null),
      createAiQaConversation: jest.fn().mockResolvedValue(undefined),
      updateAiQaConversation: jest.fn().mockResolvedValue(null),
      createAiQaMessages: jest.fn().mockResolvedValue(undefined),
      listAiQaMessages: jest.fn().mockResolvedValue([]),
      listAiKnowledgeSyncs: jest.fn().mockResolvedValue([]),
      getAiKnowledgeSync: jest.fn().mockResolvedValue(null),
      upsertAiKnowledgeSync: jest.fn().mockResolvedValue(undefined),
      markAiKnowledgeSyncDeleted: jest.fn().mockResolvedValue(undefined),
      listAiKnowledgeSyncsByCollectionIds: jest.fn().mockResolvedValue([]),
      getDocumentSubtree: jest.fn().mockResolvedValue([]),
      ...overrides.structuredDataService,
    };
    const articleProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      ...overrides.articleProvider,
    };
    const draftProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      ...overrides.draftProvider,
    };
    const documentProvider = {
      findById: jest.fn().mockResolvedValue(null),
      ...overrides.documentProvider,
    };
    const metaProvider = {
      getSiteInfo: jest.fn().mockResolvedValue({
        baseUrl: 'https://blog.example.com',
        siteName: 'VanBlog',
      }),
      ...overrides.metaProvider,
    };

    return {
      provider: new AiQaProvider(
        (overrides.settingModel || settingModel) as any,
        articleProvider as any,
        draftProvider as any,
        documentProvider as any,
        structuredDataService as any,
        metaProvider as any,
      ),
      settingModel: overrides.settingModel || settingModel,
      structuredDataService,
      articleProvider,
      draftProvider,
      documentProvider,
      metaProvider,
    };
  };

  it('masks stored api keys in config responses', async () => {
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
      },
    });

    await expect(provider.getConfig()).resolves.toMatchObject({
      enabled: true,
      datasetId: 'dataset-1',
      appId: 'app-1',
      apiKey: '********',
      apiKeyConfigured: true,
    });
  });

  it('preserves existing api keys when the UI submits the mask placeholder', async () => {
    const { provider, settingModel } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
      },
    });

    const result = await provider.updateConfig({
      enabled: true,
      datasetId: 'dataset-2',
      appId: 'app-2',
      apiKey: '********',
    } as any);

    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { type: 'aiQa' },
      expect.objectContaining({
        value: expect.objectContaining({
          datasetId: 'dataset-2',
          appId: 'app-2',
          apiKey: 'fastgpt-secret',
        }),
      }),
      { upsert: true },
    );
    expect(result).toMatchObject({
      datasetId: 'dataset-2',
      appId: 'app-2',
      apiKey: '********',
      apiKeyConfigured: true,
    });
  });

  it('preserves bundled model tokens when the UI submits masked placeholders', async () => {
    const { provider, settingModel } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            bundledModels: {
              llm: {
                requestUrl: 'https://llm.example/v1/chat/completions',
                requestAuth: 'llm-secret',
                model: 'qwen-chat',
                name: 'Qwen Chat',
              },
              embedding: {
                requestUrl: 'https://embedding.example/v1/embeddings',
                requestAuth: 'embedding-secret',
                model: 'qwen-embedding',
                name: 'Qwen Embedding',
              },
            },
          },
        }),
      },
    });

    const result = await provider.updateConfig({
      bundledModels: {
        llm: {
          requestUrl: 'https://llm-2.example/v1/chat/completions',
          requestAuth: '********',
          model: 'qwen-chat-2',
          name: 'Qwen Chat 2',
        },
        embedding: {
          requestUrl: 'https://embedding-2.example/v1/embeddings',
          requestAuth: '********',
          model: 'qwen-embedding-2',
          name: 'Qwen Embedding 2',
        },
      },
    } as any);

    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { type: 'aiQa' },
      expect.objectContaining({
        value: expect.objectContaining({
          bundledModels: {
            llm: expect.objectContaining({
              requestUrl: 'https://llm-2.example/v1/chat/completions',
              requestAuth: 'llm-secret',
              model: 'qwen-chat-2',
              name: 'Qwen Chat 2',
            }),
            embedding: expect.objectContaining({
              requestUrl: 'https://embedding-2.example/v1/embeddings',
              requestAuth: 'embedding-secret',
              model: 'qwen-embedding-2',
              name: 'Qwen Embedding 2',
            }),
          },
        }),
      }),
      { upsert: true },
    );
    expect(result).toMatchObject({
      bundledModels: {
        llm: expect.objectContaining({
          requestAuth: '********',
          requestAuthConfigured: true,
        }),
        embedding: expect.objectContaining({
          requestAuth: '********',
          requestAuthConfigured: true,
        }),
      },
    });
  });

  it('generates and persists blogInstanceId on first config read', async () => {
    const { provider, settingModel } = createProvider();

    const result = await provider.getConfig();

    expect(result.blogInstanceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { type: 'aiQa' },
      expect.objectContaining({
        value: expect.objectContaining({
          blogInstanceId: result.blogInstanceId,
        }),
      }),
      { upsert: true },
    );
  });

  it('reuses an existing blogInstanceId without persisting a new one', async () => {
    const { provider, settingModel } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            blogInstanceId: '8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
          },
        }),
      },
    });

    const result = await provider.getConfig();

    expect(result.blogInstanceId).toBe('8fe72b6b-c60d-438f-bb19-9fc7fba4da88');
    expect(settingModel.updateOne).not.toHaveBeenCalled();
  });

  it('switches to manual mode when dataset/app/api key ids are edited manually', async () => {
    const { provider, settingModel } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            blogInstanceId: 'blog-instance-1',
            datasetId: 'dataset-managed',
            appId: 'app-managed',
            apiKey: 'managed-secret',
            resourceManagementMode: 'managedV2',
            managedResourceNames: {
              dataset: 'dataset-name',
              app: 'app-name',
              apiKey: 'api-key-name',
            },
            legacyAutoMigrationPending: true,
          },
        }),
      },
    });

    const result = await provider.updateConfig({
      datasetId: 'dataset-manual',
      appId: 'app-manual',
      apiKey: 'manual-secret',
    } as any);

    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { type: 'aiQa' },
      expect.objectContaining({
        value: expect.objectContaining({
          datasetId: 'dataset-manual',
          appId: 'app-manual',
          apiKey: 'manual-secret',
          resourceManagementMode: 'manual',
          managedResourceNames: undefined,
          legacyAutoMigrationPending: false,
        }),
      }),
      { upsert: true },
    );
    expect(result).toMatchObject({
      datasetId: 'dataset-manual',
      appId: 'app-manual',
      apiKey: '********',
      resourceManagementMode: 'manual',
      legacyAutoMigrationPending: false,
    });
  });

  it('returns the FastGPT answer even when no citations are attached', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'hallucinated answer' } }],
        responseData: [{ answer: 'hallucinated answer' }],
      },
    } as any);
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
      },
    });

    const result = await provider.chat('What is VanBlog?', {
      chatId: 'chat-1',
      actor: {
        userId: 1,
        name: 'alice',
        nickname: 'Alice',
      },
    });

    expect(result).toMatchObject({
      conversationId: expect.any(String),
      chatId: 'chat-1',
      grounded: false,
      citations: [],
    });
    expect(result.answer).toBe('hallucinated answer');
  });

  it('normalizes legacy editor urls in citations to the admin path', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: 'document answer',
              totalQuoteList: [{ collectionId: 'collection-1', q: 'Q', a: 'A', score: 0.88 }],
            },
          },
        ],
        responseData: [{ answer: 'document answer' }],
      },
    } as any);
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
        listAiKnowledgeSyncsByCollectionIds: jest.fn().mockResolvedValue([
          {
            sourceType: 'document',
            sourceId: '2',
            contentHash: 'hash',
            datasetId: 'dataset-1',
            collectionId: 'collection-1',
            title: '私密文档',
            editorUrl: '/editor?type=document&id=2',
            updatedAt: '2024-02-01T00:00:00.000Z',
            lastSyncedAt: '2024-02-01T00:00:00.000Z',
            deletedAt: null,
          },
        ]),
      },
    });

    const result = await provider.chat('打开这个私密文档', { chatId: 'chat-2' });

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.editorUrl).toBe('/admin/editor?type=document&id=2');
  });

  it('persists a new conversation turn and returns saved conversation metadata', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: '新的回答' } }],
        responseData: [{ answer: '新的回答' }],
      },
    } as any);

    const { provider, structuredDataService } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
        updateAiQaConversation: jest.fn().mockImplementation((id: string, patch: any) => ({
          id,
          chatId: 'chat-1',
          title: '第一条问题',
          createdByUserId: 7,
          createdByName: 'alice',
          createdByNickname: 'Alice',
          messageCount: patch.messageCount,
          lastMessagePreview: patch.lastMessagePreview,
          createdAt: '2024-02-01T00:00:00.000Z',
          updatedAt: patch.updatedAt,
          deletedAt: null,
        })),
      },
    });

    const result = await provider.chat('第一条问题', {
      chatId: 'chat-1',
      actor: {
        userId: 7,
        name: 'alice',
        nickname: 'Alice',
      },
    });

    expect(structuredDataService.createAiQaConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-1',
        title: '第一条问题',
        createdByNickname: 'Alice',
      }),
    );
    expect(structuredDataService.createAiQaMessages).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'user',
        content: '第一条问题',
        createdByNickname: 'Alice',
      }),
      expect.objectContaining({
        role: 'assistant',
        content: '新的回答',
        grounded: false,
        citations: [],
      }),
    ]);
    expect(result).toMatchObject({
      conversationId: expect.any(String),
      chatId: 'chat-1',
      answer: '新的回答',
      conversation: {
        id: expect.any(String),
        title: '第一条问题',
        messageCount: 2,
      },
      userMessage: {
        role: 'user',
        content: '第一条问题',
        createdByNickname: 'Alice',
      },
      assistantMessage: {
        role: 'assistant',
        content: '新的回答',
      },
    });
  });

  it('continues an existing saved conversation by conversation id', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: '继续回答' } }],
        responseData: [{ answer: '继续回答' }],
      },
    } as any);

    const existingConversation = {
      id: 'conv-1',
      chatId: 'chat-1',
      title: '已有会话',
      createdByNickname: 'Alice',
      messageCount: 4,
      lastMessagePreview: '旧回答',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:02.000Z',
      deletedAt: null,
    };
    const { provider, structuredDataService } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
        getAiQaConversation: jest.fn().mockResolvedValue(existingConversation),
        updateAiQaConversation: jest.fn().mockResolvedValue({
          ...existingConversation,
          messageCount: 6,
          updatedAt: '2024-02-01T00:00:03.000Z',
          lastMessagePreview: '继续回答',
        }),
      },
    });

    const result = await provider.chat('继续追问', { conversationId: 'conv-1' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://fastgpt-app:3000/api/v1/chat/completions',
      expect.objectContaining({
        chatId: 'chat-1',
        messages: [{ role: 'user', content: '继续追问' }],
      }),
      expect.any(Object),
    );
    expect(structuredDataService.createAiQaConversation).not.toHaveBeenCalled();
    expect(result.conversation).toMatchObject({
      id: 'conv-1',
      messageCount: 6,
    });
  });

  it('lists, loads, renames, and deletes shared conversations', async () => {
    const conversation = {
      id: 'conv-1',
      chatId: 'chat-1',
      title: '旧标题',
      createdByNickname: 'Alice',
      messageCount: 2,
      lastMessagePreview: '摘要',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:01.000Z',
      deletedAt: null,
    };
    const { provider, structuredDataService } = createProvider({
      structuredDataService: {
        listAiQaConversations: jest.fn().mockResolvedValue({
          total: 1,
          conversations: [conversation],
        }),
        getAiQaConversationDetail: jest.fn().mockResolvedValue({
          ...conversation,
          messages: [
            {
              id: 'msg-1',
              conversationId: 'conv-1',
              role: 'user',
              content: 'hello',
              grounded: false,
              citations: [],
              createdAt: '2024-02-01T00:00:00.000Z',
            },
          ],
        }),
        getAiQaConversation: jest
          .fn()
          .mockResolvedValueOnce(conversation)
          .mockResolvedValueOnce(conversation),
        updateAiQaConversation: jest
          .fn()
          .mockResolvedValueOnce({
            ...conversation,
            title: '新标题',
            updatedAt: '2024-02-01T00:00:02.000Z',
          })
          .mockResolvedValueOnce({
            ...conversation,
            deletedAt: '2024-02-01T00:00:03.000Z',
            updatedAt: '2024-02-01T00:00:03.000Z',
          }),
      },
    });

    await expect(provider.listConversations(1, 20)).resolves.toMatchObject({
      total: 1,
      items: [{ id: 'conv-1', title: '旧标题' }],
    });
    await expect(provider.getConversationDetail('conv-1')).resolves.toMatchObject({
      id: 'conv-1',
      messages: [{ id: 'msg-1', role: 'user', content: 'hello' }],
    });
    await expect(provider.renameConversation('conv-1', '新标题')).resolves.toMatchObject({
      id: 'conv-1',
      title: '新标题',
    });
    await expect(provider.deleteConversation('conv-1')).resolves.toEqual({
      id: 'conv-1',
      deleted: true,
    });
    expect(structuredDataService.updateAiQaConversation).toHaveBeenCalledTimes(2);
  });

  it('counts changed or cross-dataset mappings as pending in status', async () => {
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
        listAiKnowledgeSyncs: jest.fn().mockResolvedValue([
          {
            sourceType: 'article',
            sourceId: '1',
            contentHash: 'stale-hash',
            datasetId: 'dataset-2',
            collectionId: 'collection-1',
            title: 'One article',
            updatedAt: '2024-02-01T00:00:00.000Z',
            lastSyncedAt: '2024-02-01T00:00:00.000Z',
            deletedAt: null,
          },
        ]),
      },
      articleProvider: {
        getAll: jest.fn().mockResolvedValue([
          {
            id: 1,
            title: 'One article',
            content: 'Fresh content',
            updatedAt: '2024-02-01T00:00:00.000Z',
            createdAt: '2024-02-01T00:00:00.000Z',
            hidden: false,
            private: false,
          },
        ]),
      },
    });

    await expect(provider.getStatus()).resolves.toMatchObject({
      totalSources: 1,
      syncedSources: 0,
      pendingSources: 1,
      sourceCounts: {
        article: 1,
        draft: 0,
        document: 0,
      },
      syncedCounts: {
        article: 0,
        draft: 0,
        document: 0,
      },
    });
  });

  it('treats legacy url-only hash drift as synced in status', async () => {
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
        listAiKnowledgeSyncs: jest.fn().mockResolvedValue([
          {
            sourceType: 'article',
            sourceId: '1',
            contentHash: 'legacy-hash',
            datasetId: 'dataset-1',
            collectionId: 'collection-1',
            title: 'One article',
            editorUrl: '/editor?type=article&id=1',
            updatedAt: '2024-02-01T00:00:00.000Z',
            lastSyncedAt: '2024-02-01T00:00:00.000Z',
            deletedAt: null,
          },
        ]),
      },
      articleProvider: {
        getAll: jest.fn().mockResolvedValue([
          {
            id: 1,
            title: 'One article',
            content: 'Fresh content',
            pathname: 'one-article',
            updatedAt: '2024-02-01T00:00:00.000Z',
            createdAt: '2024-02-01T00:00:00.000Z',
            hidden: false,
            private: false,
          },
        ]),
      },
    });

    await expect(provider.getStatus()).resolves.toMatchObject({
      totalSources: 1,
      syncedSources: 1,
      pendingSources: 0,
      sourceCounts: {
        article: 1,
        draft: 0,
        document: 0,
      },
      syncedCounts: {
        article: 1,
        draft: 0,
        document: 0,
      },
    });
  });

  it('refreshes legacy hash metadata without recreating the FastGPT collection', async () => {
    const { provider, structuredDataService } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
        listAiKnowledgeSyncs: jest.fn().mockResolvedValue([]),
        getAiKnowledgeSync: jest.fn().mockResolvedValue({
          sourceType: 'article',
          sourceId: '1',
          contentHash: 'legacy-hash',
          datasetId: 'dataset-1',
          collectionId: 'collection-1',
          title: 'One article',
          editorUrl: '/editor?type=article&id=1',
          updatedAt: '2024-02-01T00:00:00.000Z',
          lastSyncedAt: '2024-02-01T00:00:00.000Z',
          deletedAt: null,
        }),
      },
      articleProvider: {
        getAll: jest.fn().mockResolvedValue([
          {
            id: 1,
            title: 'One article',
            content: 'Fresh content',
            pathname: 'one-article',
            updatedAt: '2024-02-01T00:00:00.000Z',
            createdAt: '2024-02-01T00:00:00.000Z',
            hidden: false,
            private: false,
          },
        ]),
      },
    });

    const summary = await provider.runFullSync('manual');

    expect(summary).toMatchObject({
      total: 1,
      created: 0,
      updated: 0,
      skipped: 1,
      deleted: 0,
      failed: 0,
    });
    expect(structuredDataService.upsertAiKnowledgeSync).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'article',
        sourceId: '1',
        datasetId: 'dataset-1',
        collectionId: 'collection-1',
        title: 'One article',
        editorUrl: '/admin/editor?type=article&id=1',
      }),
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('recreates changed sources and deletes stale collections during full sync', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          data: {
            collectionId: 'new-collection',
          },
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          data: null,
        },
      } as any);

    const { provider, structuredDataService } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: true,
            datasetId: 'dataset-1',
            appId: 'app-1',
            apiKey: 'fastgpt-secret',
          },
        }),
        listAiKnowledgeSyncs: jest.fn().mockResolvedValue([
          {
            sourceType: 'article',
            sourceId: 'legacy',
            contentHash: 'legacy-hash',
            datasetId: 'dataset-1',
            collectionId: 'old-collection',
            title: 'legacy',
            updatedAt: '2024-01-01T00:00:00.000Z',
            lastSyncedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
          },
        ]),
        getAiKnowledgeSync: jest.fn().mockImplementation((sourceType: string, sourceId: string) => {
          if (sourceType === 'article' && sourceId === 'legacy') {
            return Promise.resolve({
              sourceType: 'article',
              sourceId: 'legacy',
              contentHash: 'legacy-hash',
              datasetId: 'dataset-1',
              collectionId: 'old-collection',
              title: 'legacy',
              updatedAt: '2024-01-01T00:00:00.000Z',
              lastSyncedAt: '2024-01-01T00:00:00.000Z',
              deletedAt: null,
            });
          }
          return Promise.resolve(null);
        }),
      },
      articleProvider: {
        getAll: jest.fn().mockResolvedValue([
          {
            id: 1,
            title: 'One article',
            content: 'Hello FastGPT',
            updatedAt: '2024-02-01T00:00:00.000Z',
            createdAt: '2024-02-01T00:00:00.000Z',
            hidden: false,
            private: false,
          },
        ]),
      },
    });

    const summary = await provider.runFullSync('manual');

    expect(summary).toMatchObject({
      total: 1,
      created: 1,
      deleted: 1,
      failed: 0,
    });
    expect(structuredDataService.upsertAiKnowledgeSync).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'article',
        sourceId: '1',
        collectionId: 'new-collection',
      }),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/core/dataset/collection/create/text'),
      expect.objectContaining({ datasetId: 'dataset-1' }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fastgpt-secret' }),
      }),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/core/dataset/collection/delete'),
      { collectionIds: ['old-collection'] },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fastgpt-secret' }),
      }),
    );
    expect(structuredDataService.markAiKnowledgeSyncDeleted).toHaveBeenCalledWith(
      'article',
      'legacy',
    );
  });

  it('syncs bundled FastGPT models through root-user token-authenticated endpoints', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          code: 'login-code',
        },
      },
    } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          token: 'root-session-token',
        },
      },
    } as any);
    mockedAxios.request
      .mockResolvedValueOnce({ data: {} } as any)
      .mockResolvedValueOnce({ data: {} } as any)
      .mockResolvedValueOnce({ data: {} } as any);

    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            bundledModels: {
              llm: {
                requestUrl: 'https://llm.example/v1/chat/completions',
                requestAuth: 'llm-secret',
                model: 'qwen-chat',
                name: 'Qwen Chat',
              },
              embedding: {
                requestUrl: 'https://embedding.example/v1/embeddings',
                requestAuth: '',
                model: 'qwen-embedding',
                name: 'Qwen Embedding',
              },
            },
          },
        }),
      },
    });

    await expect(provider.syncBundledModels()).resolves.toMatchObject({
      llm: {
        model: 'qwen-chat',
        name: 'Qwen Chat',
      },
      embedding: {
        model: 'qwen-embedding',
        name: 'Qwen Embedding',
      },
    });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://fastgpt-app:3000/api/support/user/account/preLogin',
      expect.objectContaining({
        params: {
          username: 'root',
        },
      }),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://fastgpt-app:3000/api/support/user/account/loginByPassword',
      {
        username: 'root',
        password: createHash('sha256').update('change-me-now').digest('hex'),
        code: 'login-code',
        language: 'zh-CN',
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );

    expect(mockedAxios.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'POST',
        url: 'http://fastgpt-app:3000/api/core/ai/model/update',
        headers: expect.objectContaining({
          token: 'root-session-token',
        }),
        data: expect.objectContaining({
          model: 'qwen-chat',
          metadata: expect.objectContaining({
            requestUrl: 'https://llm.example/v1/chat/completions',
            requestAuth: 'llm-secret',
          }),
        }),
      }),
    );
    expect(mockedAxios.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'POST',
        url: 'http://fastgpt-app:3000/api/core/ai/model/update',
        data: expect.objectContaining({
          model: 'qwen-embedding',
          metadata: expect.objectContaining({
            requestUrl: 'https://embedding.example/v1/embeddings',
          }),
        }),
      }),
    );
    expect(mockedAxios.request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        method: 'POST',
        url: 'http://fastgpt-app:3000/api/core/ai/model/updateDefault',
        data: {
          llm: 'qwen-chat',
          datasetTextLLM: 'qwen-chat',
          embedding: 'qwen-embedding',
        },
      }),
    );
  });

  it('provisions FastGPT dataset, app, and api key and stores the generated ids', async () => {
    const { provider, settingModel } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: false,
            blogInstanceId: '8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
            bundledModels: {
              llm: {
                requestUrl: 'https://llm.example/v1/chat/completions',
                requestAuth: 'llm-secret',
                model: 'qwen-chat',
                name: 'Qwen Chat',
              },
              embedding: {
                requestUrl: 'https://embedding.example/v1/embeddings',
                requestAuth: '',
                model: 'qwen-embedding',
                name: 'Qwen Embedding',
              },
            },
          },
        }),
      },
    });

    jest.spyOn(provider, 'syncBundledModels').mockResolvedValue({
      llm: {
        model: 'qwen-chat',
        name: 'Qwen Chat',
        requestUrl: 'https://llm.example/v1/chat/completions',
      },
      embedding: {
        model: 'qwen-embedding',
        name: 'Qwen Embedding',
        requestUrl: 'https://embedding.example/v1/embeddings',
      },
    });
    jest.spyOn(provider, 'getStatus').mockResolvedValue({
      enabled: false,
      configured: true,
      missingConfigFields: [],
      fastgptInternalUrl: 'http://fastgpt-app:3000',
      fastgptRootPasswordConfigured: true,
      bundledModelConfigured: true,
      bundledModelMissingFields: [],
      datasetId: 'dataset-1',
      appId: 'app-1',
      blogInstanceId: '8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
      resourceManagementMode: 'managedV2',
      resourceNamingVersion: 2,
      managedResourceNames: {
        dataset: 'VanBlog AI 问答知识库 / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
        app: 'VanBlog AI 问答 / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
        apiKey: 'VanBlog AI Key / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
      },
      legacyAutoMigrationPending: false,
      totalSources: 0,
      syncedSources: 0,
      pendingSources: 0,
      sourceCounts: { article: 0, draft: 0, document: 0 },
      syncedCounts: { article: 0, draft: 0, document: 0 },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          code: 'login-code',
        },
      },
    } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          token: 'root-session-token',
        },
      },
    } as any);
    mockedAxios.request
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'dataset-1',
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'app-1',
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'fastgpt-secret',
        },
      } as any);

    const result = await provider.provisionFastgptResources();

    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { type: 'aiQa' },
      expect.objectContaining({
        value: expect.objectContaining({
          datasetId: 'dataset-1',
          appId: 'app-1',
          apiKey: 'fastgpt-secret',
          resourceManagementMode: 'managedV2',
          managedResourceNames: {
            dataset:
              'VanBlog AI 问答知识库 / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
            app: 'VanBlog AI 问答 / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
            apiKey: 'VanBlog AI Key / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
          },
        }),
      }),
      { upsert: true },
    );
    expect(mockedAxios.request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'POST',
        url: 'http://fastgpt-app:3000/api/core/dataset/create',
        headers: expect.objectContaining({
          token: 'root-session-token',
        }),
        data: expect.objectContaining({
          name: 'VanBlog AI 问答知识库 / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
          vectorModel: 'qwen-embedding',
          agentModel: 'qwen-chat',
        }),
      }),
    );
    expect(mockedAxios.request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: 'POST',
        url: 'http://fastgpt-app:3000/api/core/app/create',
        data: expect.objectContaining({
          name: 'VanBlog AI 问答 / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
          type: 'simple',
        }),
      }),
    );
    expect(mockedAxios.request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        method: 'POST',
        url: 'http://fastgpt-app:3000/api/support/openapi/create',
        data: {
          appId: 'app-1',
          name: 'VanBlog AI Key / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
          limit: {
            maxUsagePoints: -1,
          },
        },
      }),
    );
    expect(result).toMatchObject({
      dataset: {
        id: 'dataset-1',
        action: 'created',
      },
      app: {
        id: 'app-1',
        action: 'created',
      },
      apiKey: {
        action: 'created',
        configured: true,
      },
      config: {
        datasetId: 'dataset-1',
        appId: 'app-1',
        apiKey: '********',
        apiKeyConfigured: true,
        resourceManagementMode: 'managedV2',
        blogInstanceId: '8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
      },
    });
  });

  it('marks legacy auto-managed resources as pending migration in status', async () => {
    const { provider, settingModel } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: false,
            blogInstanceId: 'legacy-blog-1',
            datasetId: 'legacy-dataset',
            appId: 'legacy-app',
            apiKey: 'legacy-key',
            bundledModels: {
              llm: {
                requestUrl: 'https://llm.example/v1/chat/completions',
                requestAuth: 'llm-secret',
                model: 'qwen-chat',
                name: 'Qwen Chat',
              },
              embedding: {
                requestUrl: 'https://embedding.example/v1/embeddings',
                requestAuth: '',
                model: 'qwen-embedding',
                name: 'Qwen Embedding',
              },
            },
          },
        }),
      },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          code: 'login-code',
        },
      },
    } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          token: 'root-session-token',
        },
      },
    } as any);
    mockedAxios.request
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: {
            _id: 'legacy-dataset',
            name: 'VanBlog AI 问答知识库',
            intro: 'VanBlog 自动创建的博客知识库，用于后台 AI 问答检索。',
          },
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: {
            _id: 'legacy-app',
            name: 'VanBlog AI 问答',
            intro: 'VanBlog 自动维护的博客知识问答应用。',
            modules: [
              { nodeId: 'workflowStartNodeId', inputs: [] },
              {
                nodeId: 'iKBoX2vIzETU',
                inputs: [
                  {
                    key: 'datasets',
                    value: [{ datasetId: 'legacy-dataset', name: 'VanBlog AI 问答知识库' }],
                  },
                ],
              },
              {
                nodeId: '7BdojPlukIQw',
                inputs: [
                  {
                    key: 'systemPrompt',
                    value:
                      '你是 VanBlog 的博客知识助手。知识库检索结果用于辅助回答站长关于博客内容的问题。请优先参考博客知识回答；当知识库没有直接覆盖问题时，可以结合通用知识做必要补充，但要明确区分哪些是博客里明确提到的内容、哪些是基于常识的补充判断，不要把补充内容说成博客原文，也不要编造博客中不存在的事实。',
                  },
                ],
              },
            ],
            edges: [
              { source: 'workflowStartNodeId', target: 'iKBoX2vIzETU' },
              { source: 'iKBoX2vIzETU', target: '7BdojPlukIQw' },
            ],
          },
        },
      } as any);

    const status = await provider.getStatus();

    expect(status.legacyAutoMigrationPending).toBe(true);
    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { type: 'aiQa' },
      expect.objectContaining({
        value: expect.objectContaining({
          legacyAutoMigrationPending: true,
        }),
      }),
      { upsert: true },
    );
  });

  it('does not try to auto-migrate resources when the config is explicitly manual', async () => {
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            blogInstanceId: 'manual-blog-1',
            datasetId: 'manual-dataset',
            appId: 'manual-app',
            apiKey: 'manual-key',
            resourceManagementMode: 'manual',
          },
        }),
      },
    });

    const status = await provider.getStatus();

    expect(status.resourceManagementMode).toBe('manual');
    expect(status.legacyAutoMigrationPending).toBe(false);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('migrates legacy auto-managed resources to managed v2 names and deletes old resources', async () => {
    const { provider, settingModel } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: false,
            blogInstanceId: '8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
            datasetId: 'legacy-dataset',
            appId: 'legacy-app',
            apiKey: 'legacy-key',
            legacyAutoMigrationPending: true,
            bundledModels: {
              llm: {
                requestUrl: 'https://llm.example/v1/chat/completions',
                requestAuth: 'llm-secret',
                model: 'qwen-chat',
                name: 'Qwen Chat',
              },
              embedding: {
                requestUrl: 'https://embedding.example/v1/embeddings',
                requestAuth: '',
                model: 'qwen-embedding',
                name: 'Qwen Embedding',
              },
            },
          },
        }),
      },
    });

    jest.spyOn(provider, 'syncBundledModels').mockResolvedValue({
      llm: {
        model: 'qwen-chat',
        name: 'Qwen Chat',
        requestUrl: 'https://llm.example/v1/chat/completions',
      },
      embedding: {
        model: 'qwen-embedding',
        name: 'Qwen Embedding',
        requestUrl: 'https://embedding.example/v1/embeddings',
      },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          code: 'login-code',
        },
      },
    } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          token: 'root-session-token',
        },
      },
    } as any);
    mockedAxios.request
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: {
            _id: 'legacy-dataset',
            name: 'VanBlog AI 问答知识库',
            intro: 'VanBlog 自动创建的博客知识库，用于后台 AI 问答检索。',
          },
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: {
            _id: 'legacy-app',
            name: 'VanBlog AI 问答',
            intro: 'VanBlog 自动维护的博客知识问答应用。',
            modules: [
              { nodeId: 'workflowStartNodeId', inputs: [] },
              {
                nodeId: 'iKBoX2vIzETU',
                inputs: [
                  {
                    key: 'datasets',
                    value: [{ datasetId: 'legacy-dataset', name: 'VanBlog AI 问答知识库' }],
                  },
                ],
              },
              {
                nodeId: '7BdojPlukIQw',
                inputs: [
                  {
                    key: 'systemPrompt',
                    value:
                      '你是 VanBlog 的博客知识助手。知识库检索结果用于辅助回答站长关于博客内容的问题。请优先参考博客知识回答；当知识库没有直接覆盖问题时，可以结合通用知识做必要补充，但要明确区分哪些是博客里明确提到的内容、哪些是基于常识的补充判断，不要把补充内容说成博客原文，也不要编造博客中不存在的事实。',
                  },
                ],
              },
            ],
            edges: [
              { source: 'workflowStartNodeId', target: 'iKBoX2vIzETU' },
              { source: 'iKBoX2vIzETU', target: '7BdojPlukIQw' },
            ],
          },
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'dataset-v2',
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'app-v2',
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'api-v2-secret',
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: true,
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: true,
        },
      } as any);

    const result = await provider.migrateLegacyFastgptResources();

    expect(result).toMatchObject({
      migrated: true,
      dataset: { id: 'dataset-v2', action: 'created' },
      app: { id: 'app-v2', action: 'created' },
      apiKey: { action: 'created', configured: true },
      config: {
        datasetId: 'dataset-v2',
        appId: 'app-v2',
        apiKey: '********',
        resourceManagementMode: 'managedV2',
        legacyAutoMigrationPending: false,
      },
      syncSummary: {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        deleted: 0,
        failed: 0,
        trigger: 'legacy-migration',
      },
    });
    expect(settingModel.updateOne).toHaveBeenLastCalledWith(
      { type: 'aiQa' },
      expect.objectContaining({
        value: expect.objectContaining({
          datasetId: 'dataset-v2',
          appId: 'app-v2',
          apiKey: 'api-v2-secret',
          resourceManagementMode: 'managedV2',
          managedResourceNames: {
            dataset:
              'VanBlog AI 问答知识库 / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
            app: 'VanBlog AI 问答 / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
            apiKey: 'VanBlog AI Key / blog.example.com / 8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
          },
          legacyAutoMigrationPending: false,
        }),
      }),
      { upsert: true },
    );
    expect(mockedAxios.request).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        method: 'DELETE',
        url: 'http://fastgpt-app:3000/api/core/app/del',
        params: { appId: 'legacy-app' },
      }),
    );
    expect(mockedAxios.request).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({
        method: 'DELETE',
        url: 'http://fastgpt-app:3000/api/core/dataset/delete',
        params: { id: 'legacy-dataset' },
      }),
    );
  });

  it('skips legacy migration safely when the FastGPT root password is missing', async () => {
    config.fastgptRootPassword = '';
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            blogInstanceId: 'legacy-blog-1',
            datasetId: 'legacy-dataset',
            appId: 'legacy-app',
            apiKey: 'legacy-key',
            legacyAutoMigrationPending: true,
            bundledModels: {
              llm: {
                requestUrl: 'https://llm.example/v1/chat/completions',
                requestAuth: 'llm-secret',
                model: 'qwen-chat',
                name: 'Qwen Chat',
              },
              embedding: {
                requestUrl: 'https://embedding.example/v1/embeddings',
                requestAuth: '',
                model: 'qwen-embedding',
                name: 'Qwen Embedding',
              },
            },
          },
        }),
      },
    });

    const result = await provider.migrateLegacyFastgptResources();

    expect(result).toMatchObject({
      migrated: false,
      skipped: true,
      reason: '未配置 FastGPT root 密码，暂不执行旧资源迁移',
      config: {
        datasetId: 'legacy-dataset',
        appId: 'legacy-app',
        resourceManagementMode: 'manual',
        legacyAutoMigrationPending: true,
      },
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('skips legacy migration safely when bundled model config is incomplete', async () => {
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            blogInstanceId: 'legacy-blog-1',
            datasetId: 'legacy-dataset',
            appId: 'legacy-app',
            apiKey: 'legacy-key',
            legacyAutoMigrationPending: true,
            bundledModels: {
              llm: {
                requestUrl: '',
                requestAuth: '',
                model: '',
                name: '',
              },
              embedding: {
                requestUrl: '',
                requestAuth: '',
                model: '',
                name: '',
              },
            },
          },
        }),
      },
    });

    const result = await provider.migrateLegacyFastgptResources();

    expect(result).toMatchObject({
      migrated: false,
      skipped: true,
      reason: 'bundled FastGPT 模型配置缺失，暂不执行旧资源迁移',
      config: {
        datasetId: 'legacy-dataset',
        appId: 'legacy-app',
        legacyAutoMigrationPending: true,
      },
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('keeps the new config and returns a warning when deleting legacy resources fails', async () => {
    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            enabled: false,
            blogInstanceId: '8fe72b6b-c60d-438f-bb19-9fc7fba4da88',
            datasetId: 'legacy-dataset',
            appId: 'legacy-app',
            apiKey: 'legacy-key',
            legacyAutoMigrationPending: true,
            bundledModels: {
              llm: {
                requestUrl: 'https://llm.example/v1/chat/completions',
                requestAuth: 'llm-secret',
                model: 'qwen-chat',
                name: 'Qwen Chat',
              },
              embedding: {
                requestUrl: 'https://embedding.example/v1/embeddings',
                requestAuth: '',
                model: 'qwen-embedding',
                name: 'Qwen Embedding',
              },
            },
          },
        }),
      },
    });

    jest.spyOn(provider, 'syncBundledModels').mockResolvedValue({
      llm: {
        model: 'qwen-chat',
        name: 'Qwen Chat',
        requestUrl: 'https://llm.example/v1/chat/completions',
      },
      embedding: {
        model: 'qwen-embedding',
        name: 'Qwen Embedding',
        requestUrl: 'https://embedding.example/v1/embeddings',
      },
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          code: 'login-code',
        },
      },
    } as any);
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        code: 200,
        data: {
          token: 'root-session-token',
        },
      },
    } as any);
    mockedAxios.request
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: {
            _id: 'legacy-dataset',
            name: 'VanBlog AI 问答知识库',
            intro: 'VanBlog 自动创建的博客知识库，用于后台 AI 问答检索。',
          },
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: {
            _id: 'legacy-app',
            name: 'VanBlog AI 问答',
            intro: 'VanBlog 自动维护的博客知识问答应用。',
            modules: [
              { nodeId: 'workflowStartNodeId', inputs: [] },
              {
                nodeId: 'iKBoX2vIzETU',
                inputs: [
                  {
                    key: 'datasets',
                    value: [{ datasetId: 'legacy-dataset', name: 'VanBlog AI 问答知识库' }],
                  },
                ],
              },
              {
                nodeId: '7BdojPlukIQw',
                inputs: [
                  {
                    key: 'systemPrompt',
                    value:
                      '你是 VanBlog 的博客知识助手。知识库检索结果用于辅助回答站长关于博客内容的问题。请优先参考博客知识回答；当知识库没有直接覆盖问题时，可以结合通用知识做必要补充，但要明确区分哪些是博客里明确提到的内容、哪些是基于常识的补充判断，不要把补充内容说成博客原文，也不要编造博客中不存在的事实。',
                  },
                ],
              },
            ],
            edges: [
              { source: 'workflowStartNodeId', target: 'iKBoX2vIzETU' },
              { source: 'iKBoX2vIzETU', target: '7BdojPlukIQw' },
            ],
          },
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'dataset-v2',
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'app-v2',
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: 'api-v2-secret',
        },
      } as any)
      .mockRejectedValueOnce(new Error('delete app failed'))
      .mockRejectedValueOnce(new Error('delete dataset failed'));

    const result = await provider.migrateLegacyFastgptResources();

    expect(result.migrated).toBe(true);
    expect(result.warning).toContain('删除旧版 FastGPT App 失败');
    expect(result.warning).toContain('删除旧版 FastGPT Dataset 失败');
    expect(result.config).toMatchObject({
      datasetId: 'dataset-v2',
      appId: 'app-v2',
      resourceManagementMode: 'managedV2',
      legacyAutoMigrationPending: false,
    });
  });

  it('tests bundled upstream chat and embedding models directly', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: '服务连通正常。' } }],
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        },
      } as any);

    const { provider } = createProvider({
      structuredDataService: {
        getSetting: jest.fn().mockResolvedValue({
          type: 'aiQa',
          value: {
            bundledModels: {
              llm: {
                requestUrl: 'https://llm.example/v1/chat/completions',
                requestAuth: 'llm-secret',
                model: 'qwen-chat',
                name: 'Qwen Chat',
              },
              embedding: {
                requestUrl: 'https://embedding.example/v1/embeddings',
                requestAuth: '',
                model: 'qwen-embedding',
                name: 'Qwen Embedding',
              },
            },
          },
        }),
      },
    });

    await expect(provider.testBundledModels()).resolves.toMatchObject({
      llm: {
        model: 'qwen-chat',
        preview: '服务连通正常。',
      },
      embedding: {
        model: 'qwen-embedding',
        vectorLength: 3,
      },
    });

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'https://llm.example/v1/chat/completions',
      expect.objectContaining({
        model: 'qwen-chat',
        messages: [{ role: 'user', content: '请简单回复: 服务连通正常。' }],
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer llm-secret',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'https://embedding.example/v1/embeddings',
      {
        model: 'qwen-embedding',
        input: '服务连通测试',
      },
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });
});
