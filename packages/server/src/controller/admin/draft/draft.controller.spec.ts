import { DraftController } from './draft.controller';

describe('DraftController', () => {
  const originalSetTimeout = global.setTimeout;

  beforeEach(() => {
    jest.spyOn(global, 'setTimeout').mockImplementation(((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        void handler();
      }
      return 0 as any;
    }) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.setTimeout = originalSetTimeout;
  });

  const createController = (overrides: Record<string, any> = {}) => {
    const draftProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, drafts: [] }),
      updateById: jest
        .fn()
        .mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
      findById: jest.fn().mockResolvedValue({ id: 80, title: 'draft title' }),
      deleteById: jest.fn().mockResolvedValue({ acknowledged: true }),
      publish: jest.fn().mockResolvedValue({ id: 81, pathname: 'draft-post' }),
      ...overrides.draftProvider,
    };
    const articleProvider = {
      getByPathName: jest.fn().mockResolvedValue(null),
      ...overrides.articleProvider,
    };
    const isrProvider = {
      activeAll: jest.fn(),
      activeUrl: jest.fn(),
      activePath: jest.fn(),
      ...overrides.isrProvider,
    };
    const pipelineProvider = {
      dispatchEvent: jest.fn().mockResolvedValue([]),
      ...overrides.pipelineProvider,
    };
    const searchIndexProvider = {
      generateSearchIndex: jest.fn(),
      ...overrides.searchIndexProvider,
    };

    return {
      controller: new DraftController(
        draftProvider as any,
        articleProvider as any,
        isrProvider as any,
        pipelineProvider as any,
        {} as any,
        searchIndexProvider as any,
      ),
      draftProvider,
      articleProvider,
      isrProvider,
      pipelineProvider,
      searchIndexProvider,
    };
  };

  it('clamps oversized admin draft pagination before querying the provider', async () => {
    const { controller, draftProvider } = createController();

    await controller.getByOption('0' as any, '999' as any, false as any);

    expect(draftProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
    );
  });

  it('updates a draft when the route param is a string id', async () => {
    const { controller, draftProvider, pipelineProvider, searchIndexProvider } = createController();

    const result = await controller.update(
      '80' as any,
      {
        content: 'updated content',
      } as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { acknowledged: true, matchedCount: 1, modifiedCount: 1 },
    });
    expect(draftProvider.updateById).toHaveBeenCalledWith(
      80,
      expect.objectContaining({ content: 'updated content' }),
    );
    expect(draftProvider.findById).toHaveBeenCalledWith(80);
    expect(pipelineProvider.dispatchEvent).toHaveBeenCalledWith(
      'afterUpdateDraft',
      expect.objectContaining({ id: 80 }),
    );
    expect(searchIndexProvider.generateSearchIndex).toHaveBeenCalledWith(
      '更新草稿触发搜索索引同步',
      500,
    );
  });

  it('publishes drafts without rebuilding tags again and only refreshes tag pages', async () => {
    const { controller, draftProvider, articleProvider, isrProvider, pipelineProvider } =
      createController();

    const result = await controller.publish(
      '80' as any,
      {
        pathname: 'draft-post',
      } as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { id: 81, pathname: 'draft-post' },
    });
    expect(articleProvider.getByPathName).toHaveBeenCalledWith('draft-post', 'admin');
    expect(draftProvider.publish).toHaveBeenCalledWith(80, expect.objectContaining({
      pathname: 'draft-post',
    }));
    expect(isrProvider.activeAll).toHaveBeenCalledWith('发布草稿触发增量渲染！');
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/tag', false);
    expect(isrProvider.activePath).toHaveBeenCalledWith('tag');
    expect(pipelineProvider.dispatchEvent).toHaveBeenCalledWith(
      'afterUpdateArticle',
      expect.objectContaining({ id: 81 }),
    );
  });
});
