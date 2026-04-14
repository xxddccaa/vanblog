import { ArticleController } from './article.controller';

describe('ArticleController', () => {
  const originalSetTimeout = global.setTimeout;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.spyOn(global, 'setTimeout').mockImplementation(((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        void handler();
      }
      return 0 as any;
    }) as any);
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.setTimeout = originalSetTimeout;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  const createController = (overrides: Record<string, any> = {}) => {
    const articleProvider = {
      getById: jest.fn().mockResolvedValue({
        id: 7,
        pathname: 'stable-post',
        category: 'System Design',
        tags: ['Cloudflare'],
      }),
      getByPathName: jest.fn().mockResolvedValue(null),
      updateById: jest.fn().mockResolvedValue({ id: 7 }),
      create: jest.fn().mockResolvedValue({ id: 8, pathname: 'new-post' }),
      deleteById: jest.fn().mockResolvedValue({ acknowledged: true }),
      ...overrides.articleProvider,
    };
    const isrProvider = {
      activeArticleById: jest.fn(),
      activeAll: jest.fn(),
      activeUrl: jest.fn(),
      activePath: jest.fn(),
      ...overrides.isrProvider,
    };

    return {
      controller: new ArticleController(articleProvider as any, isrProvider as any, {} as any),
      articleProvider,
      isrProvider,
    };
  };

  it('uses precise article invalidation for updates', async () => {
    const beforeObj = {
      id: 7,
      pathname: 'stable-post',
      title: 'old title',
    };
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        getById: jest.fn().mockResolvedValue(beforeObj),
        updateById: jest.fn().mockResolvedValue({ id: 7, title: 'new title' }),
      },
    });

    await controller.updateArticle(7, {
      title: 'new title',
      pathname: 'stable-post',
    } as any);

    expect(articleProvider.getById).toHaveBeenCalledWith(7, 'admin');
    expect(articleProvider.updateById).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: 'new title' }),
    );
    expect(isrProvider.activeArticleById).toHaveBeenCalledWith(7, 'update', beforeObj);
    expect(isrProvider.activeAll).not.toHaveBeenCalled();
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/tag', false);
    expect(isrProvider.activePath).toHaveBeenCalledWith('tag');
  });

  it('allows updating an article when the pathname stays unchanged on a string route param', async () => {
    const beforeObj = {
      id: 7,
      pathname: 'stable-post',
      title: 'old title',
    };
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        getById: jest.fn().mockResolvedValue(beforeObj),
        getByPathName: jest.fn().mockResolvedValue(beforeObj),
        updateById: jest
          .fn()
          .mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
      },
    });

    const result = await controller.updateArticle(
      '7' as any,
      {
        title: 'new title',
        pathname: 'stable-post',
      } as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { acknowledged: true, matchedCount: 1, modifiedCount: 1 },
    });
    expect(articleProvider.updateById).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: 'new title', pathname: 'stable-post' }),
    );
    expect(isrProvider.activeArticleById).toHaveBeenCalledWith(7, 'update', beforeObj);
  });

  it('clamps oversized admin article pagination before querying the provider', async () => {
    const { controller, articleProvider } = createController({
      articleProvider: {
        getByOption: jest.fn().mockResolvedValue({ articles: [], total: 0 }),
      },
    });

    await controller.getByOption(
      { user: { id: 0 } } as any,
      '0' as any,
      '999' as any,
      false as any,
      true as any,
    );

    expect(articleProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
      false,
    );
  });

  it('strips article passwords from collaborator-visible list responses', async () => {
    const { controller } = createController({
      articleProvider: {
        getByOption: jest.fn().mockResolvedValue({
          total: 1,
          articles: [{ id: 7, title: 'Secret', password: 'article-pass' }],
        }),
      },
    });

    const result = await controller.getByOption(
      { user: { id: 2 } } as any,
      1 as any,
      10 as any,
      false as any,
      true as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: {
        total: 1,
        articles: [{ id: 7, title: 'Secret', password: undefined }],
      },
    });
  });

  it('strips article passwords from collaborator-visible detail responses', async () => {
    const { controller } = createController({
      articleProvider: {
        getByIdOrPathname: jest.fn().mockResolvedValue({
          id: 7,
          title: 'Secret',
          password: 'article-pass',
        }),
      },
    });

    const result = await controller.getOneByIdOrPathname({ user: { id: 2 } } as any, '7');

    expect(result).toEqual({
      statusCode: 200,
      data: {
        id: 7,
        title: 'Secret',
        password: undefined,
      },
    });
  });

  it('uses precise article invalidation for creates', async () => {
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        create: jest.fn().mockResolvedValue({ id: 8, pathname: 'new-post' }),
      },
    });

    await controller.createArticle({
      title: 'hello',
      content: 'world',
      pathname: 'new-post',
    } as any);

    expect(articleProvider.create).toHaveBeenCalled();
    expect(isrProvider.activeArticleById).toHaveBeenCalledWith(8, 'create');
    expect(isrProvider.activeAll).not.toHaveBeenCalled();
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/tag', false);
    expect(isrProvider.activePath).toHaveBeenCalledWith('tag');
  });

  it('uses precise article invalidation for deletes instead of full-site refresh', async () => {
    const beforeObj = {
      id: 7,
      pathname: 'stable-post',
      category: 'System Design',
      tags: ['Cloudflare'],
    };
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        getById: jest.fn().mockResolvedValue(beforeObj),
      },
    });

    await controller.deleteArticle(7);

    expect(articleProvider.getById).toHaveBeenCalledWith(7, 'admin');
    expect(articleProvider.deleteById).toHaveBeenCalledWith(7);
    expect(isrProvider.activeArticleById).toHaveBeenCalledWith(7, 'delete', beforeObj);
    expect(isrProvider.activeAll).not.toHaveBeenCalled();
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/tag', false);
    expect(isrProvider.activePath).toHaveBeenCalledWith('tag');
  });

  it('rejects numeric create pathnames without triggering invalidation side effects', async () => {
    const { controller, articleProvider, isrProvider } = createController();

    const result = await controller.createArticle({
      title: 'hello',
      content: 'world',
      pathname: '12345',
    } as any);

    expect(result).toEqual({
      statusCode: 400,
      message: '自定义路径名不能为纯数字，避免与文章ID冲突',
    });
    expect(articleProvider.create).not.toHaveBeenCalled();
    expect(isrProvider.activeArticleById).not.toHaveBeenCalled();
    expect(isrProvider.activeAll).not.toHaveBeenCalled();
    expect(isrProvider.activeUrl).not.toHaveBeenCalled();
    expect(isrProvider.activePath).not.toHaveBeenCalled();
  });

  it('rejects duplicate create pathnames without triggering invalidation side effects', async () => {
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        getByPathName: jest.fn().mockResolvedValue({ id: 99, pathname: 'existing-path' }),
      },
    });

    const result = await controller.createArticle({
      title: 'hello',
      content: 'world',
      pathname: 'existing-path',
    } as any);

    expect(articleProvider.getByPathName).toHaveBeenCalledWith('existing-path', 'admin');
    expect(result).toEqual({
      statusCode: 400,
      message: '自定义路径名 "existing-path" 已被其他文章使用，请使用不同的路径名',
    });
    expect(articleProvider.create).not.toHaveBeenCalled();
    expect(isrProvider.activeArticleById).not.toHaveBeenCalled();
    expect(isrProvider.activeAll).not.toHaveBeenCalled();
    expect(isrProvider.activeUrl).not.toHaveBeenCalled();
    expect(isrProvider.activePath).not.toHaveBeenCalled();
  });

  it('rejects duplicate update pathnames without triggering invalidation side effects', async () => {
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        getByPathName: jest.fn().mockResolvedValue({ id: 99, pathname: 'existing-path' }),
      },
    });

    const result = await controller.updateArticle(7, {
      title: 'new title',
      pathname: 'existing-path',
    } as any);

    expect(articleProvider.getByPathName).toHaveBeenCalledWith('existing-path', 'admin');
    expect(result).toEqual({
      statusCode: 400,
      message: '自定义路径名 "existing-path" 已被其他文章使用，请使用不同的路径名',
    });
    expect(articleProvider.getById).not.toHaveBeenCalled();
    expect(articleProvider.updateById).not.toHaveBeenCalled();
    expect(isrProvider.activeArticleById).not.toHaveBeenCalled();
    expect(isrProvider.activeAll).not.toHaveBeenCalled();
    expect(isrProvider.activeUrl).not.toHaveBeenCalled();
    expect(isrProvider.activePath).not.toHaveBeenCalled();
  });

  it('uses full-site ISR for reorder because article ids change globally', async () => {
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        reorderArticleIds: jest.fn().mockResolvedValue({ updated: 12 }),
      },
    });

    const result = await controller.reorderArticles();

    expect(result).toEqual({
      statusCode: 200,
      data: { updated: 12 },
    });
    expect(articleProvider.reorderArticleIds).toHaveBeenCalledTimes(1);
    expect(isrProvider.activeAll).toHaveBeenCalledWith('文章重排', undefined, {
      forceActice: true,
    });
    expect(isrProvider.activeArticleById).not.toHaveBeenCalled();
    expect(isrProvider.activeUrl).toHaveBeenCalledWith('/tag', false);
    expect(isrProvider.activePath).toHaveBeenCalledWith('tag');
  });

  it('uses full-site ISR when repairing negative ids', async () => {
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        fixNegativeIds: jest.fn().mockResolvedValue({ fixedCount: 3 }),
      },
    });

    const result = await controller.fixNegativeIds();

    expect(result).toEqual({
      statusCode: 200,
      data: { fixedCount: 3 },
    });
    expect(articleProvider.fixNegativeIds).toHaveBeenCalledTimes(1);
    expect(isrProvider.activeAll).toHaveBeenCalledWith(
      '修复负数文章 ID 触发增量渲染！',
      undefined,
      { forceActice: true },
    );
    expect(isrProvider.activeArticleById).not.toHaveBeenCalled();
  });

  it('uses full-site ISR when cleaning temporary ids', async () => {
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        cleanupTempIds: jest.fn().mockResolvedValue({ cleanedCount: 4 }),
      },
    });

    const result = await controller.cleanupTempIds();

    expect(result).toEqual({
      statusCode: 200,
      data: { cleanedCount: 4 },
    });
    expect(articleProvider.cleanupTempIds).toHaveBeenCalledTimes(1);
    expect(isrProvider.activeAll).toHaveBeenCalledWith(
      '清理临时文章 ID 触发增量渲染！',
      undefined,
      { forceActice: true },
    );
    expect(isrProvider.activeArticleById).not.toHaveBeenCalled();
  });

  it('uses full-site ISR when cleaning duplicate pathnames', async () => {
    const { controller, articleProvider, isrProvider } = createController({
      articleProvider: {
        cleanupDuplicatePathnames: jest.fn().mockResolvedValue({ cleanedCount: 2 }),
      },
    });

    const result = await controller.cleanupDuplicatePathnames();

    expect(result).toEqual({
      statusCode: 200,
      data: { cleanedCount: 2 },
      message: '已清理 2 篇文章的重复路径名',
    });
    expect(articleProvider.cleanupDuplicatePathnames).toHaveBeenCalledTimes(1);
    expect(isrProvider.activeAll).toHaveBeenCalledWith('清理重复路径名触发增量渲染！', undefined, {
      forceActice: true,
    });
    expect(isrProvider.activeArticleById).not.toHaveBeenCalled();
  });
});
