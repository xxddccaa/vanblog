import { config } from 'src/config';
import { AiQaController } from './ai-qa.controller';

describe('AiQaController', () => {
  const originalDemo = config.demo;

  afterEach(() => {
    (config as any).demo = originalDemo;
    jest.restoreAllMocks();
  });

  const createController = (overrides: Record<string, any> = {}) => {
    const aiQaProvider = {
      getConfig: jest.fn().mockResolvedValue({ enabled: true }),
      updateConfig: jest.fn().mockResolvedValue({ enabled: true, datasetId: 'dataset-1' }),
      getStatus: jest.fn().mockResolvedValue({ configured: true }),
      listConversations: jest
        .fn()
        .mockResolvedValue({ page: 1, pageSize: 20, total: 0, items: [] }),
      getConversationDetail: jest.fn().mockResolvedValue({ id: 'conv-1', messages: [] }),
      renameConversation: jest.fn().mockResolvedValue({ id: 'conv-1', title: 'new title' }),
      deleteConversation: jest.fn().mockResolvedValue({ id: 'conv-1', deleted: true }),
      testConnection: jest.fn().mockResolvedValue({ datasetReachable: true }),
      syncBundledModels: jest.fn().mockResolvedValue({ llm: { model: 'chat-model' } }),
      provisionFastgptResources: jest.fn().mockResolvedValue({
        dataset: { id: 'dataset-1', action: 'created' },
        app: { id: 'app-1', action: 'created' },
        apiKey: { action: 'created', configured: true },
      }),
      migrateLegacyFastgptResources: jest.fn().mockResolvedValue({
        migrated: true,
        dataset: { id: 'dataset-2', action: 'created' },
      }),
      testBundledModels: jest.fn().mockResolvedValue({ embedding: { vectorLength: 1024 } }),
      runFullSync: jest.fn().mockResolvedValue({ total: 1, created: 1 }),
      chat: jest.fn().mockResolvedValue({
        conversationId: 'conv-1',
        chatId: 'chat-1',
        answer: 'ok',
        grounded: true,
        citations: [],
        conversation: { id: 'conv-1', title: 'hello', messageCount: 2 },
        userMessage: { id: 'msg-user', role: 'user', content: 'hello' },
        assistantMessage: { id: 'msg-assistant', role: 'assistant', content: 'ok' },
      }),
      ...overrides.aiQaProvider,
    };

    return {
      controller: new AiQaController(aiQaProvider as any),
      aiQaProvider,
    };
  };

  it('delegates read and chat endpoints to the provider', async () => {
    (config as any).demo = false;
    const { controller, aiQaProvider } = createController();

    await expect(controller.getConfig()).resolves.toEqual({
      statusCode: 200,
      data: { enabled: true },
    });
    await expect(controller.getStatus()).resolves.toEqual({
      statusCode: 200,
      data: { configured: true },
    });
    await expect(controller.listConversations('2', '50')).resolves.toEqual({
      statusCode: 200,
      data: { page: 1, pageSize: 20, total: 0, items: [] },
    });
    await expect(controller.getConversationDetail('conv-1')).resolves.toEqual({
      statusCode: 200,
      data: { id: 'conv-1', messages: [] },
    });
    await expect(controller.renameConversation('conv-1', { title: 'new title' })).resolves.toEqual({
      statusCode: 200,
      data: { id: 'conv-1', title: 'new title' },
    });
    await expect(controller.deleteConversation('conv-1')).resolves.toEqual({
      statusCode: 200,
      data: { id: 'conv-1', deleted: true },
    });
    await expect(controller.testConnection({ question: 'health check' })).resolves.toEqual({
      statusCode: 200,
      data: { datasetReachable: true },
    });
    await expect(controller.syncBundledModels()).resolves.toEqual({
      statusCode: 200,
      data: { llm: { model: 'chat-model' } },
    });
    await expect(controller.provision()).resolves.toEqual({
      statusCode: 200,
      data: {
        dataset: { id: 'dataset-1', action: 'created' },
        app: { id: 'app-1', action: 'created' },
        apiKey: { action: 'created', configured: true },
      },
    });
    await expect(controller.migrateLegacy()).resolves.toEqual({
      statusCode: 200,
      data: {
        migrated: true,
        dataset: { id: 'dataset-2', action: 'created' },
      },
    });
    await expect(controller.testBundledModels()).resolves.toEqual({
      statusCode: 200,
      data: { embedding: { vectorLength: 1024 } },
    });
    await expect(
      controller.chat(
        { user: { id: 7, name: 'alice', nickname: 'Alice' } },
        { conversationId: 'conv-1', question: 'hello' },
      ),
    ).resolves.toEqual({
      statusCode: 200,
      data: {
        conversationId: 'conv-1',
        chatId: 'chat-1',
        answer: 'ok',
        grounded: true,
        citations: [],
        conversation: { id: 'conv-1', title: 'hello', messageCount: 2 },
        userMessage: { id: 'msg-user', role: 'user', content: 'hello' },
        assistantMessage: { id: 'msg-assistant', role: 'assistant', content: 'ok' },
      },
    });

    expect(aiQaProvider.listConversations).toHaveBeenCalledWith(2, 50);
    expect(aiQaProvider.getConversationDetail).toHaveBeenCalledWith('conv-1');
    expect(aiQaProvider.renameConversation).toHaveBeenCalledWith('conv-1', 'new title');
    expect(aiQaProvider.deleteConversation).toHaveBeenCalledWith('conv-1');
    expect(aiQaProvider.testConnection).toHaveBeenCalledWith('health check');
    expect(aiQaProvider.syncBundledModels).toHaveBeenCalled();
    expect(aiQaProvider.provisionFastgptResources).toHaveBeenCalled();
    expect(aiQaProvider.migrateLegacyFastgptResources).toHaveBeenCalled();
    expect(aiQaProvider.testBundledModels).toHaveBeenCalled();
    expect(aiQaProvider.chat).toHaveBeenCalledWith('hello', {
      conversationId: 'conv-1',
      chatId: undefined,
      actor: {
        userId: 7,
        name: 'alice',
        nickname: 'Alice',
      },
    });
  });

  it('blocks config updates and full sync in demo mode', async () => {
    (config as any).demo = true;
    const { controller, aiQaProvider } = createController();

    await expect(controller.updateConfig({ enabled: false })).resolves.toEqual({
      statusCode: 401,
      message: '演示站禁止修改此项！',
    });
    await expect(controller.fullSync()).resolves.toEqual({
      statusCode: 401,
      message: '演示站禁止修改此项！',
    });
    await expect(controller.syncBundledModels()).resolves.toEqual({
      statusCode: 401,
      message: '演示站禁止修改此项！',
    });
    await expect(controller.provision()).resolves.toEqual({
      statusCode: 401,
      message: '演示站禁止修改此项！',
    });
    await expect(controller.migrateLegacy()).resolves.toEqual({
      statusCode: 401,
      message: '演示站禁止修改此项！',
    });

    expect(aiQaProvider.updateConfig).not.toHaveBeenCalled();
    expect(aiQaProvider.runFullSync).not.toHaveBeenCalled();
    expect(aiQaProvider.syncBundledModels).not.toHaveBeenCalled();
    expect(aiQaProvider.provisionFastgptResources).not.toHaveBeenCalled();
    expect(aiQaProvider.migrateLegacyFastgptResources).not.toHaveBeenCalled();
  });

  it('persists config and starts full sync outside demo mode', async () => {
    (config as any).demo = false;
    const { controller, aiQaProvider } = createController();

    await expect(
      controller.updateConfig({ enabled: true, datasetId: 'dataset-1' }),
    ).resolves.toEqual({
      statusCode: 200,
      data: { enabled: true, datasetId: 'dataset-1' },
    });
    await expect(controller.fullSync()).resolves.toEqual({
      statusCode: 200,
      data: { total: 1, created: 1 },
    });

    expect(aiQaProvider.updateConfig).toHaveBeenCalledWith({
      enabled: true,
      datasetId: 'dataset-1',
    });
    expect(aiQaProvider.runFullSync).toHaveBeenCalledWith('manual');
  });
});
