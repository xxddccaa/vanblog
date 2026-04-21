import { DocumentController } from './document.controller';

describe('DocumentController', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const documentProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, documents: [] }),
      updateById: jest
        .fn()
        .mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
      findById: jest.fn().mockResolvedValue({ id: 12, title: 'doc title' }),
      ...overrides.documentProvider,
    };
    const searchIndexProvider = {
      generateSearchIndex: jest.fn(),
      ...overrides.searchIndexProvider,
    };
    const aiQaProvider = {
      syncDocumentById: jest.fn().mockResolvedValue({ action: 'updated' }),
      deleteDocumentTreeByRootId: jest.fn().mockResolvedValue({ deleted: 1 }),
      deleteSource: jest.fn().mockResolvedValue({ deleted: true }),
      syncDraftById: jest.fn().mockResolvedValue({ action: 'updated' }),
      ...overrides.aiQaProvider,
    };

    return {
      controller: new DocumentController(documentProvider as any, searchIndexProvider as any, aiQaProvider as any),
      documentProvider,
      searchIndexProvider,
      aiQaProvider,
    };
  };

  it('clamps oversized admin document pagination before querying the provider', async () => {
    const { controller, documentProvider } = createController();

    await controller.getByOption('0' as any, '999' as any, false as any);

    expect(documentProvider.getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 100,
      }),
    );
  });

  it('updates a document when the route param is a string id', async () => {
    const { controller, documentProvider, searchIndexProvider, aiQaProvider } = createController();

    const result = await controller.update(
      '12' as any,
      {
        content: 'updated doc',
      } as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { acknowledged: true, matchedCount: 1, modifiedCount: 1 },
    });
    expect(documentProvider.updateById).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ content: 'updated doc' }),
    );
    expect(searchIndexProvider.generateSearchIndex).toHaveBeenCalledWith(
      '更新私密文档触发搜索索引同步',
      500,
    );
    expect(aiQaProvider.syncDocumentById).toHaveBeenCalledWith(12, 'document-update');
  });
});
