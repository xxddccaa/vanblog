import axios from 'axios';
import { WebsiteProvider } from './website.provider';

jest.mock('axios');
jest.mock('src/utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(true),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebsiteProvider', () => {
  const oldControlUrl = process.env['VANBLOG_WEBSITE_CONTROL_URL'];
  const oldIsrToken = process.env['VANBLOG_ISR_TOKEN'];
  const oldSharedSecret = process.env['VANBLOG_SHARED_SECRET'];
  const oldLegacySharedSecret = process.env['WALINE_JWT_TOKEN'];
  const oldWebsiteControlToken = process.env['VANBLOG_WEBSITE_CONTROL_TOKEN'];

  beforeEach(() => {
    mockedAxios.post.mockReset();
    process.env['VANBLOG_WEBSITE_CONTROL_URL'] = 'http://website:3011';
    delete process.env['VANBLOG_ISR_TOKEN'];
    delete process.env['VANBLOG_SHARED_SECRET'];
    delete process.env['WALINE_JWT_TOKEN'];
    delete process.env['VANBLOG_WEBSITE_CONTROL_TOKEN'];
  });

  afterAll(() => {
    if (oldControlUrl === undefined) {
      delete process.env['VANBLOG_WEBSITE_CONTROL_URL'];
    } else {
      process.env['VANBLOG_WEBSITE_CONTROL_URL'] = oldControlUrl;
    }
    if (oldIsrToken === undefined) {
      delete process.env['VANBLOG_ISR_TOKEN'];
    } else {
      process.env['VANBLOG_ISR_TOKEN'] = oldIsrToken;
    }
    for (const [key, value] of [
      ['VANBLOG_SHARED_SECRET', oldSharedSecret],
      ['WALINE_JWT_TOKEN', oldLegacySharedSecret],
      ['VANBLOG_WEBSITE_CONTROL_TOKEN', oldWebsiteControlToken],
    ] as const) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('pushes runtime env updates to the external website controller', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);
    process.env['VANBLOG_ISR_TOKEN'] = 'website-control-secret';

    const provider = new WebsiteProvider(
      {
        getAll: jest.fn().mockResolvedValue({
          siteInfo: {
            baseUrl: 'https://blog.example.com',
            siteLogo: 'https://cdn.example.com/logo.png',
          },
          socials: [{ type: 'wechat', value: 'https://wechat.example.com/qr.png' }],
        }),
      } as any,
      {
        getISRSetting: jest.fn().mockResolvedValue({ mode: 'delay', delay: 60 }),
      } as any,
    );

    await provider.run();

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://website:3011/restart',
      {
        env: expect.objectContaining({
          VAN_BLOG_REVALIDATE: 'true',
          VAN_BLOG_REVALIDATE_TIME: 60,
          VAN_BLOG_ALLOW_DOMAINS:
            'blog.example.com,cdn.example.com,wechat.example.com',
        }),
      },
      {
        headers: {
          'x-vanblog-control-token': 'website-control-secret',
        },
      },
    );
  });

  it('retries external website sync after a temporary failure', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue({ status: 200, data: {} } as any);
    process.env['VANBLOG_ISR_TOKEN'] = 'website-control-secret';

    const provider = new WebsiteProvider(
      {
        getAll: jest.fn().mockResolvedValue({
          siteInfo: {
            baseUrl: 'https://blog.example.com',
          },
          socials: [],
        }),
      } as any,
      {
        getISRSetting: jest.fn().mockResolvedValue({ mode: 'realTime' }),
      } as any,
    );

    await provider.run();

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      'http://website:3011/restart',
      {
        env: expect.objectContaining({
          VAN_BLOG_REVALIDATE: 'false',
          VAN_BLOG_ALLOW_DOMAINS: 'blog.example.com',
        }),
      },
      {
        headers: {
          'x-vanblog-control-token': 'website-control-secret',
        },
      },
    );
  });

  it('rejects syncing the external website controller when no control token is configured', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    const provider = new WebsiteProvider(
      {
        getAll: jest.fn().mockResolvedValue({
          siteInfo: {
            baseUrl: 'https://blog.example.com',
          },
          socials: [],
        }),
      } as any,
      {
        getISRSetting: jest.fn().mockResolvedValue({ mode: 'realTime' }),
      } as any,
    );

    await expect(provider.run()).resolves.toBeUndefined();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('masks website control secrets before logging runtime env', async () => {
    process.env['VANBLOG_ISR_TOKEN'] = 'website-control-secret';
    process.env['VANBLOG_SHARED_SECRET'] = 'shared-site-secret';

    const provider = new WebsiteProvider(
      {
        getAll: jest.fn().mockResolvedValue({
          siteInfo: {
            baseUrl: 'https://blog.example.com',
          },
          socials: [],
        }),
      } as any,
      {
        getISRSetting: jest.fn().mockResolvedValue({ mode: 'delay', delay: 60 }),
      } as any,
    );
    const logSpy = jest.spyOn(provider.logger, 'log').mockImplementation(() => undefined);

    provider.isExternalControlMode = jest.fn().mockReturnValue(false);
    provider.ctx = {} as any;
    await provider.run();

    const logMessages = logSpy.mock.calls.map((call) => String(call[0] || ''));
    expect(logMessages.some((message) => message.includes('"VANBLOG_ISR_TOKEN": "***"'))).toBe(
      true,
    );
    expect(logMessages.some((message) => message.includes('"VANBLOG_SHARED_SECRET": "***"'))).toBe(
      true,
    );
    expect(
      logMessages.some(
        (message) =>
          message.includes('website-control-secret') || message.includes('shared-site-secret'),
      ),
    ).toBe(false);
  });

  it.each([
    [
      { VANBLOG_SHARED_SECRET: 'shared-site-secret', WALINE_JWT_TOKEN: 'legacy-secret' },
      'shared-site-secret',
    ],
    [{ WALINE_JWT_TOKEN: 'legacy-secret' }, 'legacy-secret'],
  ])(
    'falls back to the shared secret for website control and ISR env (%o)',
    async (env, expected) => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);
      Object.assign(process.env, env);

      const provider = new WebsiteProvider(
        {
          getAll: jest.fn().mockResolvedValue({
            siteInfo: { baseUrl: 'https://blog.example.com' },
            socials: [],
          }),
        } as any,
        {
          getISRSetting: jest.fn().mockResolvedValue({ mode: 'realTime' }),
        } as any,
      );

      await provider.run();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://website:3011/restart',
        {
          env: expect.objectContaining({
            VANBLOG_ISR_TOKEN: expected,
            VANBLOG_SHARED_SECRET: expected,
          }),
        },
        {
          headers: {
            'x-vanblog-control-token': expected,
          },
        },
      );
      const payloadEnv = mockedAxios.post.mock.calls[0][1] as { env: Record<string, unknown> };
      expect(payloadEnv.env).not.toHaveProperty('WALINE_JWT_TOKEN');
    },
  );
});
