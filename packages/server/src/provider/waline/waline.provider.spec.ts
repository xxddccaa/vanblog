import axios from 'axios';
import { WalineProvider } from './waline.provider';

jest.mock('axios');
jest.mock('src/utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(true),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WalineProvider', () => {
  const oldControlUrl = process.env['VANBLOG_WALINE_CONTROL_URL'];
  const oldJwtSecret = global.jwtSecret;

  beforeEach(() => {
    mockedAxios.post.mockReset();
    process.env['VANBLOG_WALINE_CONTROL_URL'] = 'http://waline:8361';
    global.jwtSecret = 'test-jwt-secret';
  });

  afterAll(() => {
    if (oldControlUrl === undefined) {
      delete process.env['VANBLOG_WALINE_CONTROL_URL'];
    } else {
      process.env['VANBLOG_WALINE_CONTROL_URL'] = oldControlUrl;
    }
    global.jwtSecret = oldJwtSecret;
  });

  it('pushes mapped waline env vars to the external waline controller', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    const provider = new WalineProvider(
      {
        getSiteInfo: jest.fn().mockResolvedValue({ siteName: 'VanBlog' }),
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
        MONGO_HOST: 'mongo',
        MONGO_PORT: '27017',
        MONGO_DB: 'waline',
        SITE_NAME: 'VanBlog',
        JWT_TOKEN: 'test-jwt-secret',
        AUTHOR_EMAIL: 'author@example.com',
        LOGIN: 'force',
        CUSTOM_ENV: '1',
      }),
    });
  });

  it('retries external waline sync after a temporary failure', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue({ status: 200, data: {} } as any);

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
        MONGO_HOST: 'mongo',
        SITE_NAME: 'VanBlog',
      }),
    });
  });
});
