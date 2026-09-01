import { DocumentProvider } from './document.provider';

describe('DocumentProvider', () => {
  it('does not apply limit/skip when pageSize is non-positive', async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ id: 10 }, { id: 11 }]),
    };
    const documentModel = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      }),
    };

    const provider = new DocumentProvider(
      documentModel as any,
      {} as any,
      {
        queryDocuments: jest.fn().mockResolvedValue({ documents: [], total: 0 }),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );
    const result = await provider.getByOption({ page: 1, pageSize: -1 });

    expect(result.documents).toHaveLength(2);
    expect(documentModel.find).toHaveBeenCalled();
    expect(query.sort).toHaveBeenCalled();
    expect(query.skip).not.toHaveBeenCalled();
    expect(query.limit).not.toHaveBeenCalled();
  });

  it('escapes title and author filters before building fallback regex queries', async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const documentModel = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      }),
    };

    const provider = new DocumentProvider(
      documentModel as any,
      {} as any,
      {
        queryDocuments: jest.fn().mockResolvedValue({ documents: [], total: 0 }),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    await provider.getByOption({
      page: 1,
      pageSize: 10,
      title: 'draft(.*)+',
      author: 'alice?|bob',
    } as any);

    expect(documentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          { title: { $regex: 'draft\\(\\.\\*\\)\\+', $options: 'i' } },
          { author: { $regex: 'alice\\?\\|bob', $options: 'i' } },
        ]),
      }),
      expect.anything(),
    );
  });

  it('marks the whole document subtree deleted in PG without a full structured refresh', async () => {
    const documentModel = {
      updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      getDocumentById: jest.fn().mockResolvedValue({ id: 1, title: 'root' }),
      getDocumentSubtree: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      markDocumentsDeleted: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
    };
    const provider = new DocumentProvider(
      documentModel as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.deleteById(1);

    expect(documentModel.updateMany).toHaveBeenCalledWith(
      { id: { $in: [1, 2] } },
      expect.objectContaining({ deleted: true }),
    );
    expect(structuredDataService.markDocumentsDeleted).toHaveBeenCalledWith(
      [1, 2],
      expect.any(Date),
    );
  });

  it('moves a document subtree by updating descendant paths instead of rebuilding the document table', async () => {
    const documentModel = {
      bulkWrite: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      getDocumentById: jest.fn().mockResolvedValue({
        id: 3,
        title: 'root',
        type: 'document',
        path: [1],
        parent_id: 1,
        library_id: 1,
        sort_order: 0,
      }),
      getDocumentSubtree: jest.fn().mockResolvedValue([
        {
          id: 3,
          title: 'root',
          type: 'document',
          path: [1],
          parent_id: 1,
          library_id: 1,
          sort_order: 0,
        },
        {
          id: 4,
          title: 'child',
          type: 'document',
          path: [1, 3],
          parent_id: 3,
          library_id: 1,
          sort_order: 0,
        },
        {
          id: 5,
          title: 'grandchild',
          type: 'document',
          path: [1, 3, 4],
          parent_id: 4,
          library_id: 1,
          sort_order: 0,
        },
      ]),
      upsertDocument: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
    };
    const provider = new DocumentProvider(
      documentModel as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.moveDocument(3, { target_library_id: 9, sort_order: 7 });

    expect(documentModel.bulkWrite).toHaveBeenCalledTimes(1);
    expect(structuredDataService.upsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, path: [9], library_id: 9, sort_order: 7 }),
    );
    expect(structuredDataService.upsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, path: [9, 3] }),
    );
    expect(structuredDataService.upsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, path: [9, 3, 4] }),
    );
  });

  it('rejects moving a document into its own descendant subtree', async () => {
    const documentModel = {
      bulkWrite: jest.fn(),
    };
    const structuredDataService = {
      getDocumentById: jest.fn().mockResolvedValue({
        id: 3,
        title: 'root',
        type: 'document',
        path: [1],
        parent_id: 1,
        library_id: 1,
        sort_order: 0,
      }),
      getDocumentSubtree: jest.fn().mockResolvedValue([
        { id: 3, path: [1] },
        { id: 4, path: [1, 3] },
      ]),
      upsertDocument: jest.fn(),
    };
    const provider = new DocumentProvider(
      documentModel as any,
      {} as any,
      structuredDataService as any,
    );

    await expect(provider.moveDocument(3, { target_parent_id: 4 })).rejects.toThrow(
      '不能将文档移动到自己或子文档下面',
    );
    expect(documentModel.bulkWrite).not.toHaveBeenCalled();
    expect(structuredDataService.upsertDocument).not.toHaveBeenCalled();
  });

  it('rejects location updates through the generic update endpoint', async () => {
    const documentModel = {
      updateOne: jest.fn(),
      findOne: jest.fn(),
    };
    const provider = new DocumentProvider(
      documentModel as any,
      {} as any,
      {} as any,
    );

    await expect(provider.updateById(7, { parent_id: 9 })).rejects.toThrow(
      '文档位置调整请使用移动接口，避免子文档路径不一致',
    );
    expect(documentModel.updateOne).not.toHaveBeenCalled();
    expect(documentModel.findOne).not.toHaveBeenCalled();
  });

  it('returns no document search results for blank queries without touching the model fallback', async () => {
    const documentModel = {
      find: jest.fn(),
    };
    const provider = new DocumentProvider(
      documentModel as any,
      {} as any,
      {
        searchDocuments: jest.fn().mockResolvedValue([]),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    const result = await provider.searchByString('   ');

    expect(result).toEqual([]);
    expect(documentModel.find).not.toHaveBeenCalled();
  });

  it('builds and sorts a document tree without mutating the source documents', async () => {
    const source = [
      {
        id: 1,
        title: 'Library',
        type: 'library',
        sort_order: 0,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: 2,
        title: 'Later child',
        type: 'document',
        library_id: 1,
        sort_order: 2,
        createdAt: new Date('2024-03-01T00:00:00.000Z'),
      },
      {
        id: 3,
        title: 'First child',
        type: 'document',
        library_id: 1,
        sort_order: 1,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      },
      {
        id: 4,
        title: 'Grandchild',
        type: 'document',
        library_id: 1,
        parent_id: 3,
        sort_order: 0,
        createdAt: new Date('2024-04-01T00:00:00.000Z'),
      },
      {
        id: 5,
        title: 'Orphan',
        type: 'document',
        library_id: 99,
        sort_order: 0,
        createdAt: new Date('2024-05-01T00:00:00.000Z'),
      },
    ];
    const structuredDataService = {
      listDocuments: jest.fn().mockResolvedValue(source),
      isInitialized: jest.fn().mockReturnValue(true),
    };
    const provider = new DocumentProvider(
      {} as any,
      {} as any,
      structuredDataService as any,
    );

    const result = await provider.getDocumentTree();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, title: 'Library' });
    expect((result[0] as any).children.map((item: any) => item.id)).toEqual([3, 2]);
    expect((result[0] as any).children[0].children).toEqual([
      expect.objectContaining({ id: 4 }),
    ]);
    expect((result[0] as any).createdAt).toBeInstanceOf(Date);
    expect(source.every((item) => !Object.prototype.hasOwnProperty.call(item, 'children'))).toBe(
      true,
    );
  });

  it('marks structured search matches and ancestors without JSON roundtrip cloning', async () => {
    const createdAt = new Date('2024-06-01T00:00:00.000Z');
    const structuredDataService = {
      searchDocuments: jest.fn().mockResolvedValue([
        {
          id: 3,
          title: 'Matched',
          library_id: 1,
          parent_id: 2,
          path: [1, 2],
        },
      ]),
      getDocumentsByIds: jest.fn().mockResolvedValue([
        { id: 1, title: 'Library', type: 'library', createdAt },
        { id: 2, title: 'Parent', type: 'document', library_id: 1, createdAt },
        { id: 3, title: 'Matched', type: 'document', library_id: 1, parent_id: 2, createdAt },
      ]),
      isInitialized: jest.fn().mockReturnValue(true),
    };
    const provider = new DocumentProvider(
      {} as any,
      {} as any,
      structuredDataService as any,
    );

    const result = await provider.searchByString('matched');

    expect(result.map((item: any) => [item.id, item.isSearchResult])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    expect((result[0] as any).createdAt).toBe(createdAt);
    expect(JSON.parse(JSON.stringify(result))[0].createdAt).toBe(
      '2024-06-01T00:00:00.000Z',
    );
  });

  it('marks fallback search matches while preserving model document values', async () => {
    const createdAt = new Date('2024-07-01T00:00:00.000Z');
    const matchesQuery = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        { id: 3, title: 'Matched', library_id: 1, parent_id: 2, path: [1, 2] },
      ]),
    };
    const relatedQuery = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        { id: 1, title: 'Library', type: 'library', createdAt },
        { id: 2, title: 'Parent', type: 'document', createdAt },
        { id: 3, title: 'Matched', type: 'document', createdAt },
      ]),
    };
    const documentModel = {
      find: jest
        .fn()
        .mockReturnValueOnce(matchesQuery)
        .mockReturnValueOnce(relatedQuery),
    };
    const provider = new DocumentProvider(
      documentModel as any,
      {} as any,
      {
        searchDocuments: jest.fn().mockResolvedValue([]),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    const result = await provider.searchByString('matched');

    expect(result.map((item: any) => [item.id, item.isSearchResult])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    expect((result[2] as any).createdAt).toBe(createdAt);
    expect(matchesQuery.lean).toHaveBeenCalledTimes(1);
    expect(relatedQuery.lean).toHaveBeenCalledTimes(1);
  });

  it('projects document fields without reading the compatibility _doc getter', async () => {
    const document: any = {
      id: 1,
      title: 'Library',
      type: 'library',
      path: [9],
      createdAt: new Date('2024-08-01T00:00:00.000Z'),
    };
    Object.defineProperty(document, '_doc', {
      enumerable: true,
      get: jest.fn(() => {
        throw new Error('_doc getter must not be read');
      }),
    });
    const provider = new DocumentProvider(
      {} as any,
      {} as any,
      {
        listDocuments: jest.fn().mockResolvedValue([document]),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const result = await provider.getDocumentTree();

    expect(result).toEqual([
      expect.objectContaining({
        id: 1,
        title: 'Library',
        path: [9],
        children: [],
      }),
    ]);
    expect(Object.getOwnPropertyDescriptor(document, '_doc')?.get).not.toHaveBeenCalled();
    expect((result[0] as any).path).not.toBe(document.path);
  });
});
