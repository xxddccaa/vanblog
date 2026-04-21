import axios from 'axios';
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
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.request.mockReset();
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

    return {
      provider: new AiQaProvider(
        (overrides.settingModel || settingModel) as any,
        articleProvider as any,
        draftProvider as any,
        documentProvider as any,
        structuredDataService as any,
      ),
      settingModel: overrides.settingModel || settingModel,
      structuredDataService,
      articleProvider,
      draftProvider,
      documentProvider,
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
        password: 'change-me-now',
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
          name: 'VanBlog AI 问答知识库',
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
          name: 'VanBlog AI 问答',
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
          name: 'VanBlog AI 问答',
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
      },
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
