describe('loadConfig env key mapping', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.VAN_BLOG_CLOUDFLARE_API_TOKEN;
    delete process.env.VAN_BLOG_CLOUDFLARE_APITOKEN;
    delete process.env.VAN_BLOG_CADDY_MANAGE_HTTPS;
    delete process.env.VAN_BLOG_CADDY_MANAGEHTTPS;
    delete process.env.VAN_BLOG_CODE_RUNNER_PATH;
    delete process.env.VAN_BLOG_CODERUNNER_PATH;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('maps camelCase config keys to underscore-separated env vars', () => {
    const { loadConfig } = require('./loadConfig');
    process.env.VAN_BLOG_CLOUDFLARE_API_TOKEN = 'cf-token';
    process.env.VAN_BLOG_CADDY_MANAGE_HTTPS = 'true';
    process.env.VAN_BLOG_CODE_RUNNER_PATH = '/tmp/code-runner';

    expect(loadConfig('cloudflare.apiToken', '')).toBe('cf-token');
    expect(loadConfig('caddy.manageHttps', false)).toBe('true');
    expect(loadConfig('codeRunner.path', '/app/codeRunner')).toBe('/tmp/code-runner');
  });

  it('keeps supporting the legacy env naming without camelCase underscores', () => {
    const { loadConfig } = require('./loadConfig');
    process.env.VAN_BLOG_CLOUDFLARE_APITOKEN = 'legacy-token';
    process.env.VAN_BLOG_CADDY_MANAGEHTTPS = 'legacy-true';
    process.env.VAN_BLOG_CODERUNNER_PATH = '/legacy/code-runner';

    expect(loadConfig('cloudflare.apiToken', '')).toBe('legacy-token');
    expect(loadConfig('caddy.manageHttps', false)).toBe('legacy-true');
    expect(loadConfig('codeRunner.path', '/app/codeRunner')).toBe('/legacy/code-runner');
  });

  it('prefers the new underscore-separated env name when both formats are present', () => {
    const { loadConfig } = require('./loadConfig');
    process.env.VAN_BLOG_CLOUDFLARE_API_TOKEN = 'new-token';
    process.env.VAN_BLOG_CLOUDFLARE_APITOKEN = 'legacy-token';

    expect(loadConfig('cloudflare.apiToken', '')).toBe('new-token');
  });
});
