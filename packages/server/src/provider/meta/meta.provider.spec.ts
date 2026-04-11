import { MetaProvider } from './meta.provider';

describe('MetaProvider', () => {
  const createFindOne = (...responses: any[]) => {
    const exec = jest.fn();
    responses.forEach((response) => exec.mockResolvedValueOnce(response));
    return {
      exec,
      lean: jest.fn(() => ({ exec })),
    };
  };

  it('stamps siteInfo.updatedAt when site info changes', async () => {
    const existingMeta = {
      siteInfo: {
        siteName: 'VanBlog',
        baseUrl: 'https://old.example.com',
      },
    };
    const latestMeta = {
      siteInfo: {
        siteName: 'Edge Cache Blog',
        baseUrl: 'https://example.com',
        updatedAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    };
    const findOne = jest
      .fn()
      .mockImplementationOnce(() => createFindOne(existingMeta))
      .mockImplementationOnce(() => createFindOne(latestMeta));
    const metaModel = {
      findOne,
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
    expect(structuredDataService.upsertMeta).toHaveBeenCalledWith(latestMeta);
  });
});
