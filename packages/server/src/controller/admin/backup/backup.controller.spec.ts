import * as fs from 'fs';
import { BackupController } from './backup.controller';

describe('BackupController import mode', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const momentModel = Object.assign(
      jest.fn(() => ({
        save: jest.fn().mockResolvedValue(undefined),
      })),
      {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      },
    );
    const documentModel = Object.assign(
      jest.fn(() => ({
        save: jest.fn().mockResolvedValue(undefined),
      })),
      {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
        updateOne: jest.fn().mockResolvedValue(undefined),
      },
    );

    const articleProvider = {
      getTotalNum: jest.fn().mockResolvedValue(0),
      getAll: jest.fn().mockResolvedValue([]),
      articleModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.articleProvider,
    };
    const categoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue([]),
      categoryModal: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.categoryProvider,
    };
    const tagProvider = {
      getAllTagRecords: jest.fn().mockResolvedValue([]),
      syncTagsFromArticles: jest.fn().mockResolvedValue(undefined),
      tagModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.tagProvider,
    };
    const metaProvider = {
      getAll: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue(undefined),
      metaModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        updateOne: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.metaProvider,
    };
    const draftProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      draftModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.draftProvider,
    };
    const userProvider = {
      getUser: jest.fn().mockResolvedValue({
        id: 0,
        name: 'admin',
        password: 'current-hash',
        salt: 'current-salt',
        type: 'admin',
      }),
      getAllUsers: jest.fn().mockResolvedValue([{ id: 0, name: 'admin' }]),
      importUsers: jest.fn().mockResolvedValue(undefined),
      userModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.userProvider,
    };
    const viewerProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      import: jest.fn().mockResolvedValue(undefined),
      viewerModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.viewerProvider,
    };
    const visitProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      import: jest.fn().mockResolvedValue(undefined),
      visitModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.visitProvider,
    };
    const settingProvider = {
      getStaticSetting: jest.fn().mockResolvedValue({}),
      exportAllSettings: jest.fn().mockResolvedValue([]),
      getLayoutSetting: jest.fn().mockResolvedValue(null),
      importAllSettings: jest.fn().mockResolvedValue(undefined),
      importSetting: jest.fn().mockResolvedValue(undefined),
      updateLayoutSetting: jest.fn().mockResolvedValue(undefined),
      settingModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.settingProvider,
    };
    const staticProvider = {
      exportAll: jest.fn().mockResolvedValue([]),
      importItems: jest.fn().mockResolvedValue(undefined),
      staticModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.staticProvider,
    };
    const momentProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, moments: [] }),
      momentModel,
      getNewId: jest.fn().mockResolvedValue(1),
      ...overrides.momentProvider,
    };
    const customPageProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      customPageModal: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.customPageProvider,
    };
    const pipelineProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      pipelineModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.pipelineProvider,
    };
    const tokenProvider = {
      getAllTokens: jest.fn().mockResolvedValue([]),
      importTokens: jest.fn().mockResolvedValue(undefined),
      tokenModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.tokenProvider,
    };
    const navToolProvider = {
      getAllTools: jest.fn().mockResolvedValue([]),
      navToolModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.navToolProvider,
    };
    const navCategoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue([]),
      navCategoryModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.navCategoryProvider,
    };
    const iconProvider = {
      getAllIcons: jest.fn().mockResolvedValue([]),
      iconModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
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
      documentModel,
      ...overrides.documentProvider,
    };
    const mindMapProvider = {
      getByOption: jest.fn().mockResolvedValue({ total: 0, mindMaps: [] }),
      getAllForBackup: jest.fn().mockResolvedValue([]),
      importMindMaps: jest.fn().mockResolvedValue(undefined),
      mindMapModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
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
      expect.objectContaining({
        id: 0,
        name: 'admin',
        password: 'current-hash',
        salt: 'current-salt',
      }),
    ]);
    expect(metaProvider.metaModel.updateOne).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ siteInfo: { siteName: 'Migrated Blog' } }),
      { upsert: true },
    );
    expect(settingProvider.importAllSettings).toHaveBeenCalledWith(
      [{ type: 'menu', value: { data: [] } }],
      true,
    );
  });

  it('keeps only the current login credentials when importing into a non-empty instance', async () => {
    const { controller, userProvider, metaProvider, settingProvider, articleProvider } =
      createController({
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
    expect(articleProvider.articleModel.deleteMany).toHaveBeenCalled();
    expect(userProvider.userModel.deleteMany).toHaveBeenCalledWith({ id: { $ne: 0 } });
    expect(userProvider.importUsers).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 0,
        name: 'admin',
        password: 'current-hash',
        salt: 'current-salt',
      }),
    ]);
    expect(metaProvider.metaModel.updateOne).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        siteInfo: { siteName: 'Should Keep Current Site' },
        links: [{ name: 'demo', url: 'https://example.com' }],
      }),
      { upsert: true },
    );
    expect(settingProvider.importAllSettings).toHaveBeenCalledWith(
      [{ type: 'menu', value: { data: [] } }],
      true,
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
    expect(metaProvider.metaModel.updateOne).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ siteInfo: { siteName: 'Migrated From Raw Snapshot' } }),
      { upsert: true },
    );
    expect(settingProvider.importAllSettings).toHaveBeenCalledWith(
      expect.arrayContaining([{ type: 'menu', value: { data: [] } }]),
      true,
    );
    expect(tokenProvider.importTokens).toHaveBeenCalledWith([
      expect.objectContaining({ token: 'login-token', userId: 0 }),
    ]);
  });

  it('clears existing content and restores moments, documents and mind maps for a full-site import', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const documentModel = Object.assign(
      jest.fn(() => ({
        save: saveMock,
      })),
      {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
        updateOne: jest.fn().mockResolvedValue(undefined),
      },
    );

    const { controller, momentProvider, documentProvider, mindMapProvider, userProvider } =
      createController({
        articleProvider: {
          getTotalNum: jest.fn().mockResolvedValue(2),
        },
        documentProvider: {
          getNewId: jest.fn().mockResolvedValue(999),
          documentModel,
        },
        mindMapProvider: {
          mindMapModel: {
            deleteMany: jest.fn().mockResolvedValue(undefined),
          },
          importMindMaps: jest.fn().mockResolvedValue(undefined),
        },
      });

    const result = await controller.importAll({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '3.0.0' },
          moments: [{ id: 1, content: 'moment-1', createdAt: '2026-04-01T00:00:00.000Z' }],
          documents: [
            { id: 10, type: 'library', title: 'Docs', path: [], library_id: null, parent_id: null },
            {
              id: 11,
              type: 'document',
              title: 'Secret',
              path: [10],
              library_id: 10,
              parent_id: null,
              content: 'top-secret',
            },
          ],
          mindMaps: [{ _id: 'mind-1', title: 'Mind', content: '{}' }],
        }),
      ),
    } as any);

    expect(result.statusCode).toBe(200);
    expect(momentProvider.momentModel.deleteMany).toHaveBeenCalled();
    expect(documentProvider.documentModel.deleteMany).toHaveBeenCalled();
    expect(mindMapProvider.mindMapModel.deleteMany).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(mindMapProvider.importMindMaps).toHaveBeenCalledWith([
      expect.objectContaining({ _id: 'mind-1', title: 'Mind' }),
    ]);
    expect(userProvider.importUsers).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'admin', password: 'current-hash', salt: 'current-salt' }),
    ]);
  });
});
