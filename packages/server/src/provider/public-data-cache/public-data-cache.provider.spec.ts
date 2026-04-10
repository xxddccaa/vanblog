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
  });

  it('clears article-derived caches precisely', async () => {
    const cacheProvider = {
      del: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new PublicDataCacheProvider(cacheProvider as any);

    await provider.clearArticleRelatedData();

    expect(cacheProvider.del).toHaveBeenCalledWith('public:meta');
    expect(cacheProvider.del).toHaveBeenCalledWith('public:category:summary');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('public:timeline*');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('tag:*');
  });

  it('clears meta cache independently', async () => {
    const cacheProvider = {
      del: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new PublicDataCacheProvider(cacheProvider as any);

    await provider.clearMetaData();

    expect(cacheProvider.del).toHaveBeenCalledWith('public:meta');
  });

  it('clears viewer and analysis cache together', async () => {
    const cacheProvider = {
      del: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new PublicDataCacheProvider(cacheProvider as any);

    await provider.clearViewerData();

    expect(cacheProvider.del).toHaveBeenCalledWith('public:meta');
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('analysis:*');
  });
});
