import axios from 'axios';
import { config } from 'src/config';
import { WalineProvider } from './waline.provider';

jest.mock('axios');
jest.mock('src/utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(true),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WalineProvider', () => {
  const oldControlUrl = process.env['VANBLOG_WALINE_CONTROL_URL'];
  const oldControlToken = process.env['VANBLOG_WALINE_CONTROL_TOKEN'];
  const oldWalineDatabaseUrl = process.env['VAN_BLOG_WALINE_DATABASE_URL'];
  const oldWalineJwtToken = process.env['WALINE_JWT_TOKEN'];
  const oldJwtSecret = global.jwtSecret;
  const oldConfigWalineDatabaseUrl = config.walineDatabaseUrl;

  beforeEach(() => {
    mockedAxios.post.mockReset();
    process.env['VANBLOG_WALINE_CONTROL_URL'] = 'http://waline:8361';
    delete process.env['VAN_BLOG_WALINE_DATABASE_URL'];
    delete process.env['WALINE_JWT_TOKEN'];
    config.walineDatabaseUrl = '';
    global.jwtSecret = 'test-jwt-secret';
  });

  afterAll(() => {
    if (oldControlUrl === undefined) {
      delete process.env['VANBLOG_WALINE_CONTROL_URL'];
    } else {
      process.env['VANBLOG_WALINE_CONTROL_URL'] = oldControlUrl;
    }
    if (oldControlToken === undefined) {
      delete process.env['VANBLOG_WALINE_CONTROL_TOKEN'];
    } else {
      process.env['VANBLOG_WALINE_CONTROL_TOKEN'] = oldControlToken;
    }
    if (oldWalineDatabaseUrl === undefined) {
      delete process.env['VAN_BLOG_WALINE_DATABASE_URL'];
    } else {
      process.env['VAN_BLOG_WALINE_DATABASE_URL'] = oldWalineDatabaseUrl;
    }
    if (oldWalineJwtToken === undefined) {
      delete process.env['WALINE_JWT_TOKEN'];
    } else {
      process.env['WALINE_JWT_TOKEN'] = oldWalineJwtToken;
    }
    config.walineDatabaseUrl = oldConfigWalineDatabaseUrl;
    global.jwtSecret = oldJwtSecret;
  });

  it('pushes postgres waline env vars to the external waline controller', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);
    process.env['VAN_BLOG_WALINE_DATABASE_URL'] =
      'postgresql://waline-user:pg-pass@postgres:5432/waline?sslmode=require';
    process.env['WALINE_JWT_TOKEN'] = 'explicit-jwt-token';
    config.walineDatabaseUrl = process.env['VAN_BLOG_WALINE_DATABASE_URL'];

    const provider = new WalineProvider(
      {
        getSiteInfo: jest
          .fn()
          .mockResolvedValue({ siteName: 'VanBlog', baseUrl: 'https://blog.example.com' }),
      } as any,
      {
        getWalineSetting: jest.fn().mockResolvedValue({
          'smtp.enabled': false,
          authorEmail: 'author@example.com',
          forceLoginComment: true,
          otherConfig: '{"CUSTOM_ENV":"1","JWT_TOKEN":"evil","PG_PASSWORD":"evil"}',
        }),
      } as any,
    );

    await provider.run();

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://waline:8361/restart',
      {
        env: expect.objectContaining({
          PG_HOST: 'postgres',
          PG_PORT: '5432',
          PG_DB: 'waline',
          PG_USER: 'waline-user',
          PG_PASSWORD: 'pg-pass',
          PG_SSL: 'true',
          SITE_NAME: 'VanBlog',
          SITE_URL: 'https://blog.example.com',
          JWT_TOKEN: 'explicit-jwt-token',
          AUTHOR_EMAIL: 'author@example.com',
          LOGIN: 'force',
          CUSTOM_ENV: '1',
        }),
      },
      {
        headers: {
          'x-vanblog-control-token': 'explicit-jwt-token',
        },
      },
    );
  });

  it('ignores reserved waline env keys from otherConfig overrides', async () => {
    const provider = new WalineProvider(
      {
        getSiteInfo: jest.fn().mockResolvedValue({ siteName: 'VanBlog' }),
      } as any,
      {
        getWalineSetting: jest.fn().mockResolvedValue({
          'smtp.enabled': false,
          otherConfig: '{"JWT_TOKEN":"evil","SITE_URL":"https://evil.example","CUSTOM_ENV":"1"}',
        }),
      } as any,
    );
    const warnSpy = jest.spyOn(provider.logger, 'warn').mockImplementation(() => undefined);

    const env = provider.mapConfig2Env({
      'smtp.enabled': false,
      otherConfig: '{"JWT_TOKEN":"evil","SITE_URL":"https://evil.example","CUSTOM_ENV":"1"}',
    } as any);

    expect(env).toEqual({ CUSTOM_ENV: '1' });
    expect(warnSpy).toHaveBeenCalledWith('已忽略保留的 Waline 自定义环境变量: JWT_TOKEN');
    expect(warnSpy).toHaveBeenCalledWith('已忽略保留的 Waline 自定义环境变量: SITE_URL');
  });

  it('falls back to legacy Mongo compatibility env vars when no waline database url is provided', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);
    process.env['WALINE_JWT_TOKEN'] = 'test-jwt-secret';

    const provider = new WalineProvider(
      {
        getSiteInfo: jest.fn().mockResolvedValue({ siteName: 'VanBlog' }),
      } as any,
      {
        getWalineSetting: jest.fn().mockResolvedValue({
          'smtp.enabled': false,
        }),
      } as any,
    );

    await provider.run();

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://waline:8361/restart',
      {
        env: expect.objectContaining({
          MONGO_HOST: 'mongo',
          MONGO_PORT: '27017',
          MONGO_DB: 'waline',
          SITE_NAME: 'VanBlog',
          JWT_TOKEN: 'test-jwt-secret',
        }),
      },
      {
        headers: {
          'x-vanblog-control-token': 'test-jwt-secret',
        },
      },
    );
  });

  it('retries external waline sync after a temporary failure', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue({ status: 200, data: {} } as any);
    process.env['VAN_BLOG_WALINE_DATABASE_URL'] =
      'postgresql://waline-user:pg-pass@postgres:5432/waline';
    process.env['WALINE_JWT_TOKEN'] = 'test-jwt-secret';
    config.walineDatabaseUrl = process.env['VAN_BLOG_WALINE_DATABASE_URL'];

    const provider = new WalineProvider(
      {
        getSiteInfo: jest.fn().mockResolvedValue({ siteName: 'VanBlog' }),
      } as any,
      {
        getWalineSetting: jest.fn().mockResolvedValue({
          'smtp.enabled': false,
        }),
      } as any,
    );

    await provider.run();

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      'http://waline:8361/restart',
      {
        env: expect.objectContaining({
          PG_HOST: 'postgres',
          SITE_NAME: 'VanBlog',
        }),
      },
      {
        headers: {
          'x-vanblog-control-token': 'test-jwt-secret',
        },
      },
    );
  });

  it('rejects syncing the external waline controller when no control token is configured', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);
    delete process.env['WALINE_JWT_TOKEN'];
    delete process.env['VANBLOG_WALINE_CONTROL_TOKEN'];
    global.jwtSecret = undefined as any;

    const provider = new WalineProvider(
      {
        getSiteInfo: jest.fn().mockResolvedValue({ siteName: 'VanBlog' }),
      } as any,
      {
        getWalineSetting: jest.fn().mockResolvedValue({
          'smtp.enabled': false,
        }),
      } as any,
    );

    await expect(provider.run()).resolves.toBeUndefined();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('masks sensitive waline env values before logging', async () => {
    process.env['VAN_BLOG_WALINE_DATABASE_URL'] =
      'postgresql://waline-user:pg-pass@postgres:5432/waline';
    process.env['WALINE_JWT_TOKEN'] = 'explicit-jwt-token';
    config.walineDatabaseUrl = process.env['VAN_BLOG_WALINE_DATABASE_URL'];

    const provider = new WalineProvider(
      {
        getSiteInfo: jest.fn().mockResolvedValue({ siteName: 'VanBlog' }),
      } as any,
      {
        getWalineSetting: jest.fn().mockResolvedValue({
          'smtp.enabled': true,
          'smtp.password': 'smtp-secret',
        }),
      } as any,
    );
    const logSpy = jest.spyOn(provider.logger, 'log').mockImplementation(() => undefined);

    await provider.loadEnv();

    expect(provider.env).toEqual(
      expect.objectContaining({
        PG_PASSWORD: 'pg-pass',
        JWT_TOKEN: 'explicit-jwt-token',
        SMTP_PASS: 'smtp-secret',
      }),
    );
    const logMessages = logSpy.mock.calls.map((call) => String(call[0] || ''));
    expect(logMessages.some((message) => message.includes('"PG_PASSWORD": "***"'))).toBe(true);
    expect(logMessages.some((message) => message.includes('"JWT_TOKEN": "***"'))).toBe(true);
    expect(logMessages.some((message) => message.includes('"SMTP_PASS": "***"'))).toBe(true);
    expect(logMessages.some((message) => message.includes('pg-pass'))).toBe(false);
    expect(logMessages.some((message) => message.includes('explicit-jwt-token'))).toBe(false);
    expect(logMessages.some((message) => message.includes('smtp-secret'))).toBe(false);
  });
});
