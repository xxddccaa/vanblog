import { SiteMapProvider } from './sitemap.provider';

describe('SiteMapProvider', () => {
  it('emits archive summary urls instead of deep offset pagination urls', async () => {
    const provider = new SiteMapProvider(
      {
        getArchiveSummary: jest.fn().mockResolvedValue({
          years: [
            {
              year: '2026',
              months: [
                { month: '04', articleCount: 2 },
                { month: '03', articleCount: 1 },
              ],
            },
          ],
        }),
        getAll: jest.fn().mockResolvedValue([]),
        getByOption: jest.fn(),
        getTotalNum: jest.fn(),
      } as any,
      { getAllCategories: jest.fn().mockResolvedValue([]) } as any,
      { getAllTags: jest.fn().mockResolvedValue([]) } as any,
      { getAll: jest.fn().mockResolvedValue([]) } as any,
      { getSiteInfo: jest.fn().mockResolvedValue({ homePageSize: 4 }) } as any,
    );

    await expect(provider.getArchiveSummaryUrls()).resolves.toEqual([
      '/archive',
      '/archive/2026',
      '/archive/2026/04',
      '/archive/2026/03',
    ]);
  });

  it('emits category archive urls for summary, year, and month entry pages', async () => {
    const articleProvider = {
      getArchiveSummary: jest.fn().mockResolvedValue({
        years: [
          {
            year: '2026',
            months: [{ month: '04', articleCount: 2 }],
          },
        ],
      }),
      getAll: jest.fn().mockResolvedValue([]),
      getByOption: jest.fn(),
      getTotalNum: jest.fn(),
    };
    const provider = new SiteMapProvider(
      articleProvider as any,
      { getAllCategories: jest.fn().mockResolvedValue(['System Design']) } as any,
      { getAllTags: jest.fn().mockResolvedValue([]) } as any,
      { getAll: jest.fn().mockResolvedValue([]) } as any,
      { getSiteInfo: jest.fn().mockResolvedValue({ homePageSize: 4 }) } as any,
    );

    await expect(provider.getCategoryArchiveUrls()).resolves.toEqual([
      '/category/System Design',
      '/category/System Design/archive/2026',
      '/category/System Design/archive/2026/04',
    ]);
    expect(articleProvider.getArchiveSummary).toHaveBeenCalledWith({
      category: 'System Design',
    });
  });

  it('builds site urls with archive-based public entries and no paginated listing urls', async () => {
    const provider = new SiteMapProvider(
      {
        getAll: jest.fn().mockResolvedValue([{ id: 1, pathname: 'stable-post' }]),
        getArchiveSummary: jest.fn().mockResolvedValue({
          years: [
            {
              year: '2026',
              months: [{ month: '04', articleCount: 1 }],
            },
          ],
        }),
      } as any,
      { getAllCategories: jest.fn().mockResolvedValue(['System Design']) } as any,
      { getAllTags: jest.fn().mockResolvedValue(['Cloudflare']) } as any,
      { getAll: jest.fn().mockResolvedValue([{ path: '/edge-cache' }]) } as any,
      { getSiteInfo: jest.fn().mockResolvedValue({ homePageSize: 5 }) } as any,
    );

    const urls = await provider.getSiteUrls();

    expect(urls).toEqual(
      expect.arrayContaining([
        '/',
        '/category',
        '/tag',
        '/timeline',
        '/about',
        '/link',
        '/post/stable-post',
        '/archive',
        '/archive/2026',
        '/archive/2026/04',
        '/category/System Design',
        '/category/System Design/archive/2026',
        '/category/System Design/archive/2026/04',
        '/tag/Cloudflare',
        '/tag/Cloudflare/archive/2026',
        '/tag/Cloudflare/archive/2026/04',
        '/c/edge-cache',
      ]),
    );
    expect(urls).not.toEqual(expect.arrayContaining(['/page/2']));
    expect(urls).not.toEqual(expect.arrayContaining(['/category/System Design/page/2']));
    expect(urls).not.toEqual(expect.arrayContaining(['/tag/Cloudflare/page/2']));
  });
});
