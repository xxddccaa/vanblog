import { ViewerMetaController } from './viewer.meta.controller';

describe('ViewerMetaController', () => {
  const createController = () => {
    const metaProvider = {
      update: jest.fn().mockResolvedValue(undefined),
      getViewer: jest.fn().mockResolvedValue({ viewer: 10, visited: 4 }),
    };
    const articleProvider = {
      updateById: jest.fn().mockResolvedValue(undefined),
      getAll: jest.fn().mockResolvedValue([
        { id: 7, title: 'Edge Cache', viewer: 12, visited: 8, hidden: false, deleted: false },
      ]),
    };
    const visitProvider = {
      rewriteToday: jest.fn().mockResolvedValue(undefined),
    };
    const isrProvider = {
      activeUrl: jest.fn().mockResolvedValue(undefined),
    };
    const publicDataCacheProvider = {
      clearViewerData: jest.fn().mockResolvedValue(undefined),
    };

    const controller = new ViewerMetaController(
      metaProvider as any,
      articleProvider as any,
      visitProvider as any,
      isrProvider as any,
      publicDataCacheProvider as any,
    );

    return {
      controller,
      metaProvider,
      articleProvider,
      visitProvider,
      isrProvider,
      publicDataCacheProvider,
    };
  };

  it('clears viewer-facing public caches and refreshes public pages after site viewer updates', async () => {
    const { controller, metaProvider, publicDataCacheProvider, isrProvider } = createController();

    const result = await controller.updateSite({ viewer: 101, visited: 44 });

    expect(result).toEqual({
      statusCode: 200,
      message: '网站浏览量更新成功！',
    });
    expect(metaProvider.update).toHaveBeenCalledWith({ viewer: 101, visited: 44 });
    expect(publicDataCacheProvider.clearViewerData).toHaveBeenCalledTimes(1);
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/', false);
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/about', false);
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/timeline', false);
  });

  it('normalizes negative site counters before persisting viewer totals', async () => {
    const { controller, metaProvider } = createController();

    await controller.updateSite({ viewer: -10, visited: -5 });

    expect(metaProvider.update).toHaveBeenCalledWith({ viewer: 0, visited: 0 });
  });

  it('clears engagement-facing caches after per-article viewer updates', async () => {
    const {
      controller,
      articleProvider,
      visitProvider,
      publicDataCacheProvider,
      isrProvider,
    } = createController();

    const result = await controller.updateArticle({ id: 7, viewer: 99, visited: 66 });

    expect(result).toEqual({
      statusCode: 200,
      message: '文章浏览量更新成功！',
    });
    expect(articleProvider.updateById).toHaveBeenCalledWith(7, { viewer: 99, visited: 66 });
    expect(visitProvider.rewriteToday).toHaveBeenCalledWith('/post/7', 99, 66);
    expect(publicDataCacheProvider.clearViewerData).toHaveBeenCalledTimes(1);
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/', false);
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/about', false);
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/timeline', false);
  });

  it('normalizes invalid article counters before rewriting viewer data', async () => {
    const { controller, articleProvider, visitProvider } = createController();

    await controller.updateArticle({ id: 7, viewer: -99, visited: -66 });

    expect(articleProvider.updateById).toHaveBeenCalledWith(7, { viewer: 0, visited: 0 });
    expect(visitProvider.rewriteToday).toHaveBeenCalledWith('/post/7', 0, 0);
  });

  it('caps oversized batch updates and normalizes each article payload', async () => {
    const { controller, articleProvider, visitProvider } = createController();
    const articles = Array.from({ length: 600 }, (_, index) => ({
      id: index + 1,
      viewer: index === 0 ? -5 : 10,
      visited: index === 0 ? -3 : 5,
    }));

    await controller.batchUpdate({
      siteViewer: -1,
      siteVisited: -2,
      articles,
    } as any);

    expect(articleProvider.updateById).toHaveBeenCalledTimes(500);
    expect(articleProvider.updateById).toHaveBeenCalledWith(1, { viewer: 0, visited: 0 });
    expect(visitProvider.rewriteToday).toHaveBeenCalledWith('/post/1', 0, 0);
  });
});
