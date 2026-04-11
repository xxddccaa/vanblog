import axios from 'axios';
import { config } from 'src/config';
import { CloudflareCacheProvider } from './cloudflare-cache.provider';

jest.mock('axios');

describe('CloudflareCacheProvider', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const originalToken = config.cloudflareApiToken;
  const originalZoneId = config.cloudflareZoneId;

  beforeEach(() => {
    jest.clearAllMocks();
    config.cloudflareApiToken = 'test-token';
    config.cloudflareZoneId = 'test-zone';
    mockedAxios.post.mockResolvedValue({ data: { success: true } } as any);
  });

  afterAll(() => {
    config.cloudflareApiToken = originalToken;
    config.cloudflareZoneId = originalZoneId;
  });

  const createProvider = (baseUrl = 'https://blog.example.com') =>
    new CloudflareCacheProvider({
      getSiteInfo: jest.fn().mockResolvedValue({ baseUrl }),
    } as any);

  it('purges deduplicated cache tags when Cloudflare credentials are configured', async () => {
    const provider = createProvider();

    await provider.purgeByTags(['post:1', 'post:1', '', 'site-stats'], 'article-update-1');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache',
      { tags: ['post:1', 'site-stats'] },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('skips tag purge entirely when Cloudflare integration is disabled', async () => {
    config.cloudflareApiToken = '';
    const provider = createProvider();

    await provider.purgeByTags(['post:1'], 'article-update-1');

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('converts relative and bare paths to absolute URLs before purging', async () => {
    const provider = createProvider('blog.example.com');

    await provider.purgeByUrls(
      ['/post/stable-post', 'tag/Cloudflare', 'https://cdn.example.com/feed.xml'],
      'article-update-1',
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache',
      {
        files: [
          'https://blog.example.com/post/stable-post',
          'https://blog.example.com/tag/Cloudflare',
          'https://cdn.example.com/feed.xml',
        ],
      },
      expect.any(Object),
    );
  });

  it('normalizes public artifact aliases and static search index paths before URL purge', async () => {
    const provider = createProvider('https://blog.example.com');

    await provider.purgeByUrls(
      ['/feed.xml', '/feed.json', '/atom.xml', '/sitemap.xml', '/static/search-index.json'],
      'artifact-refresh',
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache',
      {
        files: [
          'https://blog.example.com/feed.xml',
          'https://blog.example.com/feed.json',
          'https://blog.example.com/atom.xml',
          'https://blog.example.com/sitemap.xml',
          'https://blog.example.com/static/search-index.json',
        ],
      },
      expect.any(Object),
    );
  });

  it('skips URL purge when site baseUrl is unavailable', async () => {
    const provider = createProvider('');

    await provider.purgeByUrls(['/post/stable-post'], 'article-update-1');

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('fans out combined purge requests across both tags and urls', async () => {
    const provider = createProvider();
    const purgeByTags = jest.spyOn(provider, 'purgeByTags').mockResolvedValue(undefined);
    const purgeByUrls = jest.spyOn(provider, 'purgeByUrls').mockResolvedValue(undefined);

    await provider.purgeByTagsAndUrls(['post:1'], ['/post/stable-post'], 'article-update-1');

    expect(purgeByTags).toHaveBeenCalledWith(['post:1'], 'article-update-1');
    expect(purgeByUrls).toHaveBeenCalledWith(['/post/stable-post'], 'article-update-1');
  });

  it('still purges tags when combined purge is requested without site baseUrl', async () => {
    const provider = createProvider('');
    const warn = jest.spyOn((provider as any).logger, 'warn').mockImplementation(() => undefined);

    await provider.purgeByTagsAndUrls(['post:1', 'site-stats'], ['/post/stable-post'], 'article-update-1');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache',
      { tags: ['post:1', 'site-stats'] },
      expect.any(Object),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Cloudflare URL purge 已跳过，站点 baseUrl 未配置'),
    );
  });
});
