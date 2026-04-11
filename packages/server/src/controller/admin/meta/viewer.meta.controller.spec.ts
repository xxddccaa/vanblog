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
});
