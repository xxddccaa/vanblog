describe('server config cloudflare integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.VAN_BLOG_CLOUDFLARE_API_TOKEN;
    delete process.env.VAN_BLOG_CLOUDFLARE_ZONE_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads Cloudflare purge credentials from environment variables', async () => {
    process.env.VAN_BLOG_CLOUDFLARE_API_TOKEN = 'cf-api-token';
    process.env.VAN_BLOG_CLOUDFLARE_ZONE_ID = 'cf-zone-id';

    let configModule: typeof import('./index');
    jest.isolateModules(() => {
      configModule = require('./index');
    });

    expect(configModule!.config.cloudflareApiToken).toBe('cf-api-token');
    expect(configModule!.config.cloudflareZoneId).toBe('cf-zone-id');
  });

  it('defaults Cloudflare purge credentials to empty strings when unset', async () => {
    let configModule: typeof import('./index');
    jest.isolateModules(() => {
      configModule = require('./index');
    });

    expect(configModule!.config.cloudflareApiToken).toBe('');
    expect(configModule!.config.cloudflareZoneId).toBe('');
  });

  it('keeps supporting the legacy env format without inserted camel-case underscores', async () => {
    process.env.VAN_BLOG_CLOUDFLARE_APITOKEN = 'legacy-token';
    process.env.VAN_BLOG_CLOUDFLARE_ZONEID = 'legacy-zone';

    let configModule: typeof import('./index');
    jest.isolateModules(() => {
      configModule = require('./index');
    });

    expect(configModule!.config.cloudflareApiToken).toBe('legacy-token');
    expect(configModule!.config.cloudflareZoneId).toBe('legacy-zone');
  });
});
