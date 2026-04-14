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
});
