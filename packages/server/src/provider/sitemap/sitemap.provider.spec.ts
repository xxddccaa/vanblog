import { SiteMapProvider } from './sitemap.provider';

describe('SiteMapProvider', () => {
  it('uses the configured home page size when calculating page urls', async () => {
    const provider = new SiteMapProvider(
      {
        getTotalNum: jest.fn().mockResolvedValue(13),
        getByOption: jest.fn(),
      } as any,
      { getAllCategories: jest.fn().mockResolvedValue([]) } as any,
      { getAllTags: jest.fn().mockResolvedValue([]) } as any,
      { getAll: jest.fn().mockResolvedValue([]) } as any,
      { getSiteInfo: jest.fn().mockResolvedValue({ homePageSize: 4 }) } as any,
    );

    await expect(provider.getPageUrls()).resolves.toEqual(['/page/2', '/page/3', '/page/4']);
  });

  it('emits paginated tag urls starting from page 2', async () => {
    const articleProvider = {
      getTotalNum: jest.fn(),
      getByOption: jest.fn().mockResolvedValue({ total: 9 }),
    };
    const provider = new SiteMapProvider(
      articleProvider as any,
      { getAllCategories: jest.fn().mockResolvedValue([]) } as any,
      { getAllTags: jest.fn().mockResolvedValue(['edge']) } as any,
      { getAll: jest.fn().mockResolvedValue([]) } as any,
      { getSiteInfo: jest.fn().mockResolvedValue({ homePageSize: 4 }) } as any,
    );

    await expect(provider.getTagPageUrls()).resolves.toEqual(['/tag/edge/page/2', '/tag/edge/page/3']);
  });
});
