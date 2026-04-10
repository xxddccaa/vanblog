import { PublicController } from './public.controller';

describe('PublicController', () => {
  const createController = () => {
    const metaProvider = {
      addViewer: jest.fn().mockResolvedValue({ total: 1 }),
      getSiteInfo: jest.fn().mockResolvedValue({
        siteName: 'VanBlog',
        siteDesc: 'desc',
        siteLogo: '/logo.png',
        favicon: '/favicon.ico',
        beianNumber: 'ICP',
        beianUrl: 'https://example.com',
        gaBeianNumber: '',
        gaBeianUrl: '',
        gaBeianLogoUrl: '',
        since: '2024',
        baseUrl: 'https://blog.example.com',
      }),
    };
    const iconProvider = {
      getAllIcons: jest.fn().mockResolvedValue([{ name: 'github' }]),
    };
    const cacheStore = new Map<string, any>();
    const cacheProvider = {
      get: jest.fn().mockImplementation(async (key: string) => cacheStore.get(key) ?? null),
      set: jest.fn().mockImplementation(async (key: string, value: any) => {
        cacheStore.set(key, value);
      }),
    };

    const controller = new PublicController(
      {} as any,
      {} as any,
      {} as any,
      metaProvider as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      iconProvider as any,
      {} as any,
      cacheProvider as any,
      {} as any,
    );

    return { controller, metaProvider, iconProvider, cacheProvider };
  };

  it('skips viewer updates when referer is missing', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {},
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: null,
    });
    expect(metaProvider.addViewer).not.toHaveBeenCalled();
  });

  it('skips viewer updates when referer is invalid', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {
        referer: 'not-a-valid-url',
      },
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: null,
    });
    expect(metaProvider.addViewer).not.toHaveBeenCalled();
  });

  it('records the decoded referer pathname when referer is valid', async () => {
    const { controller, metaProvider } = createController();

    const result = await controller.addViewer(true, false, {
      headers: {
        referer: 'https://blog.example.com/post/test%20article',
      },
    } as any);

    expect(metaProvider.addViewer).toHaveBeenCalledWith(true, '/post/test article', false);
    expect(result).toEqual({
      statusCode: 200,
      data: { total: 1 },
    });
  });

  it('caches public icon responses to reduce repeated provider queries', async () => {
    const { controller, iconProvider, cacheProvider } = createController();

    const first = await controller.getAllIcons();
    const second = await controller.getAllIcons();

    expect(first).toEqual({
      statusCode: 200,
      data: [{ name: 'github' }],
    });
    expect(second).toEqual(first);
    expect(iconProvider.getAllIcons).toHaveBeenCalledTimes(1);
    expect(cacheProvider.set).toHaveBeenCalledWith('public:icon:all', [{ name: 'github' }], 300);
  });
});
