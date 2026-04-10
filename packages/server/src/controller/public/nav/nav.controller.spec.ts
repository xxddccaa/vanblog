import { NavController } from './nav.controller';

describe('NavController', () => {
  it('caches public nav payloads in the shared cache', async () => {
    const cacheStore = new Map<string, any>();
    const cacheProvider = {
      get: jest.fn().mockImplementation(async (key: string) => cacheStore.get(key) ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: any) => {
        cacheStore.set(key, value);
      }),
    };
    const controller = new NavController(
      {
        getAllTools: jest.fn().mockResolvedValue([
          { _id: 'tool-1', categoryId: 'cat-1', hide: false },
          { _id: 'tool-2', categoryId: 'cat-2', hide: true },
        ]),
      } as any,
      {
        getAllCategories: jest.fn().mockResolvedValue([
          { _id: 'cat-1', hide: false },
          { _id: 'cat-2', hide: false },
        ]),
      } as any,
      {} as any,
      cacheProvider as any,
    );

    const first = await controller.getNavData();
    const second = await controller.getNavData();

    expect(first).toEqual({
      statusCode: 200,
      data: {
        categories: [{ _id: 'cat-1', hide: false }],
        tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false }],
      },
    });
    expect(second).toEqual(first);
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:nav:data',
      {
        categories: [{ _id: 'cat-1', hide: false }],
        tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false }],
      },
      300,
    );
  });
});
