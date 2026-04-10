import axios from 'axios';
import { CaddyProvider } from './caddy.provider';

jest.mock('axios');
jest.mock('src/utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(true),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CaddyProvider', () => {
  const oldEnv = process.env['VANBLOG_CADDY_API_URL'];
  const oldManageHttpsEnv = process.env['VAN_BLOG_CADDY_MANAGE_HTTPS'];

  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.patch.mockReset();
    mockedAxios.delete.mockReset();
    process.env['VANBLOG_CADDY_API_URL'] = 'http://caddy:2019/';
    process.env['VAN_BLOG_CADDY_MANAGE_HTTPS'] = 'true';
  });

  afterAll(() => {
    if (oldEnv === undefined) {
      delete process.env['VANBLOG_CADDY_API_URL'];
    } else {
      process.env['VANBLOG_CADDY_API_URL'] = oldEnv;
    }
    if (oldManageHttpsEnv === undefined) {
      delete process.env['VAN_BLOG_CADDY_MANAGE_HTTPS'];
    } else {
      process.env['VAN_BLOG_CADDY_MANAGE_HTTPS'] = oldManageHttpsEnv;
    }
  });

  it('uses the configured Caddy API base URL', async () => {
    mockedAxios.delete.mockResolvedValue({ status: 200, data: {} });
    mockedAxios.get.mockResolvedValue({ data: { ok: true } } as any);

    const provider = new CaddyProvider({
      getHttpsSetting: jest.fn().mockResolvedValue({ redirect: false }),
    } as any);

    await provider.init();
    mockedAxios.delete.mockClear();

    await provider.getConfig();

    expect(mockedAxios.get).toHaveBeenCalledWith('http://caddy:2019/config');
  });

  it('toggles redirect against the configured API server', async () => {
    mockedAxios.delete.mockResolvedValue({ status: 200, data: {} });
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    const provider = new CaddyProvider({
      getHttpsSetting: jest.fn().mockResolvedValue({ redirect: false }),
    } as any);

    await provider.setRedirect(true);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://caddy:2019/config/apps/http/servers/srv1/listener_wrappers',
      [{ wrapper: 'http_redirect' }],
    );
  });

  it('retries init until the Caddy API becomes reachable', async () => {
    mockedAxios.delete
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ status: 200, data: {} } as any);

    const provider = new CaddyProvider({
      getHttpsSetting: jest.fn().mockResolvedValue({ redirect: false }),
    } as any);

    await provider.init();

    expect(mockedAxios.delete).toHaveBeenCalledTimes(2);
  });

  it('skips https management when disabled', async () => {
    process.env['VAN_BLOG_CADDY_MANAGE_HTTPS'] = 'false';

    const provider = new CaddyProvider({
      getHttpsSetting: jest.fn().mockResolvedValue({ redirect: false }),
    } as any);

    await provider.init();

    expect(mockedAxios.delete).not.toHaveBeenCalled();
    expect(provider.isHttpsManagedByVanblog()).toBe(false);
  });
});
