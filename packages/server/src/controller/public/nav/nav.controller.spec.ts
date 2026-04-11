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
        __lastModified: undefined,
        data: {
          categories: [{ _id: 'cat-1', hide: false }],
          tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false }],
        },
      },
      300,
    );
  });

  it('unwraps cached public nav envelopes without re-querying providers', async () => {
    const cacheStore = new Map<string, any>();
    const navToolProvider = {
      getAllTools: jest.fn(),
    };
    const navCategoryProvider = {
      getAllCategories: jest.fn(),
    };
    const cacheProvider = {
      get: jest.fn().mockImplementation(async (key: string) => cacheStore.get(key) ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: any) => {
        cacheStore.set(key, value);
      }),
    };
    await cacheProvider.set(
      'public:nav:data',
      {
        __lastModified: '2026-04-11T00:00:00.000Z',
        data: {
          categories: [{ _id: 'cat-1', hide: false }],
          tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false }],
        },
      },
      300,
    );
    const headers = new Map<string, string>();
    const controller = new NavController(
      navToolProvider as any,
      navCategoryProvider as any,
      {} as any,
      cacheProvider as any,
    );

    const result = await controller.getNavData({
      setHeader: (key: string, value: string) => headers.set(key, value),
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        categories: [{ _id: 'cat-1', hide: false }],
        tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false }],
      },
    });
    expect((result.data as any).__lastModified).toBeUndefined();
    expect(navToolProvider.getAllTools).not.toHaveBeenCalled();
    expect(navCategoryProvider.getAllCategories).not.toHaveBeenCalled();
    expect(headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('sets Last-Modified from the latest public nav payload timestamp', async () => {
    const headers = new Map<string, string>();
    const cacheProvider = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new NavController(
      {
        getAllTools: jest.fn().mockResolvedValue([
          {
            _id: 'tool-1',
            categoryId: 'cat-1',
            hide: false,
            updatedAt: '2026-04-11T00:00:00.000Z',
          },
        ]),
      } as any,
      {
        getAllCategories: jest.fn().mockResolvedValue([
          { _id: 'cat-1', hide: false, updatedAt: '2026-04-10T00:00:00.000Z' },
        ]),
      } as any,
      {} as any,
      cacheProvider as any,
    );

    await controller.getNavData({
      setHeader: (key: string, value: string) => headers.set(key, value),
    } as any);

    expect(headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('caches admin nav payloads as envelopes so repeated reads do not re-query providers', async () => {
    const cacheStore = new Map<string, any>();
    const navToolProvider = {
      getAllTools: jest.fn().mockResolvedValue([
        { _id: 'tool-1', categoryId: 'cat-1', hide: false, updatedAt: '2026-04-11T00:00:00.000Z' },
      ]),
    };
    const navCategoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue([
        { _id: 'cat-1', hide: false, updatedAt: '2026-04-10T00:00:00.000Z' },
      ]),
    };
    const cacheProvider = {
      get: jest.fn().mockImplementation(async (key: string) => cacheStore.get(key) ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: any) => {
        cacheStore.set(key, value);
      }),
    };
    const headers = new Map<string, string>();
    const controller = new NavController(
      navToolProvider as any,
      navCategoryProvider as any,
      {} as any,
      cacheProvider as any,
    );

    const first = await controller.getAdminNavData({
      setHeader: (key: string, value: string) => headers.set(key, value),
    } as any);
    const second = await controller.getAdminNavData({
      setHeader: (key: string, value: string) => headers.set(key, value),
    } as any);

    expect(first).toEqual({
      statusCode: 200,
      data: {
        categories: [{ _id: 'cat-1', hide: false, updatedAt: '2026-04-10T00:00:00.000Z' }],
        tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false, updatedAt: '2026-04-11T00:00:00.000Z' }],
      },
    });
    expect(second).toEqual(first);
    expect(navToolProvider.getAllTools).toHaveBeenCalledTimes(1);
    expect(navCategoryProvider.getAllCategories).toHaveBeenCalledTimes(1);
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'public:nav:admin-data',
      {
        __lastModified: '2026-04-11T00:00:00.000Z',
        data: {
          categories: [{ _id: 'cat-1', hide: false, updatedAt: '2026-04-10T00:00:00.000Z' }],
          tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false, updatedAt: '2026-04-11T00:00:00.000Z' }],
        },
      },
      120,
    );
    expect(headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('unwraps cached admin nav envelopes without re-querying providers', async () => {
    const cacheStore = new Map<string, any>();
    const navToolProvider = {
      getAllTools: jest.fn(),
    };
    const navCategoryProvider = {
      getAllCategories: jest.fn(),
    };
    const cacheProvider = {
      get: jest.fn().mockImplementation(async (key: string) => cacheStore.get(key) ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: any) => {
        cacheStore.set(key, value);
      }),
    };
    await cacheProvider.set(
      'public:nav:admin-data',
      {
        __lastModified: '2026-04-11T00:00:00.000Z',
        data: {
          categories: [{ _id: 'cat-1', hide: false }],
          tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false }],
        },
      },
      120,
    );
    const headers = new Map<string, string>();
    const controller = new NavController(
      navToolProvider as any,
      navCategoryProvider as any,
      {} as any,
      cacheProvider as any,
    );

    const result = await controller.getAdminNavData({
      setHeader: (key: string, value: string) => headers.set(key, value),
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        categories: [{ _id: 'cat-1', hide: false }],
        tools: [{ _id: 'tool-1', categoryId: 'cat-1', hide: false }],
      },
    });
    expect((result.data as any).__lastModified).toBeUndefined();
    expect(navToolProvider.getAllTools).not.toHaveBeenCalled();
    expect(navCategoryProvider.getAllCategories).not.toHaveBeenCalled();
    expect(headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });
});
