import { CategoryProvider } from './category.provider';

describe('CategoryProvider', () => {
  it('returns articles whose categories include the requested category in the fallback path', async () => {
    const articleProvider = {
      getAll: jest.fn().mockResolvedValue([
        { id: 1, title: 'A only', category: 'A', categories: ['A'] },
        { id: 2, title: 'A and B', category: 'A', categories: ['A', 'B'] },
        { id: 3, title: 'C only', category: 'C', categories: ['C'] },
      ]),
      hasCategory: jest.fn((article, category) =>
        (article.categories || [article.category]).includes(category),
      ),
    };
    const provider = new CategoryProvider({} as any, articleProvider as any, {
      getArticlesByCategory: jest.fn().mockResolvedValue([]),
      isInitialized: jest.fn().mockReturnValue(false),
    } as any);

    await expect(provider.getArticlesByCategory('B', true)).resolves.toEqual([
      expect.objectContaining({ id: 2 }),
    ]);
  });

  it('renames only the matched category inside article category arrays', async () => {
    const articleProvider = {
      getAll: jest.fn().mockResolvedValue([
        { id: 2, category: 'A', categories: ['A', 'B'] },
      ]),
      getArticleCategories: jest.fn((article) => article.categories || [article.category]),
      hasCategory: jest.fn((article, category) =>
        (article.categories || [article.category]).includes(category),
      ),
      updateById: jest.fn().mockResolvedValue(undefined),
    };
    const categoryModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(null) })),
      }),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      getCategoryByName: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, name: 'A', sort: 0 }),
      isInitialized: jest.fn().mockReturnValue(false),
      getArticlesByCategory: jest.fn().mockResolvedValue([]),
      renameCategoryInArticles: jest.fn().mockResolvedValue(undefined),
      upsertCategory: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new CategoryProvider(
      categoryModel as any,
      articleProvider as any,
      structuredDataService as any,
    );

    await provider.updateCategoryByName('A', { name: 'C' } as any);

    expect(articleProvider.updateById).toHaveBeenCalledWith(2, {
      categories: ['C', 'B'],
    });
    expect(structuredDataService.renameCategoryInArticles).toHaveBeenCalledWith('A', 'C');
  });

  it('blocks deleting a category used by any article category array', async () => {
    const provider = new CategoryProvider({} as any, {
      getAll: jest.fn().mockResolvedValue([
        { id: 2, category: 'A', categories: ['A', 'B'] },
      ]),
      hasCategory: jest.fn((article, category) =>
        (article.categories || [article.category]).includes(category),
      ),
    } as any, {
      getArticlesByCategory: jest.fn().mockResolvedValue([]),
      isInitialized: jest.fn().mockReturnValue(false),
    } as any);

    await expect(provider.deleteOne('B')).rejects.toThrow('分类已有文章，无法删除');
  });

  it('creates a category using the PG category list to determine the next sort value', async () => {
    const created = {
      toObject: () => ({
        id: 9,
        name: 'New Category',
        sort: 8,
        type: 'category',
        private: false,
      }),
    };
    const categoryModel = {
      create: jest.fn().mockResolvedValue(created),
    };
    const structuredDataService = {
      getCategoryByName: jest.fn().mockResolvedValue(null),
      isInitialized: jest.fn().mockReturnValue(true),
      listCategories: jest.fn().mockResolvedValue([
        { id: 1, name: 'A', sort: 2 },
        { id: 2, name: 'B', sort: 7 },
      ]),
      nextCategoryId: jest.fn().mockResolvedValue(9),
      upsertCategory: jest.fn().mockResolvedValue(undefined),
    };

    const provider = new CategoryProvider(
      categoryModel as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.addOne('  New Category  ');

    expect(categoryModel.create).toHaveBeenCalledWith({
      id: 9,
      name: 'New Category',
      type: 'category',
      private: false,
      sort: 8,
    });
    expect(structuredDataService.upsertCategory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, name: 'New Category', sort: 8 }),
    );
  });

  it('updates category sorts from a single PG snapshot instead of re-reading each category', async () => {
    const categoryModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      isInitialized: jest.fn().mockReturnValue(true),
      listCategories: jest.fn().mockResolvedValue([
        { id: 1, name: 'Alpha', sort: 3, type: 'category', private: false },
        { id: 2, name: 'Beta', sort: 4, type: 'category', private: false },
      ]),
      upsertCategory: jest.fn().mockResolvedValue(undefined),
    };

    const provider = new CategoryProvider(
      categoryModel as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.updateCategoriesSort({
      categories: [
        { name: 'Alpha', sort: 10 },
        { name: 'Beta', sort: 11 },
      ],
    } as any);

    expect(structuredDataService.listCategories).toHaveBeenCalledTimes(1);
    expect(categoryModel.updateOne).toHaveBeenNthCalledWith(1, { name: 'Alpha' }, { sort: 10 });
    expect(categoryModel.updateOne).toHaveBeenNthCalledWith(2, { name: 'Beta' }, { sort: 11 });
    expect(structuredDataService.upsertCategory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'Alpha', sort: 10 }),
    );
    expect(structuredDataService.upsertCategory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'Beta', sort: 11 }),
    );
  });

  it('initializes missing category sorts from one snapshot and syncs the filled values to PG', async () => {
    const categoryModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      isInitialized: jest.fn().mockReturnValue(true),
      listCategories: jest.fn().mockResolvedValue([
        { id: 1, name: 'Alpha', type: 'category', private: false, sort: null },
        { id: 2, name: 'Beta', type: 'category', private: false, sort: 8 },
        { id: 3, name: 'Gamma', type: 'category', private: false },
      ]),
      upsertCategory: jest.fn().mockResolvedValue(undefined),
    };

    const provider = new CategoryProvider(
      categoryModel as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.initializeCategoriesSort();

    expect(structuredDataService.listCategories).toHaveBeenCalledTimes(1);
    expect(categoryModel.updateOne).toHaveBeenCalledTimes(2);
    expect(categoryModel.updateOne).toHaveBeenNthCalledWith(1, { name: 'Alpha' }, { sort: 0 });
    expect(categoryModel.updateOne).toHaveBeenNthCalledWith(2, { name: 'Gamma' }, { sort: 2 });
    expect(structuredDataService.upsertCategory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'Alpha', sort: 0 }),
    );
    expect(structuredDataService.upsertCategory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'Gamma', sort: 2 }),
    );
  });
});
