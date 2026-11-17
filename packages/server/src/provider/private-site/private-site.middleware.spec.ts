import {
  createPrivateSiteMiddleware,
  isOpenOnPrivateSite,
  normalizePrivateSitePath,
} from './private-site.middleware';
import { PrivateSiteProvider, readCookie } from './private-site.provider';

const createResponse = () => {
  const headers = new Map<string, string>();
  const res: any = {
    statusCode: 200,
    body: undefined,
    headers,
    setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
    removeHeader: (name: string) => headers.delete(name.toLowerCase()),
    writeHead: jest.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };
  return res;
};

const createProvider = ({
  privateSite = true,
  validTokens = ['good-token'],
}: { privateSite?: boolean; validTokens?: string[] } = {}) => {
  const metaProvider = {
    getSiteInfo: jest.fn(async () => ({ privateSite: privateSite ? 'true' : 'false' })),
  };
  const tokenProvider = {
    checkToken: jest.fn(async (token: string) => validTokens.includes(token)),
  };
  const cloudflare = { purgeEverything: jest.fn(async () => undefined) };
  const provider = new PrivateSiteProvider(
    metaProvider as any,
    tokenProvider as any,
    cloudflare as any,
  );
  return { provider, metaProvider, tokenProvider, cloudflare };
};

const run = async (
  provider: PrivateSiteProvider,
  url: string,
  headers: Record<string, string> = {},
) => {
  const req: any = { originalUrl: url, url, headers };
  const res = createResponse();
  const next = jest.fn();
  await createPrivateSiteMiddleware(provider)(req, res, next);
  return { res, next };
};

describe('private site gate', () => {
  const originalSecret = process.env.VANBLOG_ISR_TOKEN;

  beforeEach(() => {
    process.env.VANBLOG_ISR_TOKEN = 'internal-secret-value';
  });

  afterAll(() => {
    process.env.VANBLOG_ISR_TOKEN = originalSecret;
  });

  it('lets everything through when the site is not private', async () => {
    const { provider } = createProvider({ privateSite: false });
    const { next, res } = await run(provider, '/api/public/article/1');
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it.each([
    '/api/public/article/1',
    '/api/public/meta',
    '/api/public/search?value=x',
    '/API/PUBLIC/meta',
    '/rss/feed.xml',
    '/sitemap/sitemap.xml',
    '/static/search-index.json',
    '/static/customPage/demo/index.html',
    '/c/demo',
    '/static/img/../search-index.json',
    '/static/img/%2e%2e/search-index.json',
    '/static/img/..%2fsearch-index.json',
  ])('rejects anonymous access to %s on a private site', async (url) => {
    const { provider } = createProvider();
    const { next, res } = await run(provider, url);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it.each([
    '/api/public/site-info',
    '/api/public/private-site/access',
    '/api/admin/auth/login',
    '/static/img/abc.png',
    '/favicon.ico',
    '/api/public/article/2/admin',
  ])('keeps %s reachable on a private site', async (url) => {
    const { provider } = createProvider();
    const { next } = await run(provider, url);
    expect(next).toHaveBeenCalled();
  });

  it('accepts a valid session from the token header or the access cookie', async () => {
    const { provider } = createProvider();
    expect(
      (await run(provider, '/api/public/meta', { token: 'good-token' })).next,
    ).toHaveBeenCalled();
    expect(
      (await run(provider, '/api/public/meta', { cookie: 'theme=dark; vanblog_token=good-token' }))
        .next,
    ).toHaveBeenCalled();
    expect((await run(provider, '/api/public/meta', { token: 'bad-token' })).res.statusCode).toBe(
      401,
    );
  });

  it('accepts the website internal secret and nothing shorter or different', async () => {
    const { provider } = createProvider();
    expect(
      (
        await run(provider, '/api/public/meta', {
          'x-vanblog-internal-token': 'internal-secret-value',
        })
      ).next,
    ).toHaveBeenCalled();
    expect(
      (await run(provider, '/api/public/meta', { 'x-vanblog-internal-token': 'internal-secret' }))
        .res.statusCode,
    ).toBe(401);
  });

  it('marks authenticated private responses as non-cacheable', async () => {
    const { provider } = createProvider();
    const { res } = await run(provider, '/rss/feed.xml', { token: 'good-token' });
    res.setHeader('Cloudflare-CDN-Cache-Control', 'public, s-maxage=86400');
    res.setHeader('Cache-Tag', 'artifact:feed');
    res.writeHead(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(res.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
    expect(res.headers.has('cache-tag')).toBe(false);
  });

  it('purges the CDN only when the private site is switched on', async () => {
    const { provider, cloudflare } = createProvider();
    await provider.handleSiteInfoUpdated('false', 'true');
    await provider.handleSiteInfoUpdated('true', 'true');
    await provider.handleSiteInfoUpdated('true', 'false');
    expect(cloudflare.purgeEverything).toHaveBeenCalledTimes(1);
  });
});

describe('private site helpers', () => {
  it('normalizes paths and refuses ambiguous ones', () => {
    expect(normalizePrivateSitePath('/Static//IMG/a.png')).toBe('/static/img/a.png');
    expect(normalizePrivateSitePath('/static/img/../x')).toBeNull();
    expect(normalizePrivateSitePath('/static/img/%252e%252e/x')).toBeNull();
    expect(isOpenOnPrivateSite('/static/img/a.png?x=1')).toBe(true);
    expect(isOpenOnPrivateSite('/static/imgx/a.png')).toBe(false);
  });

  it('reads cookies by exact name', () => {
    const req = { headers: { cookie: 'xvanblog_token=no; vanblog_token=a%20b' } };
    expect(readCookie(req, 'vanblog_token')).toBe('a b');
  });
});
