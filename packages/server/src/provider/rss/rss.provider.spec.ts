import fs from 'fs';
import { Feed } from 'feed';
import { config } from 'src/config';
import { RssProvider } from './rss.provider';

jest.mock('fs');
jest.mock('feed', () => {
  return {
    Feed: jest.fn().mockImplementation(() => ({
      addItem: jest.fn(),
      json1: jest.fn(() => '{"version":"https://jsonfeed.org/version/1.1"}'),
      rss2: jest.fn(() => '<rss />'),
      atom1: jest.fn(() => '<feed />'),
    })),
  };
});

describe('RssProvider', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const FeedMock = Feed as jest.MockedClass<typeof Feed>;
  const originalStaticPath = config.staticPath;

  beforeEach(() => {
    jest.clearAllMocks();
    config.staticPath = '/tmp/vanblog-static';
    mockedFs.mkdirSync.mockImplementation(() => undefined as any);
    mockedFs.writeFileSync.mockImplementation(() => undefined as any);
  });

  afterAll(() => {
    config.staticPath = originalStaticPath;
  });

  const createProvider = () =>
    new RssProvider(
      {
        getAll: jest.fn().mockResolvedValue([
          {
            id: 7,
            title: 'Edge Cache Post',
            pathname: 'edge-cache-post',
            category: 'Caching',
            content: 'post body',
            private: false,
            createdAt: '2026-04-10T00:00:00.000Z',
            updatedAt: '2026-04-11T00:00:00.000Z',
          },
        ]),
      } as any,
      {
        getAll: jest.fn().mockResolvedValue({
          siteInfo: {
            baseUrl: 'https://blog.example.com',
            siteName: 'VanBlog',
            siteDesc: 'Cache first',
            author: 'Author',
          },
        }),
      } as any,
      {
        getWalineSetting: jest.fn().mockResolvedValue({ authorEmail: 'author@example.com' }),
      } as any,
      {
        renderMarkdown: jest.fn((value: string) => `<p>${value}</p>`),
        getDescription: jest.fn((value: string) => value.slice(0, 20)),
      } as any,
    );

  it('publishes feed self links on the root aliases instead of the internal /rss prefix', async () => {
    const provider = createProvider();

    await provider.generateRssFeedFn('test');

    expect(FeedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feedLinks: {
          rss2: 'https://blog.example.com/feed.xml',
          json: 'https://blog.example.com/feed.json',
        },
      }),
    );
  });

  it('writes rss, json feed, and atom artifacts into the static rss directory', async () => {
    const provider = createProvider();

    await provider.generateRssFeedFn('test');

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/vanblog-static/rss', { recursive: true });
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith('/tmp/vanblog-static/rss/feed.json', expect.any(String));
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith('/tmp/vanblog-static/rss/feed.xml', expect.any(String));
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith('/tmp/vanblog-static/rss/atom.xml', expect.any(String));
  });
});
