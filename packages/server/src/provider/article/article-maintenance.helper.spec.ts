import {
  cleanupDuplicatePathnames,
  cleanupTempIds,
  fixNegativeIds,
  reorderArticleIds,
} from './article-maintenance.helper';

describe('article-maintenance.helper', () => {
  const createChain = (result: any) => {
    const chain: any = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(result),
      exec: jest.fn().mockResolvedValue(result),
    };
    return chain;
  };

  it('reorders article ids sequentially and rewrites internal /post/:id links', async () => {
    const articles = [
      { _id: 'a', id: 10, content: 'See /post/20', pathname: '' },
      { _id: 'b', id: 20, content: 'Plain body', pathname: 'custom-slug' },
    ];
    const articleModel: any = {
      find: jest
        .fn()
        .mockReturnValueOnce(createChain(articles))
        .mockReturnValueOnce(createChain([])),
      updateOne: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    const refresh = jest.fn().mockResolvedValue(undefined);

    const result = await reorderArticleIds(articleModel, refresh);

    expect(result).toMatchObject({
      totalArticles: 2,
      updatedReferences: 1,
      customPathArticles: 1,
    });
    expect(articleModel.updateOne).toHaveBeenCalledWith(
      { id: 10 },
      expect.objectContaining({ content: 'See /post/2' }),
    );
    expect(refresh).toHaveBeenCalledWith('article-reorder');
  });

  it('fixes negative ids using the next available positive id', async () => {
    const articleModel: any = {
      find: jest
        .fn()
        .mockReturnValueOnce(createChain([{ id: -2, title: 'Neg' }]))
        .mockReturnValueOnce(createChain([{ id: 5 }])),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const refresh = jest.fn().mockResolvedValue(undefined);

    const result = await fixNegativeIds(articleModel, refresh);

    expect(result.fixedCount).toBe(1);
    expect(articleModel.updateOne).toHaveBeenCalledWith(
      { id: -2 },
      expect.objectContaining({ id: 6 }),
    );
    expect(refresh).toHaveBeenCalledWith('article-fix-negative-ids');
  });

  it('cleans temporary ids >= 50000', async () => {
    const articleModel: any = {
      find: jest.fn().mockReturnValueOnce(createChain([{ id: 50001, title: 'Temp' }])),
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    const refresh = jest.fn().mockResolvedValue(undefined);

    const result = await cleanupTempIds(articleModel, refresh);

    expect(result.cleanedCount).toBe(1);
    expect(articleModel.deleteOne).toHaveBeenCalledWith({ id: 50001 });
    expect(refresh).toHaveBeenCalledWith('article-cleanup-temp-ids');
  });

  it('keeps the earliest article pathname and unsets duplicates', async () => {
    const articleModel: any = {
      find: jest.fn().mockReturnValueOnce(
        createChain([
          { id: 1, title: 'First', pathname: 'dup-slug' },
          { id: 2, title: 'Second', pathname: 'dup-slug' },
        ]),
      ),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const refresh = jest.fn().mockResolvedValue(undefined);

    const result = await cleanupDuplicatePathnames(articleModel, refresh);

    expect(result.cleanedCount).toBe(1);
    expect(articleModel.updateOne).toHaveBeenCalledWith(
      { id: 2 },
      { $unset: { pathname: '' } },
    );
    expect(refresh).toHaveBeenCalledWith('article-cleanup-duplicate-pathnames');
  });
});
