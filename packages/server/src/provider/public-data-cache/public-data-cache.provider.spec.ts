import { PublicDataCacheProvider } from './public-data-cache.provider';

describe('PublicDataCacheProvider', () => {
  it('clears all public-facing caches in one pass', async () => {
    const cacheProvider = {
      del: jest.fn(),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new PublicDataCacheProvider(cacheProvider as any);

    await provider.clearAllPublicData();

    expect(cacheProvider.delPattern).toHaveBeenCalledWith('public:*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('tag:*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('analysis:*');
  });

  it('clears article-derived caches precisely', async () => {
    const cacheProvider = {
      del: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new PublicDataCacheProvider(cacheProvider as any);

    await provider.clearArticleRelatedData();

    expect(cacheProvider.del).toHaveBeenCalledWith('public:meta');
    expect(cacheProvider.del).toHaveBeenCalledWith('public:site-stats');
    expect(cacheProvider.del).toHaveBeenCalledWith('public:category:summary');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('public:timeline*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('public:article:engagement:*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('public:article:fragments:*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('tag:*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('analysis:*');
  });

  it('clears tag-derived summaries without touching unrelated public shells', async () => {
    const cacheProvider = {
      del: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new PublicDataCacheProvider(cacheProvider as any);

    await provider.clearTagData();

    expect(cacheProvider.del).toHaveBeenCalledWith('public:meta');
    expect(cacheProvider.del).toHaveBeenCalledWith('public:site-stats');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('tag:*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('analysis:*');
  });

  it('clears meta cache independently', async () => {
    const cacheProvider = {
      del: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new PublicDataCacheProvider(cacheProvider as any);

    await provider.clearMetaData();

    expect(cacheProvider.del).toHaveBeenCalledWith('public:meta');
    expect(cacheProvider.del).toHaveBeenCalledWith('public:site-info');
    expect(cacheProvider.del).toHaveBeenCalledWith('public:site-stats');
  });

  it('clears viewer and analysis cache together', async () => {
    const cacheProvider = {
      del: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new PublicDataCacheProvider(cacheProvider as any);

    await provider.clearViewerData();

    expect(cacheProvider.del).toHaveBeenCalledWith('public:meta');
    expect(cacheProvider.del).toHaveBeenCalledWith('public:site-stats');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('public:article:engagement:*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('public:article:fragments:*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('analysis:*');
  });
});
