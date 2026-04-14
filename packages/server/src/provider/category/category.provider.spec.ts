import { CategoryProvider } from './category.provider';

describe('CategoryProvider', () => {
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
