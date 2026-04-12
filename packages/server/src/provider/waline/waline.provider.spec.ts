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
          otherConfig: '{"CUSTOM_ENV":"1"}',
        }),
      } as any,
    );

    await provider.run();

    expect(mockedAxios.post).toHaveBeenCalledWith('http://waline:8361/restart', {
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
    });
  });

  it('falls back to legacy mongo env vars when no waline database url is provided', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

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

    expect(mockedAxios.post).toHaveBeenCalledWith('http://waline:8361/restart', {
      env: expect.objectContaining({
        MONGO_HOST: 'mongo',
        MONGO_PORT: '27017',
        MONGO_DB: 'waline',
        SITE_NAME: 'VanBlog',
        JWT_TOKEN: 'test-jwt-secret',
      }),
    });
  });

  it('retries external waline sync after a temporary failure', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue({ status: 200, data: {} } as any);
    process.env['VAN_BLOG_WALINE_DATABASE_URL'] =
      'postgresql://waline-user:pg-pass@postgres:5432/waline';
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
    expect(mockedAxios.post).toHaveBeenLastCalledWith('http://waline:8361/restart', {
      env: expect.objectContaining({
        PG_HOST: 'postgres',
        SITE_NAME: 'VanBlog',
      }),
    });
  });
});
