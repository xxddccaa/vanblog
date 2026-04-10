import { InitProvider } from './init.provider';

describe('InitProvider', () => {
  const createStatefulModel = <T extends Record<string, any>>(initialValue: T | null = null) => {
    let currentValue = initialValue;

    return {
      getCurrent: () => currentValue,
      model: {
        findOne: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue(currentValue),
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(currentValue),
          }),
        })),
        updateOne: jest.fn(async (_filter: any, payload: T) => {
          currentValue = { ...(currentValue || {}), ...payload };
        }),
        create: jest.fn(async (payload: T) => {
          currentValue = payload;
          return {
            toObject: () => currentValue,
          };
        }),
      },
    };
  };

  const createProvider = (options: { existingAdmin?: any; existingMeta?: any } = {}) => {
    const userState = createStatefulModel(options.existingAdmin ?? null);
    const metaState = createStatefulModel(options.existingMeta ?? null);
    const walineProvider = {
      init: jest.fn().mockResolvedValue(undefined),
    };
    const settingProvider = {
      updateMenuSetting: jest.fn().mockResolvedValue(undefined),
      getStaticSetting: jest.fn().mockResolvedValue(null),
      updateStaticSetting: jest.fn().mockResolvedValue(undefined),
      getVersionSetting: jest.fn().mockResolvedValue(null),
      updateVersionSetting: jest.fn().mockResolvedValue(undefined),
    };
    const cacheProvider = {
      set: jest.fn().mockResolvedValue(undefined),
    };
    const websiteProvider = {
      restart: jest.fn().mockResolvedValue(undefined),
    };
    const structuredDataService = {
      upsertUser: jest.fn().mockResolvedValue(undefined),
      upsertMeta: jest.fn().mockResolvedValue(undefined),
    };

    const provider = new InitProvider(
      metaState.model as any,
      userState.model as any,
      {} as any,
      {} as any,
      walineProvider as any,
      settingProvider as any,
      cacheProvider as any,
      websiteProvider as any,
      structuredDataService as any,
    );

    return {
      provider,
      userState,
      metaState,
      walineProvider,
      settingProvider,
      cacheProvider,
      websiteProvider,
      structuredDataService,
    };
  };

  it('initializes a fresh site and syncs the admin user and meta to structured storage', async () => {
    const {
      provider,
      userState,
      metaState,
      walineProvider,
      settingProvider,
      websiteProvider,
      structuredDataService,
    } = createProvider();

    const result = await provider.init({
      user: {
        username: 'dong',
        password: 'encrypted-password',
        nickname: 'Dong',
      },
      siteInfo: {
        siteName: 'Dong Blog',
        author: 'Dong',
      },
    } as any);

    expect(result).toBe('初始化成功!');
    expect(userState.getCurrent()).toEqual(
      expect.objectContaining({
        id: 0,
        name: 'dong',
        nickname: 'Dong',
        type: 'admin',
      }),
    );
    expect(metaState.getCurrent()).toEqual(
      expect.objectContaining({
        siteInfo: expect.objectContaining({
          siteName: 'Dong Blog',
          author: 'Dong',
          since: expect.any(Date),
        }),
      }),
    );
    expect(settingProvider.updateMenuSetting).toHaveBeenCalled();
    expect(structuredDataService.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 0, name: 'dong' }),
    );
    expect(structuredDataService.upsertMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        siteInfo: expect.objectContaining({ siteName: 'Dong Blog' }),
      }),
    );
    expect(walineProvider.init).toHaveBeenCalled();
    expect(websiteProvider.restart).toHaveBeenCalledWith('初始化');
  });

  it('updates the existing admin instead of creating a duplicate user', async () => {
    const existingAdmin = {
      id: 0,
      name: 'legacy-admin',
      password: 'legacy-password',
      salt: 'legacy-salt',
      nickname: 'Legacy',
      type: 'admin',
    };
    const { provider, userState, structuredDataService } = createProvider({
      existingAdmin,
      existingMeta: {
        siteInfo: { siteName: 'Legacy Blog' },
        links: [],
        socials: [],
        menus: [],
        rewards: [],
        about: { updatedAt: new Date(), content: '' },
        categories: [],
        viewer: 0,
        visited: 0,
        totalWordCount: 0,
      },
    });

    await provider.init({
      user: {
        username: 'current-admin',
        password: 'encrypted-password',
        nickname: 'Current',
      },
      siteInfo: {
        siteName: 'Restored Site',
      },
    } as any);

    expect(userState.getCurrent()).toEqual(
      expect.objectContaining({
        id: 0,
        name: 'current-admin',
        nickname: 'Current',
        type: 'admin',
      }),
    );
    expect(structuredDataService.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 0, name: 'current-admin' }),
    );
  });

  it('reports initialization state based on whether a user exists', async () => {
    const fresh = createProvider();
    expect(await fresh.provider.checkHasInited()).toBe(false);

    const initialized = createProvider({
      existingAdmin: {
        id: 0,
        name: 'admin',
      },
    });
    expect(await initialized.provider.checkHasInited()).toBe(true);
  });

  it('fills safe defaults when optional site info is omitted during initialization', async () => {
    const { provider, metaState, structuredDataService } = createProvider();

    await provider.init({
      user: {
        username: 'debug',
        password: 'encrypted-password',
        nickname: 'Debug Nick',
      },
      siteInfo: {},
    } as any);

    expect(metaState.getCurrent()).toEqual(
      expect.objectContaining({
        siteInfo: expect.objectContaining({
          author: 'Debug Nick',
          authorDesc: '',
          authorLogo: '',
          favicon: '',
          siteName: 'VanBlog',
          siteDesc: '',
          baseUrl: '',
          since: expect.any(Date),
        }),
      }),
    );
    expect(structuredDataService.upsertMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        siteInfo: expect.objectContaining({
          author: 'Debug Nick',
          siteName: 'VanBlog',
        }),
      }),
    );
  });
});
