import { ISRProvider } from './isr.provider';

describe('ISRProvider', () => {
  const oldEnv = process.env['VANBLOG_WEBSITE_ISR_BASE'];
  const oldDisableWebsite = process.env['VANBLOG_DISABLE_WEBSITE'];
  const originalSetTimeout = global.setTimeout;

  const createCloudflareCacheProvider = () => ({
    purgeByTags: jest.fn().mockResolvedValue(undefined),
    purgeByUrls: jest.fn().mockResolvedValue(undefined),
    purgeByTagsAndUrls: jest.fn().mockResolvedValue(undefined),
  });

  const createArticle = (overrides: Record<string, any> = {}) => ({
    id: 7,
    pathname: 'stable-post',
    title: 'Architecture',
    content: 'same',
    category: 'System Design',
    tags: ['Cloudflare'],
    createdAt: new Date('2024-01-07T00:00:00.000Z'),
    updatedAt: new Date('2026-04-10T00:00:00.000Z'),
    top: 0,
    hidden: false,
    deleted: false,
    ...overrides,
  });

  afterEach(() => {
    delete process.env['VANBLOG_DISABLE_WEBSITE'];
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.setTimeout = originalSetTimeout;
    if (oldEnv === undefined) {
      delete process.env['VANBLOG_WEBSITE_ISR_BASE'];
    } else {
      process.env['VANBLOG_WEBSITE_ISR_BASE'] = oldEnv;
    }
    if (oldDisableWebsite === undefined) {
      delete process.env['VANBLOG_DISABLE_WEBSITE'];
    } else {
      process.env['VANBLOG_DISABLE_WEBSITE'] = oldDisableWebsite;
    }
  });

  it('reads the revalidate base URL from the environment', () => {
    process.env['VANBLOG_WEBSITE_ISR_BASE'] = 'http://website:3001/api/revalidate?path=';

    const provider = new ISRProvider(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      createCloudflareCacheProvider() as any,
    );

    expect(provider.base).toBe('http://website:3001/api/revalidate?path=');
  });

  it('revalidates the current article plus affected archive urls for a title-only update', async () => {
    const article = createArticle({ title: 'New title', content: 'new content' });
    const beforeObj = createArticle({ title: 'Old title', content: 'old content' });
    const articleProvider = {
      getByIdOrPathnameWithPreNext: jest.fn().mockResolvedValue({ article }),
      getByOption: jest.fn().mockResolvedValue({
        articles: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, article],
        total: 6,
      }),
    };
    const searchIndexProvider = {
      generateSearchIndex: jest.fn(),
    };
    const rssProvider = {
      generateRssFeed: jest.fn(),
    };
    const sitemapProvider = {
      generateSiteMap: jest.fn(),
      getHomePageSize: jest.fn().mockResolvedValue(5),
    };
    const publicDataCacheProvider = {
      clearArticleRelatedData: jest.fn().mockResolvedValue(undefined),
    };
    const cloudflareCacheProvider = createCloudflareCacheProvider();
    const provider = new ISRProvider(
      articleProvider as any,
      rssProvider as any,
      sitemapProvider as any,
      {} as any,
      searchIndexProvider as any,
      publicDataCacheProvider as any,
      cloudflareCacheProvider as any,
    );
    const activeUrl = jest.spyOn(provider, 'activeUrl').mockResolvedValue(undefined);
    const activeUrls = jest.spyOn(provider, 'activeUrls').mockResolvedValue(undefined);

    await provider.activeArticleById(7, 'update', beforeObj as any);

    expect(activeUrl).toHaveBeenCalledWith('/post/7', true);
    expect(activeUrl).toHaveBeenCalledWith('/post/stable-post', true);
    expect(activeUrl).not.toHaveBeenCalledWith('/', true);
    expect(activeUrl).not.toHaveBeenCalledWith('/page/2', true);
    expect(activeUrls).toHaveBeenCalledWith(
      expect.arrayContaining([
        '/archive',
        '/archive/2024',
        '/archive/2024/01',
        '/category/System Design',
        '/category/System Design/archive/2024',
        '/category/System Design/archive/2024/01',
        '/tag/Cloudflare',
        '/tag/Cloudflare/archive/2024',
        '/tag/Cloudflare/archive/2024/01',
      ]),
      false,
    );
    expect(searchIndexProvider.generateSearchIndex).toHaveBeenCalled();
    expect(rssProvider.generateRssFeed).toHaveBeenCalled();
    expect(sitemapProvider.generateSiteMap).toHaveBeenCalled();
    expect(publicDataCacheProvider.clearArticleRelatedData).toHaveBeenCalled();

    const purgeUrls = cloudflareCacheProvider.purgeByTagsAndUrls.mock.calls[0][1] as string[];
    const purgeTags = cloudflareCacheProvider.purgeByTagsAndUrls.mock.calls[0][0] as string[];
    expect(purgeUrls).toEqual(
      expect.arrayContaining([
        '/post/7',
        '/post/stable-post',
        '/archive',
        '/archive/2024',
        '/archive/2024/01',
        '/category/System Design',
        '/tag/Cloudflare',
      ]),
    );
    expect(purgeUrls).not.toContain('/page/2');
    expect(purgeTags).toEqual(
      expect.arrayContaining([
        'article-shell',
        'article-nav',
        'article-engagement',
        'article-fragments',
        'article-ranking',
        'article-listing',
        'archive-summary',
        'post:7',
        'post:stable-post',
        'archive-year:2024',
        'archive-month:2024-01',
        'category:system-design',
        'category-archive-summary:system-design',
        'category-archive-month:system-design-2024-01',
        'tag:cloudflare',
        'tag-archive-summary:cloudflare',
        'tag-archive-month:cloudflare-2024-01',
      ]),
    );
  });

  it('refreshes both old and new archive routes when article classification changes', async () => {
    const beforeObj = createArticle({ category: 'Backend', tags: ['NestJS'] });
    const article = createArticle({ category: 'System Design', tags: ['Cloudflare'] });
    const articleProvider = {
      getByIdOrPathnameWithPreNext: jest.fn().mockResolvedValue({ article }),
      getByOption: jest.fn().mockResolvedValue({
        articles: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, article],
        total: 6,
      }),
    };
    const cloudflareCacheProvider = createCloudflareCacheProvider();
    const provider = new ISRProvider(
      articleProvider as any,
      { generateRssFeed: jest.fn() } as any,
      { getHomePageSize: jest.fn().mockResolvedValue(5), generateSiteMap: jest.fn() } as any,
      {} as any,
      { generateSearchIndex: jest.fn() } as any,
      { clearArticleRelatedData: jest.fn().mockResolvedValue(undefined) } as any,
      cloudflareCacheProvider as any,
    );
    const activeUrls = jest.spyOn(provider, 'activeUrls').mockResolvedValue(undefined);

    await provider.activeArticleById(7, 'update', beforeObj as any);

    expect(activeUrls).toHaveBeenCalledWith(
      expect.arrayContaining([
        '/archive',
        '/archive/2024',
        '/archive/2024/01',
        '/category/Backend',
        '/category/Backend/archive/2024',
        '/category/Backend/archive/2024/01',
        '/category/System Design',
        '/category/System Design/archive/2024',
        '/category/System Design/archive/2024/01',
        '/tag/NestJS',
        '/tag/NestJS/archive/2024',
        '/tag/NestJS/archive/2024/01',
        '/tag/Cloudflare',
        '/tag/Cloudflare/archive/2024',
        '/tag/Cloudflare/archive/2024/01',
        '/timeline',
        '/tag',
        '/category',
      ]),
      false,
    );

    const purgeUrls = cloudflareCacheProvider.purgeByTagsAndUrls.mock.calls[0][1] as string[];
    const purgeTags = cloudflareCacheProvider.purgeByTagsAndUrls.mock.calls[0][0] as string[];
    expect(purgeUrls).toEqual(
      expect.arrayContaining([
        '/category/Backend',
        '/category/System Design',
        '/tag/NestJS',
        '/tag/Cloudflare',
        '/timeline',
        '/tag',
        '/category',
      ]),
    );
    expect(purgeUrls).not.toContain('/category/Backend/page/2');
    expect(purgeUrls).not.toContain('/tag/NestJS/page/2');
    expect(purgeTags).toEqual(
      expect.arrayContaining([
        'category:backend',
        'category:system-design',
        'tag:nestjs',
        'tag:cloudflare',
        'category-archive-summary:backend',
        'category-archive-summary:system-design',
        'tag-archive-summary:nestjs',
        'tag-archive-summary:cloudflare',
        'category-summary',
        'timeline-summary',
        'tag-hot',
        'tag-list',
      ]),
    );
  });

  it('keeps a metadata-only article update scoped away from archive and listing pages', async () => {
    const beforeObj = createArticle({ updatedAt: new Date('2026-04-10T00:00:00.000Z') });
    const article = createArticle({ updatedAt: new Date('2026-04-11T00:00:00.000Z') });
    const articleProvider = {
      getByIdOrPathnameWithPreNext: jest.fn().mockResolvedValue({ article }),
      getByOption: jest.fn(),
    };
    const cloudflareCacheProvider = createCloudflareCacheProvider();
    const provider = new ISRProvider(
      articleProvider as any,
      { generateRssFeed: jest.fn() } as any,
      { getHomePageSize: jest.fn(), generateSiteMap: jest.fn() } as any,
      {} as any,
      { generateSearchIndex: jest.fn() } as any,
      { clearArticleRelatedData: jest.fn().mockResolvedValue(undefined) } as any,
      cloudflareCacheProvider as any,
    );
    const activeUrl = jest.spyOn(provider, 'activeUrl').mockResolvedValue(undefined);
    const activeUrls = jest.spyOn(provider, 'activeUrls').mockResolvedValue(undefined);

    await provider.activeArticleById(7, 'update', beforeObj as any);

    expect(activeUrl).toHaveBeenCalledWith('/post/7', true);
    expect(activeUrl).toHaveBeenCalledWith('/post/stable-post', true);
    expect(activeUrl).not.toHaveBeenCalledWith('/', true);
    expect(activeUrls).toHaveBeenCalledWith(
      expect.arrayContaining(['/archive', '/archive/2024', '/archive/2024/01']),
      false,
    );

    const purgeUrls = cloudflareCacheProvider.purgeByTagsAndUrls.mock.calls[0][1] as string[];
    const purgeTags = cloudflareCacheProvider.purgeByTagsAndUrls.mock.calls[0][0] as string[];
    expect(purgeUrls).toEqual(expect.arrayContaining(['/archive', '/archive/2024', '/archive/2024/01']));
    expect(purgeUrls).not.toContain('/timeline');
    expect(purgeUrls).not.toContain('/tag');
    expect(purgeUrls).not.toContain('/category');
    expect(purgeTags).not.toContain('category-summary');
    expect(purgeTags).not.toContain('timeline-summary');
    expect(purgeTags).not.toContain('tag-hot');
    expect(purgeTags).not.toContain('tag-list');
    expect(articleProvider.getByOption).not.toHaveBeenCalled();
  });

  it('keeps create invalidation scoped to new article, entry pages, and archive routes without page pagination urls', async () => {
    const article = createArticle({ id: 8, pathname: 'new-edge-post', createdAt: new Date('2024-02-07T00:00:00.000Z') });
    const articleProvider = {
      getByIdOrPathnameWithPreNext: jest.fn().mockResolvedValue({ article }),
      getByOption: jest.fn().mockResolvedValue({
        articles: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, article],
        total: 6,
      }),
    };
    const searchIndexProvider = {
      generateSearchIndex: jest.fn(),
    };
    const rssProvider = {
      generateRssFeed: jest.fn(),
    };
    const sitemapProvider = {
      getHomePageSize: jest.fn().mockResolvedValue(5),
      generateSiteMap: jest.fn(),
    };
    const publicDataCacheProvider = {
      clearArticleRelatedData: jest.fn().mockResolvedValue(undefined),
    };
    const cloudflareCacheProvider = createCloudflareCacheProvider();
    const provider = new ISRProvider(
      articleProvider as any,
      rssProvider as any,
      sitemapProvider as any,
      {} as any,
      searchIndexProvider as any,
      publicDataCacheProvider as any,
      cloudflareCacheProvider as any,
    );
    const activeUrl = jest.spyOn(provider, 'activeUrl').mockResolvedValue(undefined);
    const activeUrls = jest.spyOn(provider, 'activeUrls').mockResolvedValue(undefined);

    await provider.activeArticleById(8, 'create');

    expect(activeUrl).toHaveBeenCalledWith('/post/8', true);
    expect(activeUrl).toHaveBeenCalledWith('/post/new-edge-post', true);
    expect(activeUrl).toHaveBeenCalledWith('/', true);
    expect(activeUrls).toHaveBeenCalledWith(
      expect.arrayContaining([
        '/archive',
        '/archive/2024',
        '/archive/2024/02',
        '/category/System Design',
        '/category/System Design/archive/2024',
        '/category/System Design/archive/2024/02',
        '/tag/Cloudflare',
        '/tag/Cloudflare/archive/2024',
        '/tag/Cloudflare/archive/2024/02',
        '/timeline',
        '/tag',
        '/category',
      ]),
      false,
    );
    expect(searchIndexProvider.generateSearchIndex).toHaveBeenCalledWith('文章 create 触发搜索索引更新', 1000);
    expect(rssProvider.generateRssFeed).toHaveBeenCalledWith('文章 create 触发 RSS 更新', 1000);
    expect(sitemapProvider.generateSiteMap).toHaveBeenCalledWith('文章 create 触发 SiteMap 更新', 1000);

    const purgeUrls = cloudflareCacheProvider.purgeByTagsAndUrls.mock.calls[0][1] as string[];
    expect(purgeUrls).toEqual(
      expect.arrayContaining([
        '/post/8',
        '/post/new-edge-post',
        '/',
        '/archive',
        '/archive/2024',
        '/archive/2024/02',
        '/timeline',
        '/tag',
        '/category',
      ]),
    );
    expect(purgeUrls).not.toContain('/page/2');
  });

  it('revalidates archive/category/tag/post groups during a full-site ISR run', async () => {
    const provider = new ISRProvider(
      {
        getById: jest.fn().mockResolvedValue(null),
      } as any,
      {} as any,
      {} as any,
      { getISRSetting: jest.fn().mockResolvedValue({ mode: 'immediate' }) } as any,
      {} as any,
      {} as any,
      createCloudflareCacheProvider() as any,
    );
    const activeUrls = jest.spyOn(provider, 'activeUrls').mockResolvedValue(undefined);
    const activePath = jest.spyOn(provider, 'activePath').mockResolvedValue(undefined);

    await provider.activeAllFn('manual');

    expect(activeUrls).toHaveBeenCalledWith(['/', '/archive', '/category', '/tag', '/timeline', '/about', '/link'], false);
    expect(activePath).toHaveBeenCalledWith('post', undefined);
    expect(activePath).toHaveBeenCalledWith('archive');
    expect(activePath).toHaveBeenCalledWith('category');
    expect(activePath).toHaveBeenCalledWith('tag');
    expect(activePath).not.toHaveBeenCalledWith('page');
  });

  it('still clears public caches and refreshes derived artifacts when website is disabled', async () => {
    process.env['VANBLOG_DISABLE_WEBSITE'] = 'true';
    const rssProvider = {
      generateRssFeed: jest.fn(),
    };
    const sitemapProvider = {
      generateSiteMap: jest.fn(),
    };
    const searchIndexProvider = {
      generateSearchIndex: jest.fn(),
    };
    const publicDataCacheProvider = {
      clearAllPublicData: jest.fn().mockResolvedValue(undefined),
    };
    const cloudflareCacheProvider = createCloudflareCacheProvider();
    const provider = new ISRProvider(
      {} as any,
      rssProvider as any,
      sitemapProvider as any,
      {} as any,
      searchIndexProvider as any,
      publicDataCacheProvider as any,
      cloudflareCacheProvider as any,
    );

    await provider.activeAll('disabled-mode');

    expect(publicDataCacheProvider.clearAllPublicData).toHaveBeenCalledTimes(1);
    expect(rssProvider.generateRssFeed).toHaveBeenCalledWith('disabled-mode', undefined);
    expect(sitemapProvider.generateSiteMap).toHaveBeenCalledWith('disabled-mode', undefined);
    expect(searchIndexProvider.generateSearchIndex).toHaveBeenCalledWith('disabled-mode', undefined);
    expect(cloudflareCacheProvider.purgeByTagsAndUrls).toHaveBeenCalledWith(
      ['html-public', 'html-post', 'html-listing', 'public-api', 'artifact:feed', 'artifact:sitemap', 'artifact:search-index'],
      ['/feed.xml', '/feed.json', '/atom.xml', '/sitemap.xml', '/static/search-index.json'],
      'disabled-mode',
    );
  });

  it('clears caches, rebuilds artifacts, and purges Cloudflare when full-site ISR runs normally', async () => {
    process.env['VANBLOG_DISABLE_WEBSITE'] = 'false';
    jest.spyOn(global, 'setTimeout').mockImplementation(((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        void handler();
      }
      return 1 as any;
    }) as any);

    const rssProvider = {
      generateRssFeed: jest.fn(),
    };
    const sitemapProvider = {
      generateSiteMap: jest.fn(),
    };
    const searchIndexProvider = {
      generateSearchIndex: jest.fn(),
    };
    const publicDataCacheProvider = {
      clearAllPublicData: jest.fn().mockResolvedValue(undefined),
    };
    const cloudflareCacheProvider = createCloudflareCacheProvider();
    const provider = new ISRProvider(
      {} as any,
      rssProvider as any,
      sitemapProvider as any,
      {} as any,
      searchIndexProvider as any,
      publicDataCacheProvider as any,
      cloudflareCacheProvider as any,
    );
    const activeAllFn = jest.spyOn(provider, 'activeAllFn').mockResolvedValue(undefined);
    const activeWithRetry = jest.spyOn(provider, 'activeWithRetry').mockImplementation(async (fn) => {
      if (typeof fn === 'function') {
        await fn();
      }
    });

    await provider.activeAll('full-refresh', 500, { forceActice: true });

    expect(publicDataCacheProvider.clearAllPublicData).toHaveBeenCalledTimes(1);
    expect(rssProvider.generateRssFeed).toHaveBeenCalledWith('full-refresh', 500);
    expect(sitemapProvider.generateSiteMap).toHaveBeenCalledWith('full-refresh', 500);
    expect(searchIndexProvider.generateSearchIndex).toHaveBeenCalledWith('full-refresh', 500);
    expect(activeWithRetry).toHaveBeenCalledTimes(1);
    expect(activeAllFn).toHaveBeenCalledWith('full-refresh', { forceActice: true });
    expect(cloudflareCacheProvider.purgeByTagsAndUrls).toHaveBeenCalledWith(
      ['html-public', 'html-post', 'html-listing', 'public-api', 'artifact:feed', 'artifact:sitemap', 'artifact:search-index'],
      ['/feed.xml', '/feed.json', '/atom.xml', '/sitemap.xml', '/static/search-index.json'],
      'full-refresh',
    );
  });
});
