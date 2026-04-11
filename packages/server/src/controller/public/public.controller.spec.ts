import { PublicController } from './public.controller';

describe('PublicController', () => {
  const createController = () => {
    const articleProvider = {
      getTotalNum: jest.fn().mockResolvedValue(12),
      getPublicArticleByIdOrPathname: jest.fn(),
      getArticleNavByIdOrPathname: jest.fn(),
      getByIdOrPathnameWithPreNext: jest.fn(),
      getByOption: jest.fn(),
      getAll: jest.fn().mockResolvedValue([
        {
          id: 9,
          title: 'Timeline Article',
          pathname: 'timeline-article',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      ]),
      getTimeLineSummary: jest.fn().mockResolvedValue([
        { year: '2026', articleCount: 1, updatedAt: '2026-04-10T00:00:00.000Z' },
      ]),
      getTimeLineArticlesByYear: jest.fn(),
      getTimeLineInfo: jest.fn().mockResolvedValue({
        "2026": [
          {
            id: 9,
            title: "Timeline Article",
            pathname: "timeline-article",
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-10T00:00:00.000Z",
          },
        ],
      }),
    };
    const categoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue(['System Design', 'NestJS']),
      getArticlesByCategory: jest.fn(),
      getCategorySummaries: jest.fn().mockResolvedValue([
        { name: 'Architecture', articleCount: 1, updatedAt: '2026-04-11T00:00:00.000Z' },
      ]),
      getCategoriesWithArticle: jest.fn().mockResolvedValue({
        Architecture: [
          {
            id: 8,
            title: "Category Article",
            pathname: "category-article",
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-11T00:00:00.000Z",
          },
        ],
      }),
    };
    const tagProvider = {
      getAllTags: jest.fn().mockResolvedValue(['Cloudflare', 'Caching', 'SEO']),
      getArticlesByTag: jest.fn().mockResolvedValue([
        {
          id: 6,
          title: 'Tagged Article',
          pathname: 'tagged-article',
          viewer: 33,
          visited: 21,
          commentCount: 4,
          likeCount: 2,
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      ]),
      getAllTagRecords: jest.fn().mockResolvedValue([
        { name: 'Cloudflare', createdAt: '2026-04-09T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' },
        { name: 'Caching', createdAt: '2026-04-10T00:00:00.000Z', updatedAt: '2026-04-11T00:00:00.000Z' },
      ]),
      getHotTags: jest.fn().mockResolvedValue([
        { name: 'Cloudflare', articleCount: 6, updatedAt: '2026-04-10T00:00:00.000Z' },
        { name: 'Caching', articleCount: 4, updatedAt: '2026-04-11T00:00:00.000Z' },
      ]),
      getTagsPaginated: jest.fn().mockResolvedValue({
        tags: [
          { name: 'Cloudflare', articleCount: 6, updatedAt: '2026-04-10T00:00:00.000Z' },
          { name: 'Caching', articleCount: 4, updatedAt: '2026-04-11T00:00:00.000Z' },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      }),
      getTagsWithArticle: jest.fn().mockResolvedValue([
        { name: 'Cloudflare', articleCount: 6 },
        { name: 'Caching', articleCount: 4 },
      ]),
    };
    const metaProvider = {
      addViewer: jest.fn().mockResolvedValue({ total: 1 }),
      getViewer: jest.fn().mockResolvedValue({ visited: 0, viewer: 0 }),
      getTotalWords: jest.fn().mockResolvedValue(2048),
      getAll: jest.fn().mockResolvedValue({
        updatedAt: '2026-04-11T00:00:00.000Z',
        about: {
          updatedAt: '2026-04-10T00:00:00.000Z',
          content: 'About content',
        },
        siteInfo: {
          updatedAt: '2026-04-09T00:00:00.000Z',
          siteName: 'VanBlog',
          siteDesc: 'desc',
          siteLogo: '/logo.png',
          favicon: '/favicon.ico',
          beianNumber: 'ICP',
          beianUrl: 'https://example.com',
          gaBeianNumber: '',
          gaBeianUrl: '',
          gaBeianLogoUrl: '',
          since: '2024',
          baseUrl: 'https://blog.example.com',
        },
        socials: [{ type: 'github', url: 'https://example.com' }],
        rewards: [{ name: 'wechat', value: '/wechat.png' }],
        links: [{ name: 'Docs', url: 'https://example.com/docs' }],
      }),
      getSiteInfo: jest.fn().mockResolvedValue({
        siteName: 'VanBlog',
        siteDesc: 'desc',
        siteLogo: '/logo.png',
        favicon: '/favicon.ico',
        beianNumber: 'ICP',
        beianUrl: 'https://example.com',
        gaBeianNumber: '',
        gaBeianUrl: '',
        gaBeianLogoUrl: '',
        since: '2024',
        baseUrl: 'https://blog.example.com',
      }),
      getSocials: jest.fn().mockResolvedValue([{ type: 'github', url: 'https://example.com' }]),
    };
    const settingProvider = {
      getMenuSetting: jest.fn().mockResolvedValue({
        data: [{ title: 'Home', value: '/' }],
      }),
      getMusicSettingRecord: jest.fn().mockResolvedValue({
        value: {
          autoPlay: false,
          listFolded: true,
        },
        updatedAt: '2026-04-10T00:00:00.000Z',
      }),
      getLayoutSetting: jest.fn().mockResolvedValue({
        updatedAt: '2026-04-08T00:00:00.000Z',
        layout: 'default',
      }),
      encodeLayoutSetting: jest.fn().mockReturnValue({
        layout: 'default',
      }),
    };
    const staticProvider = {
      getAll: jest.fn().mockResolvedValue([
        {
          title: 'Lofi',
          url: '/music/lofi.mp3',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      ]),
    };
    const customPageProvider = {
      getAll: jest.fn().mockResolvedValue([
        {
          path: '/c/edge',
          title: 'Edge Page',
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      ]),
      getCustomPageByPath: jest.fn().mockResolvedValue({
        path: '/c/edge',
        title: 'Edge Page',
        html: '<p>Edge</p>',
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:00.000Z',
      }),
    };
    const visitProvider = {
      getByArticleId: jest.fn().mockResolvedValue({ viewer: 0, visited: 0 }),
    };
    const iconProvider = {
      getAllIcons: jest.fn().mockResolvedValue([
        { name: 'github', createdAt: '2026-04-08T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' },
      ]),
      getIconByName: jest.fn().mockResolvedValue({
        name: 'github',
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-10T00:00:00.000Z',
      }),
    };
    const cacheStore = new Map<string, any>();
    const cacheProvider = {
      get: jest.fn().mockImplementation(async (key: string) => cacheStore.get(key) ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: any) => {
        cacheStore.set(key, value);
      }),
    };
    const walineProvider = {
      getCommentCount: jest.fn().mockResolvedValue(6),
    };

    const controller = new PublicController(
      articleProvider as any,
      categoryProvider as any,
      tagProvider as any,
      metaProvider as any,
      visitProvider as any,
      settingProvider as any,
      customPageProvider as any,
      {} as any,
      iconProvider as any,
      staticProvider as any,
      cacheProvider as any,
      {} as any,
      walineProvider as any,
    );

    return {
      controller,
      articleProvider,
      categoryProvider,
      tagProvider,
      metaProvider,
      settingProvider,
      staticProvider,
      customPageProvider,
      visitProvider,
      iconProvider,
      cacheProvider,
      walineProvider,
    };
  };

  const createRes = () => ({
    headers: new Map<string, string>(),
    setHeader(key: string, value: string) {
      this.headers.set(key, value);
    },
  });

  it('skips viewer updates when referer is missing', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {},
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: null,
    });
    expect(metaProvider.addViewer).not.toHaveBeenCalled();
  });

  it('skips viewer updates when referer is invalid', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {
        referer: 'not-a-valid-url',
      },
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: null,
    });
    expect(metaProvider.addViewer).not.toHaveBeenCalled();
  });

  it('records the decoded referer pathname when referer is valid', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {
        referer: 'https://blog.example.com/post/test%20article',
      },
    } as any);

    expect(metaProvider.addViewer).toHaveBeenCalledWith(true, '/post/test article', false);
    expect(result).toEqual({
      statusCode: 200,
      data: { total: 1 },
    });
  });

  it('caches public icon responses to reduce repeated provider queries', async () => {
    const { controller, iconProvider, cacheProvider } = createController();
    const res = createRes();

    const first = await controller.getAllIcons(res as any);
    const second = await controller.getAllIcons(res as any);

    expect(first).toEqual({
      statusCode: 200,
      data: [
        { name: 'github', createdAt: '2026-04-08T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' },
      ],
    });
    expect(second).toEqual(first);
    expect(iconProvider.getAllIcons).toHaveBeenCalledTimes(1);
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:icon:all',
      [{ name: 'github', createdAt: '2026-04-08T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' }],
      300,
    );
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('caches public site stats to keep sidebar fragments edge-friendly', async () => {
    const {
      controller,
      articleProvider,
      categoryProvider,
      tagProvider,
      metaProvider,
      cacheProvider,
    } = createController();

    (metaProvider as any).getAll = jest.fn().mockResolvedValue({
      updatedAt: '2026-04-11T00:00:00.000Z',
      about: { updatedAt: '2026-04-10T00:00:00.000Z' },
    });
    const res = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
    };

    const first = await controller.getSiteStats(res as any);
    const second = await controller.getSiteStats(res as any);

    expect(first).toEqual({
      statusCode: 200,
      data: {
        postNum: 12,
        categoryNum: 2,
        tagNum: 3,
        totalWordCount: 2048,
      },
    });
    expect(second).toEqual(first);
    expect(articleProvider.getTotalNum).toHaveBeenCalledTimes(1);
    expect(categoryProvider.getAllCategories).toHaveBeenCalledTimes(1);
    expect(tagProvider.getAllTags).toHaveBeenCalledTimes(1);
    expect(metaProvider.getTotalWords).toHaveBeenCalledTimes(1);
    expect(metaProvider.getAll).toHaveBeenCalledTimes(1);
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:site-stats',
      {
        __lastModified: '2026-04-11T00:00:00.000Z',
        data: {
          postNum: 12,
          categoryNum: 2,
          tagNum: 3,
          totalWordCount: 2048,
        },
      },
      300,
    );
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('unwraps cached site stats envelopes without leaking cache metadata fields', async () => {
    const {
      controller,
      articleProvider,
      categoryProvider,
      tagProvider,
      metaProvider,
      cacheProvider,
    } = createController();
    const res = createRes();

    await cacheProvider.set(
      'public:site-stats',
      {
        __lastModified: '2026-04-10T00:00:00.000Z',
        data: {
          postNum: 12,
          categoryNum: 2,
          tagNum: 3,
          totalWordCount: 2048,
        },
      },
      300,
    );

    const result = await controller.getSiteStats(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        postNum: 12,
        categoryNum: 2,
        tagNum: 3,
        totalWordCount: 2048,
      },
    });
    expect((result.data as any).__lastModified).toBeUndefined();
    expect(articleProvider.getTotalNum).not.toHaveBeenCalled();
    expect(categoryProvider.getAllCategories).not.toHaveBeenCalled();
    expect(tagProvider.getAllTags).not.toHaveBeenCalled();
    expect(metaProvider.getTotalWords).not.toHaveBeenCalled();
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for custom page listings so stable pages can revalidate cleanly', async () => {
    const { controller, customPageProvider } = createController();
    const res = createRes();

    const result = await controller.getAll(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [
        {
          path: '/c/edge',
          title: 'Edge Page',
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      ],
    });
    expect(customPageProvider.getAll).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for individual custom pages and keeps encoded html payloads', async () => {
    const { controller, customPageProvider } = createController();
    const res = createRes();

    const result = await controller.getOneByPath('/c/edge', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        path: '/c/edge',
        title: 'Edge Page',
        html: 'PHA+RWRnZTwvcD4=',
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:00.000Z',
      },
    });
    expect(customPageProvider.getCustomPageByPath).toHaveBeenCalledWith('/c/edge');
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for public meta payloads even when served from cache', async () => {
    const { controller, cacheProvider } = createController();
    const res = createRes();

    const first = await controller.getBuildMeta(res as any);
    const second = await controller.getBuildMeta(res as any);

    expect(first.statusCode).toBe(200);
    expect(first.data.meta.updatedAt).toBe('2026-04-11T00:00:00.000Z');
    expect(second).toEqual(first);
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:meta',
      expect.objectContaining({
        meta: expect.objectContaining({
          updatedAt: '2026-04-11T00:00:00.000Z',
        }),
      }),
      30,
    );
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for public site-info without exposing cache metadata fields', async () => {
    const { controller, metaProvider } = createController();
    const res = createRes();

    const result = await controller.getBasicSiteInfo(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        siteName: 'VanBlog',
        siteDesc: 'desc',
        siteLogo: '/logo.png',
        favicon: '/favicon.ico',
        beianNumber: 'ICP',
        beianUrl: 'https://example.com',
        gaBeianNumber: '',
        gaBeianUrl: '',
        gaBeianLogoUrl: '',
        since: '2024',
        baseUrl: 'https://blog.example.com',
      },
    });
    expect(metaProvider.getAll).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect((result.data as any).__lastModified).toBeUndefined();
  });

  it('caches public site-info envelopes so repeated sidebar reads do not re-query meta', async () => {
    const { controller, metaProvider, cacheProvider } = createController();
    const res = createRes();

    const first = await controller.getBasicSiteInfo(res as any);
    const second = await controller.getBasicSiteInfo(res as any);

    expect(first).toEqual({
      statusCode: 200,
      data: {
        siteName: 'VanBlog',
        siteDesc: 'desc',
        siteLogo: '/logo.png',
        favicon: '/favicon.ico',
        beianNumber: 'ICP',
        beianUrl: 'https://example.com',
        gaBeianNumber: '',
        gaBeianUrl: '',
        gaBeianLogoUrl: '',
        since: '2024',
        baseUrl: 'https://blog.example.com',
      },
    });
    expect(second).toEqual(first);
    expect(metaProvider.getAll).toHaveBeenCalledTimes(1);
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:site-info',
      {
        __lastModified: '2026-04-11T00:00:00.000Z',
        data: {
          siteName: 'VanBlog',
          siteDesc: 'desc',
          siteLogo: '/logo.png',
          favicon: '/favicon.ico',
          beianNumber: 'ICP',
          beianUrl: 'https://example.com',
          gaBeianNumber: '',
          gaBeianUrl: '',
          gaBeianLogoUrl: '',
          since: '2024',
          baseUrl: 'https://blog.example.com',
        },
      },
      300,
    );
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect((second.data as any).__lastModified).toBeUndefined();
  });

  it('sets Last-Modified for global viewer fragments so they can revalidate instead of hard-miss', async () => {
    const { controller, metaProvider } = createController();
    const res = createRes();

    const result = await controller.getViewer(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: { visited: 0, viewer: 0 },
    });
    expect(metaProvider.getViewer).toHaveBeenCalledTimes(1);
    expect(metaProvider.getAll).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for article viewer fragments from the latest visit timestamp', async () => {
    const { controller, visitProvider } = createController();
    const res = createRes();
    visitProvider.getByArticleId.mockResolvedValue({
      viewer: 21,
      visited: 13,
      lastVisitedTime: '2026-04-10T00:00:00.000Z',
      createdAt: '2026-04-08T00:00:00.000Z',
    });

    const result = await controller.getViewerByArticleIdOrPathname('edge-cache', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        viewer: 21,
        visited: 13,
        lastVisitedTime: '2026-04-10T00:00:00.000Z',
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    });
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for tag article expansion payloads and strips dynamic counters', async () => {
    const { controller, tagProvider } = createController();
    const articleProvider = (controller as any).articleProvider;
    articleProvider.toPublic = jest.fn((articles: any[]) => articles);
    const res = createRes();

    const result = await controller.getArticlesByTagName('Cloudflare', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [
        {
          id: 6,
          title: 'Tagged Article',
          pathname: 'tagged-article',
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      ],
    });
    expect(tagProvider.getArticlesByTag).toHaveBeenCalledWith('Cloudflare', false);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for timeline summary maps so year buckets can revalidate cleanly', async () => {
    const { controller, articleProvider } = createController();
    const res = createRes();

    const result = await controller.getTimeLineInfo(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        "2026": [
          {
            id: 9,
            title: "Timeline Article",
            pathname: "timeline-article",
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-10T00:00:00.000Z",
          },
        ],
      },
    });
    expect(articleProvider.getTimeLineInfo).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for timeline summary fragments from the newest visible article timestamp', async () => {
    const { controller, articleProvider } = createController();
    const res = createRes();

    const result = await controller.getTimeLineSummary(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [{ year: '2026', articleCount: 1, updatedAt: '2026-04-10T00:00:00.000Z' }],
    });
    expect(articleProvider.getTimeLineSummary).toHaveBeenCalledTimes(1);
    expect(articleProvider.getAll).toHaveBeenCalledWith('list', false, false);
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('reuses cached timeline summary payloads while still deriving validators from visible articles', async () => {
    const { controller, articleProvider } = createController();
    const res = createRes();

    const first = await controller.getTimeLineSummary(res as any);
    const second = await controller.getTimeLineSummary(res as any);

    expect(first).toEqual({
      statusCode: 200,
      data: [{ year: '2026', articleCount: 1, updatedAt: '2026-04-10T00:00:00.000Z' }],
    });
    expect(second).toEqual(first);
    expect(articleProvider.getTimeLineSummary).toHaveBeenCalledTimes(1);
    expect(articleProvider.getAll).toHaveBeenCalledTimes(2);
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for category index payloads from the newest article they expose', async () => {
    const { controller, categoryProvider } = createController();
    const res = createRes();

    const result = await controller.getArticlesByCategory(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        Architecture: [
          {
            id: 8,
            title: "Category Article",
            pathname: "category-article",
            createdAt: "2026-04-08T00:00:00.000Z",
            updatedAt: "2026-04-11T00:00:00.000Z",
          },
        ],
      },
    });
    expect(categoryProvider.getCategoriesWithArticle).toHaveBeenCalledWith(false);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for category summary fragments from the newest category timestamp', async () => {
    const { controller, categoryProvider } = createController();
    const res = createRes();
    categoryProvider.getAllCategories.mockResolvedValue([
      { name: 'Architecture', createdAt: '2026-04-09T00:00:00.000Z', updatedAt: '2026-04-11T00:00:00.000Z' },
      { name: 'Caching', createdAt: '2026-04-08T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' },
    ]);

    const result = await controller.getCategorySummary(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [{ name: 'Architecture', articleCount: 1, updatedAt: '2026-04-11T00:00:00.000Z' }],
    });
    expect(categoryProvider.getCategorySummaries).toHaveBeenCalledWith(false);
    expect(categoryProvider.getAllCategories).toHaveBeenCalledWith(true);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('reuses cached category summary payloads while preserving Last-Modified for revalidation', async () => {
    const { controller, categoryProvider } = createController();
    const res = createRes();
    categoryProvider.getAllCategories.mockResolvedValue([
      { name: 'Architecture', createdAt: '2026-04-09T00:00:00.000Z', updatedAt: '2026-04-11T00:00:00.000Z' },
      { name: 'Caching', createdAt: '2026-04-08T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' },
    ]);

    const first = await controller.getCategorySummary(res as any);
    const second = await controller.getCategorySummary(res as any);

    expect(first).toEqual({
      statusCode: 200,
      data: [{ name: 'Architecture', articleCount: 1, updatedAt: '2026-04-11T00:00:00.000Z' }],
    });
    expect(second).toEqual(first);
    expect(categoryProvider.getCategorySummaries).toHaveBeenCalledTimes(1);
    expect(categoryProvider.getAllCategories).toHaveBeenCalledTimes(2);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for public music setting fragments', async () => {
    const { controller, settingProvider } = createController();
    const res = createRes();

    const result = await controller.getMusicSetting(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        autoPlay: false,
        listFolded: true,
      },
    });
    expect(settingProvider.getMusicSettingRecord).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for public music lists so static media fragments revalidate cleanly', async () => {
    const { controller, staticProvider } = createController();
    const res = createRes();

    const result = await controller.getMusicList(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [
        {
          title: 'Lofi',
          url: '/music/lofi.mp3',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      ],
    });
    expect(staticProvider.getAll).toHaveBeenCalledWith('music', 'public');
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for individual public icons', async () => {
    const { controller, iconProvider } = createController();
    const res = createRes();

    const result = await controller.getIconByName('github', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        name: 'github',
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-10T00:00:00.000Z',
      },
    });
    expect(iconProvider.getIconByName).toHaveBeenCalledWith('github');
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for hot tag fragments so tag overviews stay edge-revalidatable', async () => {
    const { controller, tagProvider } = createController();
    const res = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
    };

    const result = await controller.getHotTags('20', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [
        { name: 'Cloudflare', articleCount: 6, updatedAt: '2026-04-10T00:00:00.000Z' },
        { name: 'Caching', articleCount: 4, updatedAt: '2026-04-11T00:00:00.000Z' },
      ],
    });
    expect(tagProvider.getHotTags).toHaveBeenCalledWith(20);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for paginated tag fragments and keeps them cacheable', async () => {
    const { controller, tagProvider } = createController();
    const res = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
    };

    const result = await controller.getTagsPaginated('1', '50', 'articleCount', 'desc', '', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        tags: [
          { name: 'Cloudflare', articleCount: 6, updatedAt: '2026-04-10T00:00:00.000Z' },
          { name: 'Caching', articleCount: 4, updatedAt: '2026-04-11T00:00:00.000Z' },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
    });
    expect(tagProvider.getTagsPaginated).toHaveBeenCalledWith(1, 50, 'articleCount', 'desc', '');
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified for the complete tag listing payload', async () => {
    const { controller, tagProvider } = createController();
    const res = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
    };

    const result = await controller.getArticlesByTag(res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [
        { name: 'Cloudflare', articleCount: 6 },
        { name: 'Caching', articleCount: 4 },
      ],
    });
    expect(tagProvider.getTagsWithArticle).toHaveBeenCalledWith(false);
    expect(tagProvider.getAllTagRecords).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('returns article shells without viewer counters to keep HTML stable', async () => {
    const { controller, articleProvider } = createController();
    const res = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
    };
    articleProvider.getPublicArticleByIdOrPathname.mockResolvedValue({
      id: 7,
      title: 'Edge Cache',
      pathname: 'edge-cache',
      viewer: 99,
      visited: 66,
      commentCount: 12,
      likeCount: 5,
      updatedAt: '2026-04-11T00:00:00.000Z',
      lastVisitedTime: '2026-01-01T00:00:00.000Z',
    });

    const result = await controller.getArticleByIdOrPathname('edge-cache', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        article: {
          id: 7,
          title: 'Edge Cache',
          pathname: 'edge-cache',
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      },
    });
    expect(articleProvider.getPublicArticleByIdOrPathname).toHaveBeenCalledWith('edge-cache', 'public');
    expect(articleProvider.getByIdOrPathnameWithPreNext).not.toHaveBeenCalled();
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('keeps pre/next lookups isolated behind the nav fragment endpoint', async () => {
    const { controller, articleProvider } = createController();
    const res = createRes();
    articleProvider.getArticleNavByIdOrPathname.mockResolvedValue({
      pre: {
        id: 6,
        title: 'Older Post',
        pathname: 'older-post',
        updatedAt: '2026-04-10T00:00:00.000Z',
      },
      next: {
        id: 8,
        title: 'Newer Post',
        pathname: 'newer-post',
        updatedAt: '2026-04-11T00:00:00.000Z',
      },
    });

    const result = await controller.getArticleNavByIdOrPathname('edge-cache', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        pre: {
          id: 6,
          title: 'Older Post',
          pathname: 'older-post',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
        next: {
          id: 8,
          title: 'Newer Post',
          pathname: 'newer-post',
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      },
    });
    expect(articleProvider.getArticleNavByIdOrPathname).toHaveBeenCalledWith('edge-cache', 'public');
    expect(articleProvider.getPublicArticleByIdOrPathname).not.toHaveBeenCalled();
    expect(articleProvider.getByIdOrPathnameWithPreNext).not.toHaveBeenCalled();
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('caches engagement payloads behind a dedicated public fragment endpoint', async () => {
    const { controller, cacheProvider, walineProvider } = createController();
    const articleProvider = (controller as any).articleProvider;
    const visitProvider = (controller as any).visitProvider;
    const res = createRes();
    articleProvider.getPublicArticleByIdOrPathname = jest.fn().mockResolvedValue({
      id: 7,
      pathname: 'edge-cache',
      updatedAt: '2026-04-10T00:00:00.000Z',
    });
    visitProvider.getByArticleId = jest.fn().mockResolvedValue({
      viewer: 12,
      visited: 8,
      lastVisitedTime: '2026-04-11T00:00:00.000Z',
    });

    const first = await controller.getArticleEngagement('edge-cache', res as any);
    const second = await controller.getArticleEngagement('edge-cache', res as any);

    expect(first).toEqual({
      statusCode: 200,
      data: {
        viewer: 12,
        visited: 8,
        commentCount: 6,
      },
    });
    expect(second).toEqual(first);
    expect(walineProvider.getCommentCount).toHaveBeenCalledWith('/post/edge-cache');
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:article:engagement:edge-cache',
      {
        __lastModified: '2026-04-11T00:00:00.000Z',
        data: {
          viewer: 12,
          visited: 8,
          commentCount: 6,
        },
      },
      60,
    );
    expect(articleProvider.getPublicArticleByIdOrPathname).toHaveBeenCalledTimes(1);
    expect(visitProvider.getByArticleId).toHaveBeenCalledTimes(1);
    expect(walineProvider.getCommentCount).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('unwraps cached engagement envelopes without leaking cache metadata to clients', async () => {
    const { controller, cacheProvider, walineProvider } = createController();
    const articleProvider = (controller as any).articleProvider;
    const visitProvider = (controller as any).visitProvider;
    const res = createRes();

    await cacheProvider.set(
      'public:article:engagement:edge-cache',
      {
        __lastModified: '2026-04-11T00:00:00.000Z',
        data: {
          viewer: 12,
          visited: 8,
          commentCount: 6,
        },
      },
      60,
    );

    const result = await controller.getArticleEngagement('edge-cache', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        viewer: 12,
        visited: 8,
        commentCount: 6,
      },
    });
    expect((result.data as any).__lastModified).toBeUndefined();
    expect(articleProvider.getPublicArticleByIdOrPathname).not.toHaveBeenCalled();
    expect(visitProvider.getByArticleId).not.toHaveBeenCalled();
    expect(walineProvider.getCommentCount).not.toHaveBeenCalled();
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('derives fragment validators from the newest timestamp even when sources mix Date objects and strings', async () => {
    const { controller, walineProvider, cacheProvider } = createController();
    const articleProvider = (controller as any).articleProvider;
    const res = createRes();
    articleProvider.getPublicArticleByIdOrPathname = jest.fn().mockResolvedValue({
      id: 7,
      pathname: 'edge-cache',
      updatedAt: new Date('2026-04-09T00:00:00.000Z'),
      createdAt: '2026-04-08T00:00:00.000Z',
    });
    articleProvider.getRelatedPublicArticles = jest.fn().mockResolvedValue([
      {
        id: 2,
        title: 'related',
        updatedAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ]);
    articleProvider.getLatestPublicArticles = jest.fn().mockResolvedValue([
      {
        id: 3,
        title: 'latest',
        updatedAt: '2026-04-12T00:00:00.000Z',
      },
    ]);
    articleProvider.getHotPublicArticles = jest.fn().mockResolvedValue([
      {
        id: 4,
        title: 'hot',
        updatedAt: new Date('2026-04-11T00:00:00.000Z'),
      },
    ]);

    const result = await controller.getArticleFragments('edge-cache', '4', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        commentCount: 6,
        related: [{ id: 2, title: 'related', updatedAt: new Date('2026-04-10T00:00:00.000Z') }],
        latest: [{ id: 3, title: 'latest', updatedAt: '2026-04-12T00:00:00.000Z' }],
        hot: [{ id: 4, title: 'hot', updatedAt: new Date('2026-04-11T00:00:00.000Z') }],
      },
    });
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:article:fragments:edge-cache:4',
      {
        __lastModified: '2026-04-12T00:00:00.000Z',
        data: {
          commentCount: 6,
          related: [{ id: 2, title: 'related', updatedAt: new Date('2026-04-10T00:00:00.000Z') }],
          latest: [{ id: 3, title: 'latest', updatedAt: '2026-04-12T00:00:00.000Z' }],
          hot: [{ id: 4, title: 'hot', updatedAt: new Date('2026-04-11T00:00:00.000Z') }],
        },
      },
      120,
    );
    expect(walineProvider.getCommentCount).toHaveBeenCalledWith('/post/edge-cache');
    expect(articleProvider.getPublicArticleByIdOrPathname).toHaveBeenCalledTimes(1);
    expect(articleProvider.getRelatedPublicArticles).toHaveBeenCalledTimes(1);
    expect(articleProvider.getLatestPublicArticles).toHaveBeenCalledTimes(1);
    expect(articleProvider.getHotPublicArticles).toHaveBeenCalledTimes(1);
    expect(walineProvider.getCommentCount).toHaveBeenCalledTimes(1);
    expect(res.headers.get('Last-Modified')).toBe('Sun, 12 Apr 2026 00:00:00 GMT');
  });

  it('unwraps cached fragment envelopes without leaking cache metadata to clients', async () => {
    const { controller, cacheProvider, walineProvider } = createController();
    const articleProvider = (controller as any).articleProvider;
    const res = createRes();
    articleProvider.getPublicArticleByIdOrPathname = jest.fn();
    articleProvider.getRelatedPublicArticles = jest.fn();
    articleProvider.getLatestPublicArticles = jest.fn();
    articleProvider.getHotPublicArticles = jest.fn();

    await cacheProvider.set(
      'public:article:fragments:edge-cache:4',
      {
        __lastModified: '2026-04-12T00:00:00.000Z',
        data: {
          commentCount: 6,
          related: [{ id: 2, title: 'related', updatedAt: '2026-04-10T00:00:00.000Z' }],
          latest: [{ id: 3, title: 'latest', updatedAt: '2026-04-12T00:00:00.000Z' }],
          hot: [{ id: 4, title: 'hot', updatedAt: '2026-04-11T00:00:00.000Z' }],
        },
      },
      120,
    );

    const result = await controller.getArticleFragments('edge-cache', '4', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        commentCount: 6,
        related: [{ id: 2, title: 'related', updatedAt: '2026-04-10T00:00:00.000Z' }],
        latest: [{ id: 3, title: 'latest', updatedAt: '2026-04-12T00:00:00.000Z' }],
        hot: [{ id: 4, title: 'hot', updatedAt: '2026-04-11T00:00:00.000Z' }],
      },
    });
    expect((result.data as any).__lastModified).toBeUndefined();
    expect(articleProvider.getPublicArticleByIdOrPathname).not.toHaveBeenCalled();
    expect(articleProvider.getRelatedPublicArticles).not.toHaveBeenCalled();
    expect(articleProvider.getLatestPublicArticles).not.toHaveBeenCalled();
    expect(articleProvider.getHotPublicArticles).not.toHaveBeenCalled();
    expect(walineProvider.getCommentCount).not.toHaveBeenCalled();
    expect(res.headers.get('Last-Modified')).toBe('Sun, 12 Apr 2026 00:00:00 GMT');
  });

  it('returns article lists as stable shells without viewer counters', async () => {
    const { controller, articleProvider } = createController();
    const res = createRes();
    articleProvider.getByOption.mockResolvedValue({
      total: 1,
      articles: [
        {
          id: 7,
          title: 'Edge Cache',
          pathname: 'edge-cache',
          viewer: 99,
          visited: 66,
          commentCount: 12,
          likeCount: 5,
          createdAt: '2026-04-09T00:00:00.000Z',
          lastVisitedTime: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      ],
    });

    const result = await controller.getByOption(
      1 as any,
      5 as any,
      false as any,
      false as any,
      false as any,
      false as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      res as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: {
        total: 1,
        articles: [
          {
            id: 7,
            title: 'Edge Cache',
            pathname: 'edge-cache',
            createdAt: '2026-04-09T00:00:00.000Z',
            updatedAt: '2026-04-11T00:00:00.000Z',
          },
        ],
      },
    });
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('returns category expansion payloads as stable shells without viewer counters', async () => {
    const { controller, categoryProvider } = createController();
    const res = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
    };
    categoryProvider.getArticlesByCategory.mockResolvedValue([
      {
        id: 8,
        title: 'Category Article',
        pathname: 'category-article',
        viewer: 22,
        visited: 11,
        commentCount: 3,
        likeCount: 2,
        lastVisitedTime: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:00.000Z',
      },
    ]);

    const result = await controller.getArticlesByCategoryName('Architecture', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [
        {
          id: 8,
          title: 'Category Article',
          pathname: 'category-article',
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      ],
    });
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('returns timeline expansion payloads as stable shells without viewer counters', async () => {
    const { controller, articleProvider } = createController();
    const res = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
    };
    articleProvider.getTimeLineArticlesByYear.mockResolvedValue([
      {
        id: 9,
        title: 'Timeline Article',
        pathname: 'timeline-article',
        viewer: 18,
        visited: 9,
        commentCount: 4,
        likeCount: 1,
        lastVisitedTime: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-04-10T00:00:00.000Z',
      },
    ]);

    const result = await controller.getTimeLineArticlesByYear('2026', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: [
        {
          id: 9,
          title: 'Timeline Article',
          pathname: 'timeline-article',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      ],
    });
    expect(res.headers.get('Last-Modified')).toBe('Fri, 10 Apr 2026 00:00:00 GMT');
  });

  it('caches post fragment payloads to keep dynamic blocks out of HTML', async () => {
    const { controller, walineProvider, cacheProvider } = createController();
    const articleProvider = (controller as any).articleProvider;
    const res = createRes();
    articleProvider.getPublicArticleByIdOrPathname = jest.fn().mockResolvedValue({
      id: 7,
      pathname: 'edge-cache',
      tags: ['Cloudflare'],
      category: 'Architecture',
      updatedAt: '2026-04-09T00:00:00.000Z',
    });
    articleProvider.getRelatedPublicArticles = jest
      .fn()
      .mockResolvedValue([
        {
          id: 2,
          title: 'related',
          viewer: 10,
          visited: 8,
          commentCount: 5,
          likeCount: 1,
          lastVisitedTime: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      ]);
    articleProvider.getLatestPublicArticles = jest
      .fn()
      .mockResolvedValue([
        {
          id: 3,
          title: 'latest',
          viewer: 7,
          visited: 6,
          commentCount: 4,
          likeCount: 2,
          lastVisitedTime: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-04-12T00:00:00.000Z',
        },
      ]);
    articleProvider.getHotPublicArticles = jest.fn().mockResolvedValue([
      {
        id: 4,
        title: 'hot',
        viewer: 5,
        visited: 4,
        commentCount: 3,
        likeCount: 1,
        lastVisitedTime: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:00.000Z',
      },
    ]);

    const first = await controller.getArticleFragments('edge-cache', '4', res as any);
    const second = await controller.getArticleFragments('edge-cache', '4', res as any);

    expect(first).toEqual({
      statusCode: 200,
      data: {
        commentCount: 6,
        related: [{ id: 2, title: 'related', updatedAt: '2026-04-10T00:00:00.000Z' }],
        latest: [{ id: 3, title: 'latest', updatedAt: '2026-04-12T00:00:00.000Z' }],
        hot: [{ id: 4, title: 'hot', updatedAt: '2026-04-11T00:00:00.000Z' }],
      },
    });
    expect(second).toEqual(first);
    expect(walineProvider.getCommentCount).toHaveBeenCalledWith('/post/edge-cache');
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:article:fragments:edge-cache:4',
      {
        __lastModified: '2026-04-12T00:00:00.000Z',
        data: {
          commentCount: 6,
          related: [{ id: 2, title: 'related', updatedAt: '2026-04-10T00:00:00.000Z' }],
          latest: [{ id: 3, title: 'latest', updatedAt: '2026-04-12T00:00:00.000Z' }],
          hot: [{ id: 4, title: 'hot', updatedAt: '2026-04-11T00:00:00.000Z' }],
        },
      },
      120,
    );
    expect(res.headers.get('Last-Modified')).toBe('Sun, 12 Apr 2026 00:00:00 GMT');
  });

  it('normalizes oversized fragment limits so cache keys stay bounded', async () => {
    const { controller, walineProvider, cacheProvider } = createController();
    const articleProvider = (controller as any).articleProvider;
    const res = createRes();
    articleProvider.getPublicArticleByIdOrPathname = jest.fn().mockResolvedValue({
      id: 7,
      pathname: 'edge-cache',
      updatedAt: '2026-04-09T00:00:00.000Z',
    });
    articleProvider.getRelatedPublicArticles = jest.fn().mockResolvedValue([]);
    articleProvider.getLatestPublicArticles = jest.fn().mockResolvedValue([]);
    articleProvider.getHotPublicArticles = jest.fn().mockResolvedValue([]);

    const result = await controller.getArticleFragments('edge-cache', '99', res as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        commentCount: 6,
        related: [],
        latest: [],
        hot: [],
      },
    });
    expect(articleProvider.getRelatedPublicArticles).toHaveBeenCalledWith('edge-cache', 8);
    expect(articleProvider.getLatestPublicArticles).toHaveBeenCalledWith(8, 7);
    expect(articleProvider.getHotPublicArticles).toHaveBeenCalledWith(8, 7);
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:article:fragments:edge-cache:8',
      {
        __lastModified: '2026-04-09T00:00:00.000Z',
        data: {
          commentCount: 6,
          related: [],
          latest: [],
          hot: [],
        },
      },
      120,
    );
    expect(walineProvider.getCommentCount).toHaveBeenCalledWith('/post/edge-cache');
    expect(res.headers.get('Last-Modified')).toBe('Thu, 09 Apr 2026 00:00:00 GMT');
  });
});
