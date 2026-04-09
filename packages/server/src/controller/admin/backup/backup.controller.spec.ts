import * as fs from 'fs';
import { BackupController } from './backup.controller';

describe('BackupController import mode', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const articleProvider = {
      getTotalNum: jest.fn().mockResolvedValue(0),
      getAll: jest.fn().mockResolvedValue([]),
      ...overrides.articleProvider,
    };
    const categoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue([]),
      ...overrides.categoryProvider,
    };
    const tagProvider = {
      getAllTagRecords: jest.fn().mockResolvedValue([]),
      syncTagsFromArticles: jest.fn().mockResolvedValue(undefined),
      ...overrides.tagProvider,
    };
    const metaProvider = {
      getAll: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides.metaProvider,
    };
    const draftProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      ...overrides.draftProvider,
    };
    const userProvider = {
      getUser: jest.fn().mockResolvedValue({ id: 0, name: 'admin' }),
      getAllUsers: jest.fn().mockResolvedValue([{ id: 0, name: 'admin' }]),
      importUsers: jest.fn().mockResolvedValue(undefined),
      ...overrides.userProvider,
    };
    const viewerProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      import: jest.fn().mockResolvedValue(undefined),
      ...overrides.viewerProvider,
    };
    const visitProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      import: jest.fn().mockResolvedValue(undefined),
      ...overrides.visitProvider,
    };
    const settingProvider = {
      getStaticSetting: jest.fn().mockResolvedValue({}),
      exportAllSettings: jest.fn().mockResolvedValue([]),
      getLayoutSetting: jest.fn().mockResolvedValue(null),
      importAllSettings: jest.fn().mockResolvedValue(undefined),
      importSetting: jest.fn().mockResolvedValue(undefined),
      updateLayoutSetting: jest.fn().mockResolvedValue(undefined),
      ...overrides.settingProvider,
    };
    const staticProvider = {
      exportAll: jest.fn().mockResolvedValue([]),
      importItems: jest.fn().mockResolvedValue(undefined),
      ...overrides.staticProvider,
    };
    const momentProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, moments: [] }),
      ...overrides.momentProvider,
    };
    const customPageProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      ...overrides.customPageProvider,
    };
    const pipelineProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      ...overrides.pipelineProvider,
    };
    const tokenProvider = {
      getAllTokens: jest.fn().mockResolvedValue([]),
      importTokens: jest.fn().mockResolvedValue(undefined),
      ...overrides.tokenProvider,
    };
    const navToolProvider = {
      getAllTools: jest.fn().mockResolvedValue([]),
      ...overrides.navToolProvider,
    };
    const navCategoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue([]),
      ...overrides.navCategoryProvider,
    };
    const iconProvider = {
      getAllIcons: jest.fn().mockResolvedValue([]),
      ...overrides.iconProvider,
    };
    const isrProvider = {
      activeAll: jest.fn(),
      activeUrl: jest.fn(),
      activePath: jest.fn(),
      ...overrides.isrProvider,
    };
    const aiTaggingProvider = {
      getConfig: jest.fn().mockResolvedValue(null),
      updateConfig: jest.fn().mockResolvedValue(undefined),
      ...overrides.aiTaggingProvider,
    };
    const documentProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, documents: [] }),
      ...overrides.documentProvider,
    };
    const mindMapProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, mindMaps: [] }),
      getAllForBackup: jest.fn().mockResolvedValue([]),
      importMindMaps: jest.fn().mockResolvedValue(undefined),
      ...overrides.mindMapProvider,
    };
    const mongoBackupProvider = {
      exportAllCollections: jest.fn().mockResolvedValue({}),
      ...overrides.mongoBackupProvider,
    };

    const controller = new BackupController(
      articleProvider as any,
      categoryProvider as any,
      tagProvider as any,
      metaProvider as any,
      draftProvider as any,
      userProvider as any,
      viewerProvider as any,
      visitProvider as any,
      settingProvider as any,
      staticProvider as any,
      momentProvider as any,
      customPageProvider as any,
      pipelineProvider as any,
      tokenProvider as any,
      navToolProvider as any,
      navCategoryProvider as any,
      iconProvider as any,
      isrProvider as any,
      aiTaggingProvider as any,
      documentProvider as any,
      mindMapProvider as any,
      mongoBackupProvider as any,
    );

    return {
      controller,
      articleProvider,
      categoryProvider,
      tagProvider,
      metaProvider,
      draftProvider,
      userProvider,
      viewerProvider,
      visitProvider,
      settingProvider,
      staticProvider,
      momentProvider,
      customPageProvider,
      tokenProvider,
      navToolProvider,
      navCategoryProvider,
      isrProvider,
      aiTaggingProvider,
      documentProvider,
      mindMapProvider,
      mongoBackupProvider,
    };
  };

  it('exports full-system migration data including all tokens and raw mongo collections', async () => {
    let downloadCallback: (() => void) | undefined;
    const download = jest.fn((name, cb) => {
      downloadCallback = cb;
    });
    const { controller, categoryProvider, tagProvider, tokenProvider, mongoBackupProvider } =
      createController({
        categoryProvider: {
          getAllCategories: jest.fn().mockResolvedValue([{ id: 1, name: 'Tech' }]),
        },
        tagProvider: {
          getAllTagRecords: jest.fn().mockResolvedValue([{ name: 'cloudflare', articleCount: 3 }]),
        },
        tokenProvider: {
          getAllTokens: jest.fn().mockResolvedValue([
            { token: 'api-token', userId: 666666 },
            { token: 'login-token', userId: 0 },
          ]),
        },
        mongoBackupProvider: {
          exportAllCollections: jest.fn().mockResolvedValue({
            articles: [{ id: 1, title: 'post' }],
            tokens: [{ token: 'login-token', userId: 0 }],
          }),
        },
      });

    await controller.getAll({ download } as any);

    const exportedPath = download.mock.calls[0][0] as string;
    const exportedJson = JSON.parse(fs.readFileSync(exportedPath, 'utf-8'));

    expect(categoryProvider.getAllCategories).toHaveBeenCalledWith(true);
    expect(tagProvider.getAllTagRecords).toHaveBeenCalled();
    expect(tokenProvider.getAllTokens).toHaveBeenCalled();
    expect(mongoBackupProvider.exportAllCollections).toHaveBeenCalled();
    expect(exportedJson.tokens).toEqual([
      expect.objectContaining({ token: 'api-token', userId: 666666 }),
      expect.objectContaining({ token: 'login-token', userId: 0 }),
    ]);
    expect(exportedJson.mongoCollections).toEqual({
      articles: [{ id: 1, title: 'post' }],
      tokens: [{ token: 'login-token', userId: 0 }],
    });
    expect(exportedJson.backupInfo.mongoCollectionCounts).toEqual({
      articles: 1,
      tokens: 1,
    });
    expect(download).toHaveBeenCalledWith(
      expect.stringMatching(/^vanblog-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/),
      expect.any(Function),
    );
    downloadCallback?.();
    expect(fs.existsSync(exportedPath)).toBe(false);
  });

  it('restores users and site info when importing into a fresh instance', async () => {
    const { controller, userProvider, metaProvider, settingProvider } = createController();

    const result = await controller.importAll({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '3.0.0' },
          users: [{ id: 0, name: 'admin', password: 'hash', salt: 'salt' }],
          meta: { siteInfo: { siteName: 'Migrated Blog' }, links: [] },
          settings: [{ type: 'menu', value: { data: [] } }],
        }),
      ),
    } as any);

    expect(result.statusCode).toBe(200);
    expect(userProvider.importUsers).toHaveBeenCalledWith([
      expect.objectContaining({ id: 0, name: 'admin' }),
    ]);
    expect(metaProvider.update).toHaveBeenCalledWith(
      expect.objectContaining({ siteInfo: { siteName: 'Migrated Blog' } }),
    );
    expect(settingProvider.importAllSettings).toHaveBeenCalledWith(
      [{ type: 'menu', value: { data: [] } }],
      true,
    );
  });

  it('keeps the current user and site info when importing into a non-empty instance', async () => {
    const { controller, userProvider, metaProvider, settingProvider } = createController({
      articleProvider: {
        getTotalNum: jest.fn().mockResolvedValue(1),
      },
    });

    const result = await controller.importAll({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '3.0.0' },
          users: [{ id: 0, name: 'admin', password: 'hash', salt: 'salt' }],
          meta: {
            siteInfo: { siteName: 'Should Keep Current Site' },
            links: [{ name: 'demo', url: 'https://example.com' }],
          },
          settings: [{ type: 'menu', value: { data: [] } }],
        }),
      ),
    } as any);

    expect(result.statusCode).toBe(200);
    expect(userProvider.importUsers).not.toHaveBeenCalled();
    expect(metaProvider.update).toHaveBeenCalledWith({
      links: [{ name: 'demo', url: 'https://example.com' }],
    });
    expect(settingProvider.importAllSettings).toHaveBeenCalledWith(
      [{ type: 'menu', value: { data: [] } }],
      false,
    );
  });

  it('can hydrate import data from raw mongo collections when logical fields are absent', async () => {
    const { controller, userProvider, metaProvider, settingProvider, tokenProvider } =
      createController();

    const result = await controller.importAll({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '3.0.0' },
          mongoCollections: {
            users: [{ id: 0, name: 'admin', password: 'hash', salt: 'salt' }],
            metas: [{ siteInfo: { siteName: 'Migrated From Raw Snapshot' } }],
            settings: [
              { type: 'static', value: { title: 'static-setting' } },
              { type: 'menu', value: { data: [] } },
            ],
            tokens: [{ token: 'login-token', userId: 0 }],
          },
        }),
      ),
    } as any);

    expect(result.statusCode).toBe(200);
    expect(userProvider.importUsers).toHaveBeenCalledWith([
      expect.objectContaining({ id: 0, name: 'admin' }),
    ]);
    expect(metaProvider.update).toHaveBeenCalledWith(
      expect.objectContaining({ siteInfo: { siteName: 'Migrated From Raw Snapshot' } }),
    );
    expect(settingProvider.importAllSettings).toHaveBeenCalledWith(
      expect.arrayContaining([{ type: 'menu', value: { data: [] } }]),
      true,
    );
    expect(tokenProvider.importTokens).toHaveBeenCalledWith([
      expect.objectContaining({ token: 'login-token', userId: 0 }),
    ]);
  });
});
