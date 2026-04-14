import { MetaProvider } from './meta.provider';

describe('MetaProvider', () => {
  it('stamps siteInfo.updatedAt when site info changes without re-reading the model', async () => {
    const existingMeta = {
      siteInfo: {
        siteName: 'VanBlog',
        baseUrl: 'https://old.example.com',
      },
    };
    const metaModel = {
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      create: jest.fn(),
    };
    const structuredDataService = {
      getMeta: jest.fn().mockResolvedValue(existingMeta),
      upsertMeta: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new MetaProvider(
      metaModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.updateSiteInfo({
      siteName: 'Edge Cache Blog',
      baseUrl: 'https://example.com',
    });

    expect(metaModel.updateOne).toHaveBeenCalledTimes(1);
    expect(metaModel.updateOne).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        siteInfo: expect.objectContaining({
          siteName: 'Edge Cache Blog',
          baseUrl: 'https://example.com',
          updatedAt: expect.any(Date),
        }),
      }),
    );
    expect(structuredDataService.upsertMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        siteInfo: expect.objectContaining({
          siteName: 'Edge Cache Blog',
          baseUrl: 'https://example.com',
          updatedAt: expect.any(Date),
        }),
      }),
    );
    expect(metaModel.findOne).not.toHaveBeenCalled();
  });

  it('swallows total word refresh failures so the server does not crash on malformed articles', async () => {
    jest.useFakeTimers();

    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const provider = new MetaProvider(
      {
        findOne: jest.fn(),
        updateOne: jest.fn(),
        create: jest.fn(),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {
        countTotalWords: jest.fn().mockRejectedValue(new Error('bad article content')),
      } as any,
      {} as any,
      {
        getMeta: jest.fn().mockResolvedValue({}),
        upsertMeta: jest.fn(),
      } as any,
    );
    (provider as any).logger = logger;

    await provider.updateTotalWords('测试');
    jest.advanceTimersByTime(30_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      '测试触发更新字数缓存失败',
      expect.stringContaining('bad article content'),
    );

    jest.useRealTimers();
  });
});
