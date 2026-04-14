import { ArticleProvider } from './article.provider';

describe('ArticleProvider', () => {
  it('uses the structured PG adjacent-article query before falling back to the model scan', async () => {
    const articleModel = {
      find: jest.fn(),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      {} as any,
      {} as any,
      {} as any,
      {
        getAdjacentArticle: jest.fn().mockResolvedValue({
          id: 6,
          title: 'prev',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        }),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const result = await provider.getPreArticleByArticle(
      {
        id: 10,
        title: 'current',
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      } as any,
      'list',
    );

    expect(result).toMatchObject({ id: 6, title: 'prev' });
    expect(articleModel.find).not.toHaveBeenCalled();
  });

  it('searches article links from structured PG articles before touching the compatibility model', async () => {
    const articleModel = {
      find: jest.fn(),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      {} as any,
      {} as any,
      {} as any,
      {
        listArticles: jest.fn().mockResolvedValue([
          { id: 1, title: 'keep', content: 'Visit https://vanblog.io', deleted: false },
          { id: 2, title: 'skip', content: 'No links here', deleted: false },
        ]),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const result = await provider.searchArticlesByLink('vanblog.io');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, title: 'keep' });
    expect(articleModel.find).not.toHaveBeenCalled();
  });

  it('drops private body-only matches from public search results and strips protected content', async () => {
    const articleModel = {
      find: jest.fn(),
    };
    const categoryModel = {
      find: jest.fn(() => ({
        lean: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue([{ name: 'Members', private: true }]),
        })),
      })),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      categoryModel as any,
      {} as any,
      {} as any,
      {
        searchArticles: jest.fn().mockResolvedValue([
          {
            id: 1,
            title: 'Public Match',
            category: 'Open',
            tags: ['Cloudflare'],
            content: 'This body mentions keyword.',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
          {
            id: 2,
            title: 'Locked Post',
            category: 'Open',
            tags: ['Secret'],
            private: true,
            content: 'keyword only exists in this protected body',
            createdAt: new Date('2024-01-02T00:00:00.000Z'),
          },
          {
            id: 3,
            title: 'Members Only',
            category: 'Members',
            tags: ['Team'],
            content: 'keyword only exists in this category-protected body',
            createdAt: new Date('2024-01-03T00:00:00.000Z'),
          },
        ]),
        getCategoriesByNames: jest.fn().mockResolvedValue([{ name: 'Members', private: true }]),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const result = await provider.searchByString('keyword', false);

    expect(result).toEqual([
      expect.objectContaining({
        id: 1,
        title: 'Public Match',
        content: 'This body mentions keyword.',
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(articleModel.find).not.toHaveBeenCalled();
  });

  it('keeps category-private articles searchable by visible metadata but still strips content', async () => {
    const provider = new ArticleProvider(
      { find: jest.fn() } as any,
      {
        find: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue([{ name: 'Members', private: true }]),
          })),
        })),
      } as any,
      {} as any,
      {} as any,
      {
        searchArticles: jest.fn().mockResolvedValue([
          {
            id: 3,
            title: 'Members Handbook',
            category: 'Members',
            tags: ['Team'],
            content: 'Visible search should not expose this protected body',
            createdAt: new Date('2024-01-03T00:00:00.000Z'),
          },
        ]),
        getCategoriesByNames: jest.fn().mockResolvedValue([{ name: 'Members', private: true }]),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const result = await provider.searchByString('members', false);

    expect(result).toEqual([
      expect.objectContaining({
        id: 3,
        title: 'Members Handbook',
        category: 'Members',
        private: true,
        content: undefined,
      }),
    ]);
  });

  it('returns no public search results for blank queries without touching the model fallback', async () => {
    const articleModel = {
      find: jest.fn(),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      {} as any,
      {} as any,
      {} as any,
      {
        searchArticles: jest.fn().mockResolvedValue([]),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    const result = await provider.searchByString('   ', false);

    expect(result).toEqual([]);
    expect(articleModel.find).not.toHaveBeenCalled();
  });

  it('escapes special regex characters in the fallback article search query', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const articleModel = {
      find: jest.fn().mockReturnValue({ exec }),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      {} as any,
      {} as any,
      {} as any,
      {
        searchArticles: jest.fn().mockResolvedValue([]),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    await provider.searchByString('a(b', false);

    expect(articleModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.arrayContaining([
              { content: { $regex: 'a\\(b', $options: 'i' } },
            ]),
          }),
        ]),
      }),
    );
  });

  it('does not allow the public password endpoint to bypass hidden-article visibility rules', async () => {
    const metaProvider = {
      getSiteInfo: jest.fn().mockResolvedValue({
        allowOpenHiddenPostByUrl: 'false',
      }),
    };
    const provider = new ArticleProvider(
      {} as any,
      {} as any,
      metaProvider as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(provider, 'getByIdOrPathname').mockResolvedValue({
      id: 7,
      title: 'Hidden Secret',
      hidden: true,
      private: true,
      password: 'secret',
      category: 'Open',
      content: 'should stay hidden',
    } as any);

    await expect(provider.getByIdWithPassword(7, 'secret')).resolves.toBeNull();
  });

  it('refreshes structured articles after fixing negative ids', async () => {
    const articleModel = {
      find: jest
        .fn()
        .mockImplementationOnce(() => ({
          sort: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue([{ id: -3, title: 'legacy negative' }]),
          })),
        }))
        .mockImplementationOnce(() => ({
          sort: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([{ id: 12 }]),
          })),
        })),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      refreshArticlesFromRecordStore: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      {} as any,
      {} as any,
      {} as any,
      structuredDataService as any,
    );

    const result = await provider.fixNegativeIds();

    expect(result).toEqual({
      fixedCount: 1,
      message: '负数ID修复成功完成',
    });
    expect(articleModel.updateOne).toHaveBeenCalledWith(
      { id: -3 },
      expect.objectContaining({ id: 13 }),
    );
    expect(structuredDataService.refreshArticlesFromRecordStore).toHaveBeenCalledWith(
      'article-fix-negative-ids',
    );
  });

  it('refreshes structured articles after cleaning temporary ids', async () => {
    const articleModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ id: 50001, title: 'temp article' }]),
      }),
      deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
    };
    const structuredDataService = {
      refreshArticlesFromRecordStore: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      {} as any,
      {} as any,
      {} as any,
      structuredDataService as any,
    );

    const result = await provider.cleanupTempIds();

    expect(result).toEqual({
      cleanedCount: 1,
      message: '成功清理 1 篇临时ID文章',
    });
    expect(articleModel.deleteOne).toHaveBeenCalledWith({ id: 50001 });
    expect(structuredDataService.refreshArticlesFromRecordStore).toHaveBeenCalledWith(
      'article-cleanup-temp-ids',
    );
  });

  it('refreshes structured articles after clearing duplicate pathnames', async () => {
    const articleModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue([
            { id: 7, title: 'first', pathname: 'dup-path', createdAt: new Date('2024-01-01') },
            { id: 8, title: 'second', pathname: 'dup-path', createdAt: new Date('2024-01-02') },
          ]),
        })),
      }),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      refreshArticlesFromRecordStore: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      {} as any,
      {} as any,
      {} as any,
      structuredDataService as any,
    );

    const result = await provider.cleanupDuplicatePathnames();

    expect(result).toEqual({ cleanedCount: 1 });
    expect(articleModel.updateOne).toHaveBeenCalledWith(
      { id: 8 },
      { $unset: { pathname: '' } },
    );
    expect(structuredDataService.refreshArticlesFromRecordStore).toHaveBeenCalledWith(
      'article-cleanup-duplicate-pathnames',
    );
  });

  it('refreshes structured articles after reordering article ids', async () => {
    const article = {
      _id: 'article-1',
      id: 9,
      title: 'first',
      pathname: 'stable-path',
      content: 'plain body',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    };
    const articleModel = {
      find: jest
        .fn()
        .mockImplementationOnce(() => ({
          sort: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue([article]),
          })),
        }))
        .mockImplementationOnce(() => ({
          exec: jest.fn().mockResolvedValue([]),
        })),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 0 }),
    };
    const structuredDataService = {
      refreshArticlesFromRecordStore: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new ArticleProvider(
      articleModel as any,
      {} as any,
      {} as any,
      {} as any,
      structuredDataService as any,
    );

    const result = await provider.reorderArticleIds();

    expect(result).toEqual({
      totalArticles: 1,
      updatedReferences: 0,
      customPathArticles: 1,
      message: '文章序号重排成功完成',
    });
    expect(articleModel.updateOne).toHaveBeenNthCalledWith(
      1,
      { id: 9 },
      expect.objectContaining({ id: 100000 }),
    );
    expect(articleModel.updateOne).toHaveBeenNthCalledWith(
      2,
      { id: 100000 },
      expect.objectContaining({ id: 1 }),
    );
    expect(structuredDataService.refreshArticlesFromRecordStore).toHaveBeenCalledWith(
      'article-reorder',
    );
  });
});
