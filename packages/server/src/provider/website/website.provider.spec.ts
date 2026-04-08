import axios from 'axios';
import { WebsiteProvider } from './website.provider';

jest.mock('axios');
jest.mock('src/utils/sleep', () => ({
  sleep: jest.fn().mockResolvedValue(true),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebsiteProvider', () => {
  const oldControlUrl = process.env['VANBLOG_WEBSITE_CONTROL_URL'];

  beforeEach(() => {
    mockedAxios.post.mockReset();
    process.env['VANBLOG_WEBSITE_CONTROL_URL'] = 'http://website:3011';
  });

  afterAll(() => {
    if (oldControlUrl === undefined) {
      delete process.env['VANBLOG_WEBSITE_CONTROL_URL'];
      return;
    }
    process.env['VANBLOG_WEBSITE_CONTROL_URL'] = oldControlUrl;
  });

  it('pushes runtime env updates to the external website controller', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

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

    expect(mockedAxios.post).toHaveBeenCalledWith('http://website:3011/restart', {
      env: expect.objectContaining({
        VAN_BLOG_REVALIDATE: 'true',
        VAN_BLOG_REVALIDATE_TIME: 60,
        VAN_BLOG_ALLOW_DOMAINS:
          'blog.example.com,cdn.example.com,wechat.example.com',
      }),
    });
  });

  it('retries external website sync after a temporary failure', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue({ status: 200, data: {} } as any);

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
    expect(mockedAxios.post).toHaveBeenLastCalledWith('http://website:3011/restart', {
      env: expect.objectContaining({
        VAN_BLOG_REVALIDATE: 'false',
        VAN_BLOG_ALLOW_DOMAINS: 'blog.example.com',
      }),
    });
  });
});
