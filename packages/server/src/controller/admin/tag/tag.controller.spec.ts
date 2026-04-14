import { TagController } from './tag.controller';

describe('TagController', () => {
  const createController = () => {
    const tagProvider = {
      getTagsPaginated: jest.fn().mockResolvedValue({ tags: [], total: 0 }),
      getHotTags: jest.fn().mockResolvedValue([]),
      searchTags: jest.fn().mockResolvedValue([]),
      getAllTags: jest.fn().mockResolvedValue([]),
    };
    const isrProvider = {
      activeAll: jest.fn(),
    };
    const publicDataCacheProvider = {
      clearTagData: jest.fn(),
    };

    return {
      controller: new TagController(
        tagProvider as any,
        isrProvider as any,
        publicDataCacheProvider as any,
      ),
      tagProvider,
    };
  };

  it('clamps oversized admin tag pagination before querying the provider', async () => {
    const { controller, tagProvider } = createController();

    await controller.getTagsPaginated('0', '999', 'articleCount', 'desc');

    expect(tagProvider.getTagsPaginated).toHaveBeenCalledWith(
      1,
      100,
      'articleCount',
      'desc',
      undefined,
    );
  });

  it('clamps admin tag hot/search limits to bounded values', async () => {
    const { controller, tagProvider } = createController();

    await controller.getHotTags('999');
    await controller.searchTags('cache', '0');

    expect(tagProvider.getHotTags).toHaveBeenCalledWith(50);
    expect(tagProvider.searchTags).toHaveBeenCalledWith('cache', 20);
  });
});
