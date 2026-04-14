import { NavCategoryProvider } from './nav-category.provider';

describe('NavCategoryProvider', () => {
  it('updates nav category sort order in PG without refreshing the whole structured table', async () => {
    const navCategoryModel = {
      bulkWrite: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      updateNavCategorySorts: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new NavCategoryProvider(
      navCategoryModel as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.updateCategoriesSort([
      { id: 'alpha', sort: 1 },
      { id: 'beta', sort: 2 },
    ]);

    expect(navCategoryModel.bulkWrite).toHaveBeenCalledTimes(1);
    expect(structuredDataService.updateNavCategorySorts).toHaveBeenCalledWith(
      [
        { id: 'alpha', sort: 1 },
        { id: 'beta', sort: 2 },
      ],
      expect.any(Date),
    );
  });
});
