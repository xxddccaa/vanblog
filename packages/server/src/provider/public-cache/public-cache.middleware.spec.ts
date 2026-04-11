import { PublicCacheMiddleware } from './public-cache.middleware';

describe('PublicCacheMiddleware', () => {
  const createRes = () => {
    const headers = new Map<string, string>();
    return {
      headers,
      setHeader: (key: string, value: string) => headers.set(key, value),
      getHeader: (key: string) => headers.get(key),
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send: jest.fn(),
      json(body: any) {
        return body;
      },
    };
  };

  it('marks live search responses as no-store', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use({ method: 'GET', path: '/api/public/search' } as any, res as any, jest.fn());
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('marks unified search responses as no-store', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use({ method: 'GET', path: '/api/public/search/all' } as any, res as any, jest.fn());
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('marks admin nav payloads as no-store even though they sit under the public prefix', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use({ method: 'GET', path: '/api/public/nav/admin-data' } as any, res as any, jest.fn());
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('marks public write requests as no-store', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use({ method: 'POST', path: '/api/public/viewer' } as any, res as any, jest.fn());
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('keeps public cache eligibility for anonymous preference cookies', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          cookie: 'theme=dark; locale=zh-CN',
        },
      } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
  });

  it('bypasses public cache for authenticated cookies', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          cookie: 'theme=dark; token=secret',
        },
      } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('also bypasses public cache for legacy sessionid cookies', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          cookie: 'theme=dark; sessionid=legacy-session',
        },
      } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('bypasses public cache for authorization headers', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          authorization: 'Bearer edge-cache-secret',
        },
      } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('bypasses public cache for token headers', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          token: 'edge-cache-secret',
        },
      } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('bypasses public cache for custom auth-like headers', () => {
    const middleware = new PublicCacheMiddleware();
    const debugRes = createRes();
    const apiKeyRes = createRes();

    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          'x-debug-super-token': 'debug-secret',
        },
      } as any,
      debugRes as any,
      jest.fn(),
    );
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          'x-api-key': 'edge-cache-secret',
        },
      } as any,
      apiKeyRes as any,
      jest.fn(),
    );

    expect(debugRes.headers.get('Cache-Control')).toBe('no-store');
    expect(debugRes.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
    expect(apiKeyRes.headers.get('Cache-Control')).toBe('no-store');
    expect(apiKeyRes.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('falls back to no-store when a public response tries to set cookies', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article/1', headers: {} } as any,
      res as any,
      jest.fn(),
    );

    res.setHeader('Set-Cookie', 'sid=edge-cache');

    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('CDN-Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
  });

  it('uses short cache headers for viewer fragments', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article/viewer/1' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=15');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Tag')).toContain('post:1');
  });

  it('keeps the public viewer aggregate on the same short cache policy as other engagement reads', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/viewer' } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Control')).toContain('max-age=15');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Tag')).toContain('public-api');
    expect(res.headers.get('Cache-Tag')).not.toContain('article-shell');
  });

  it('uses short cache headers for public comment fragments without adding vary noise', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/comment/list' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=15');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Tag')).toContain('public-api');
    expect(res.headers.get('Vary')).toBeUndefined();
  });

  it('uses edge-friendly cache headers for public JSON by default', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article/1/nav' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cache-Tag')).toContain('article-nav');
  });

  it('keeps article shell endpoints on the stable public-json cache policy with dedicated shell tags', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article/edge-cache' } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cache-Tag')).toContain('article-shell');
    expect(res.headers.get('Cache-Tag')).toContain('post:edge-cache');
    expect(res.headers.get('Cache-Tag')).not.toContain('article-engagement');
    expect(res.headers.get('Cache-Tag')).not.toContain('article-ranking');
  });

  it('tags article listing endpoints separately from per-article fragments so list purges can stay coarse', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article', query: {} } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cache-Tag')).toContain('article-listing');
    expect(res.headers.get('Cache-Tag')).toContain('site-stats');
    expect(res.headers.get('Cache-Tag')).toContain('home');
    expect(res.headers.get('Cache-Tag')).not.toContain('article-shell');
    expect(res.headers.get('Cache-Tag')).not.toContain('article-engagement');
  });

  it('adds category and tag cache tags to filtered article listing endpoints so purges can stay precise', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article',
        query: {
          category: 'System Design',
          tags: 'Cloudflare',
        },
      } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Tag')).toContain('article-listing');
    expect(res.headers.get('Cache-Tag')).toContain('category:system-design');
    expect(res.headers.get('Cache-Tag')).toContain('tag:cloudflare');
    expect(res.headers.get('Cache-Tag')).not.toContain('home');
  });

  it('keeps stable fragment endpoints on the longer public-json cache policy', () => {
    const middleware = new PublicCacheMiddleware();
    const siteStatsRes = createRes();
    const timelineSummaryRes = createRes();
    const categorySummaryRes = createRes();

    middleware.use(
      { method: 'GET', path: '/api/public/site-stats' } as any,
      siteStatsRes as any,
      jest.fn(),
    );
    middleware.use(
      { method: 'GET', path: '/api/public/timeline/summary' } as any,
      timelineSummaryRes as any,
      jest.fn(),
    );
    middleware.use(
      { method: 'GET', path: '/api/public/category/summary' } as any,
      categorySummaryRes as any,
      jest.fn(),
    );

    for (const res of [siteStatsRes, timelineSummaryRes, categorySummaryRes]) {
      expect(res.headers.get('Cache-Control')).toContain('max-age=60');
      expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=3600');
      expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
    }
    expect(siteStatsRes.headers.get('Cache-Tag')).toContain('site-stats');
    expect(timelineSummaryRes.headers.get('Cache-Tag')).toContain('timeline-summary');
    expect(categorySummaryRes.headers.get('Cache-Tag')).toContain('category-summary');
  });

  it('keeps anonymous HEAD requests cacheable without cookie or user-agent vary headers', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'HEAD',
        path: '/api/public/site-stats',
        headers: {
          cookie: 'theme=dark; locale=zh-CN',
          'user-agent': 'cache-probe',
        },
      } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cache-Tag')).toContain('site-stats');
    expect(res.headers.get('Vary')).toBeUndefined();
  });

  it('keeps anonymous HEAD requests for article listings cacheable without cookie or user-agent vary headers', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'HEAD',
        path: '/api/public/article',
        query: {},
        headers: {
          cookie: 'theme=dark; locale=zh-CN',
          'user-agent': 'cache-probe',
        },
      } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cache-Tag')).toContain('article-listing');
    expect(res.headers.get('Cache-Tag')).toContain('site-stats');
    expect(res.headers.get('Cache-Tag')).toContain('home');
    expect(res.headers.get('Vary')).toBeUndefined();
  });

  it('tags paginated tag fragments separately from hot tags so purge scope can stay precise', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/tags/paginated' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Cache-Tag')).toContain('tag-list');
    expect(res.headers.get('Cache-Tag')).not.toContain('tag-hot');
  });

  it('tags expanded tag article fragments with their tag cache tag', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/tag-articles/Cloudflare' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Tag')).toContain('tag-articles');
    expect(res.headers.get('Cache-Tag')).toContain('tag:cloudflare');
  });

  it('tags public meta and site-info payloads so non-article changes can purge them precisely', () => {
    const middleware = new PublicCacheMiddleware();
    const metaRes = createRes();
    const siteInfoRes = createRes();

    middleware.use({ method: 'GET', path: '/api/public/meta' } as any, metaRes as any, jest.fn());
    middleware.use(
      { method: 'GET', path: '/api/public/site-info' } as any,
      siteInfoRes as any,
      jest.fn(),
    );

    expect(metaRes.headers.get('Cache-Tag')).toContain('public-meta');
    expect(siteInfoRes.headers.get('Cache-Tag')).toContain('site-info');
    expect(siteInfoRes.headers.get('Cache-Control')).toContain('max-age=60');
    expect(siteInfoRes.headers.get('CDN-Cache-Control')).toContain('s-maxage=3600');
    expect(siteInfoRes.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=3600');
  });

  it('tags custom pages, icons, and music payloads as dedicated public fragments', () => {
    const middleware = new PublicCacheMiddleware();
    const customPageRes = createRes();
    const iconRes = createRes();
    const musicRes = createRes();

    middleware.use(
      { method: 'GET', path: '/api/public/customPage/all' } as any,
      customPageRes as any,
      jest.fn(),
    );
    middleware.use(
      { method: 'GET', path: '/api/public/icon/github' } as any,
      iconRes as any,
      jest.fn(),
    );
    middleware.use(
      { method: 'GET', path: '/api/public/music/list' } as any,
      musicRes as any,
      jest.fn(),
    );

    expect(customPageRes.headers.get('Cache-Tag')).toContain('custom-page-list');
    expect(iconRes.headers.get('Cache-Tag')).toContain('icon-public');
    expect(musicRes.headers.get('Cache-Tag')).toContain('music-public');
  });

  it('tags expanded category article fragments with their category cache tag', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/category/System%20Design/articles' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Tag')).toContain('category-articles');
    expect(res.headers.get('Cache-Tag')).toContain('category:system-design');
  });

  it('tags expanded timeline article fragments with their year cache tag', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/timeline/2026/articles' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Tag')).toContain('timeline-articles');
    expect(res.headers.get('Cache-Tag')).toContain('timeline:2026');
  });

  it('uses a shorter dedicated cache policy for public moment feeds', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/moment' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=30');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Tag')).toContain('moment-public');
  });

  it('uses a dedicated medium cache policy for public nav data', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/nav/data' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=900');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=900');
    expect(res.headers.get('Cache-Tag')).toContain('nav-public');
  });

  it('keeps anonymous HEAD requests for public nav data cacheable without vary noise', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'HEAD',
        path: '/api/public/nav/data',
        headers: {
          cookie: 'theme=dark; locale=zh-CN',
          'user-agent': 'cache-probe',
        },
      } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=900');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=900');
    expect(res.headers.get('Cache-Tag')).toContain('nav-public');
    expect(res.headers.get('Vary')).toBeUndefined();
  });

  it('keeps anonymous HEAD requests for public comment fragments cacheable without vary noise', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'HEAD',
        path: '/api/public/comment/list',
        headers: {
          cookie: 'theme=dark; locale=zh-CN',
          'user-agent': 'cache-probe',
        },
      } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Control')).toContain('max-age=15');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Tag')).toContain('public-api');
    expect(res.headers.get('Vary')).toBeUndefined();
  });

  it('keeps anonymous HEAD requests for the public viewer aggregate cacheable without vary noise', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'HEAD',
        path: '/api/public/viewer',
        headers: {
          cookie: 'theme=dark; locale=zh-CN',
          'user-agent': 'cache-probe',
        },
      } as any,
      res as any,
      jest.fn(),
    );

    expect(res.headers.get('Cache-Control')).toContain('max-age=15');
    expect(res.headers.get('CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Tag')).toContain('public-api');
    expect(res.headers.get('Vary')).toBeUndefined();
  });

  it('uses shorter edge cache for post fragments that mix rankings and comment counts', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article/edge-cache/fragments' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Tag')).toContain('article-fragments');
  });

  it('uses short cache headers for engagement fragments', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article/edge-cache/engagement' } as any,
      res as any,
      jest.fn(),
    );
    expect(res.headers.get('Cache-Control')).toContain('max-age=15');
    expect(res.headers.get('Cloudflare-CDN-Cache-Control')).toContain('s-maxage=300');
    expect(res.headers.get('Cache-Tag')).toContain('article-engagement');
  });

  it('adds strong etag and last-modified validators for public JSON responses', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article/1', headers: {} } as any,
      res as any,
      jest.fn(),
    );
    res.json({
      statusCode: 200,
      data: {
        article: {
          id: 1,
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      },
    });
    expect(res.headers.get('ETag')).toMatch(/^"[a-f0-9]+"$/);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('returns 304 when if-none-match matches the generated etag', () => {
    const middleware = new PublicCacheMiddleware();
    const firstRes = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/article/1', headers: {} } as any,
      firstRes as any,
      jest.fn(),
    );
    firstRes.json({
      statusCode: 200,
      data: {
        article: {
          id: 1,
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      },
    });

    const secondRes = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          'if-none-match': firstRes.headers.get('ETag'),
        },
      } as any,
      secondRes as any,
      jest.fn(),
    );
    secondRes.json({
      statusCode: 200,
      data: {
        article: {
          id: 1,
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      },
    });

    expect(secondRes.statusCode).toBe(304);
    expect(secondRes.send).toHaveBeenCalled();
  });

  it('returns 304 when if-modified-since matches the latest public payload timestamp', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/article/1',
        headers: {
          'if-modified-since': 'Sat, 11 Apr 2026 00:00:00 GMT',
        },
      } as any,
      res as any,
      jest.fn(),
    );

    res.json({
      statusCode: 200,
      data: {
        article: {
          id: 1,
          updatedAt: '2026-04-11T00:00:00.000Z',
        },
      },
    });

    expect(res.statusCode).toBe(304);
    expect(res.send).toHaveBeenCalled();
  });

  it('returns 304 for stable fragments when controllers pre-set Last-Modified headers', () => {
    const middleware = new PublicCacheMiddleware();
    const firstRes = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/site-stats', headers: {} } as any,
      firstRes as any,
      jest.fn(),
    );
    firstRes.setHeader('Last-Modified', 'Sat, 11 Apr 2026 00:00:00 GMT');
    firstRes.json({
      statusCode: 200,
      data: {
        postNum: 12,
        categoryNum: 2,
        tagNum: 3,
        totalWordCount: 2048,
      },
    });

    const secondRes = createRes();
    middleware.use(
      {
        method: 'GET',
        path: '/api/public/site-stats',
        headers: {
          'if-modified-since': 'Sat, 11 Apr 2026 00:00:00 GMT',
        },
      } as any,
      secondRes as any,
      jest.fn(),
    );
    secondRes.setHeader('Last-Modified', 'Sat, 11 Apr 2026 00:00:00 GMT');
    secondRes.json({
      statusCode: 200,
      data: {
        postNum: 12,
        categoryNum: 2,
        tagNum: 3,
        totalWordCount: 2048,
      },
    });

    expect(firstRes.headers.get('ETag')).toMatch(/^"[a-f0-9]+"$/);
    expect(secondRes.statusCode).toBe(304);
    expect(secondRes.send).toHaveBeenCalled();
  });

  it('reuses controller-supplied Last-Modified values when generating etags for stable fragments', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use(
      { method: 'GET', path: '/api/public/site-stats', headers: {} } as any,
      res as any,
      jest.fn(),
    );

    res.setHeader('Last-Modified', 'Sat, 11 Apr 2026 00:00:00 GMT');
    res.json({
      statusCode: 200,
      data: {
        postNum: 12,
        categoryNum: 2,
        tagNum: 3,
        totalWordCount: 2048,
      },
    });

    expect(res.headers.get('ETag')).toMatch(/^"[a-f0-9]+"$/);
    expect(res.headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });
});
