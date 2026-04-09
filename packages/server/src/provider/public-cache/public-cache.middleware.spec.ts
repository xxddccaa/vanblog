import { PublicCacheMiddleware } from './public-cache.middleware';

describe('PublicCacheMiddleware', () => {
  const createRes = () => {
    const headers = new Map<string, string>();
    return {
      headers,
      setHeader: (key: string, value: string) => headers.set(key, value),
    };
  };

  it('marks live search responses as no-store', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use({ method: 'GET', path: '/api/public/search' } as any, res as any, jest.fn());
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('uses short cache headers for viewer fragments', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use({ method: 'GET', path: '/api/public/article/viewer/1' } as any, res as any, jest.fn());
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(res.headers.get('Surrogate-Control')).toContain('max-age=60');
  });

  it('uses edge-friendly cache headers for public JSON by default', () => {
    const middleware = new PublicCacheMiddleware();
    const res = createRes();
    middleware.use({ method: 'GET', path: '/api/public/article/1/nav' } as any, res as any, jest.fn());
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600');
    expect(res.headers.get('Surrogate-Control')).toContain('max-age=3600');
  });
});
