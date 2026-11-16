import fs from 'fs';
import { Feed } from 'feed';
import { config } from 'src/config';
import { RSS_PROTECTED_CONTENT, RssProvider } from './rss.provider';
import { PublicMaskProvider } from '../public-mask/public-mask.provider';
import { defaultPublicMaskSetting } from 'src/utils/publicMask';

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

  const createProvider = (articles?: any[], publicMaskProvider?: any) => {
    const articleProvider = {
      getByOption: jest.fn().mockResolvedValue({
        articles: articles || [
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
        ],
        total: 1,
      }),
    };
    const markdownProvider = {
      renderMarkdown: jest.fn((value: string) => `<p>${value}</p>`),
      renderMarkdownWithDiagrams: jest.fn(async (value: string) => `<p>${value}</p>`),
      getDescription: jest.fn((value: string) => value.slice(0, 20)),
    };
    const provider = new RssProvider(
      articleProvider as any,
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
      markdownProvider as any,
      publicMaskProvider,
    );
    return { provider, articleProvider, markdownProvider };
  };

  it('reads articles through the public list query so private categories are honored', async () => {
    const { provider, articleProvider, markdownProvider } = createProvider([
      {
        id: 9,
        title: 'Locked By Category',
        pathname: 'locked-by-category',
        category: 'Secret',
        content: undefined,
        private: true,
        createdAt: '2026-04-10T00:00:00.000Z',
      },
    ]);

    await provider.generateRssFeedFn('test');

    expect(articleProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: -1, regMatch: false }),
      true,
    );
    const renderedSources = markdownProvider.renderMarkdownWithDiagrams.mock.calls.map(
      (call) => call[0],
    );
    expect(renderedSources).toEqual([RSS_PROTECTED_CONTENT]);
  });

  it('masks article Markdown and links before rendering the feed', async () => {
    const publicMaskProvider = new PublicMaskProvider({
      getSetting: jest.fn().mockResolvedValue({
        value: {
          ...defaultPublicMaskSetting,
          enabled: true,
          replacements: { custom: 'X-CUSTOM-X', secret: 'X-SECRET-X', email: 'X-EMAIL-X', ip: 'X-IP-X' },
          rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
        },
      }),
    } as any);
    const { provider, markdownProvider } = createProvider(
      [
        {
          id: 12,
          title: 'acmecore notes',
          pathname: 'acmecore-notes',
          category: 'acmecore-lab',
          content: 'deploy to acmecore',
          createdAt: '2026-04-10T00:00:00.000Z',
        },
      ],
      publicMaskProvider,
    );

    await provider.generateRssFeedFn('test');

    expect(markdownProvider.renderMarkdownWithDiagrams).toHaveBeenCalledWith('deploy to X-CUSTOM-X');
    const feedInstance = FeedMock.mock.results.at(-1)!.value;
    const item = feedInstance.addItem.mock.calls[0][0];
    expect(item.title).toBe('X-CUSTOM-X notes');
    expect(item.link).toBe('https://blog.example.com/post/12');
    expect(JSON.stringify(item).toLowerCase()).not.toContain('acmecore');
  });

  it('publishes feed self links on the root aliases instead of the internal /rss prefix', async () => {
    const { provider } = createProvider();

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
    const { provider } = createProvider();

    await provider.generateRssFeedFn('test');

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/vanblog-static/rss', { recursive: true });
    for (const name of ['feed.json', 'feed.xml', 'atom.xml']) {
      expect(mockedFs.renameSync).toHaveBeenCalledWith(
        expect.stringContaining(`/tmp/vanblog-static/rss/.${name}.`),
        `/tmp/vanblog-static/rss/${name}`,
      );
    }
  });
});
