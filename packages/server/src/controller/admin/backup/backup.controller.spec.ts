import * as fs from 'fs';
import { BackupController } from './backup.controller';

describe('BackupController import mode', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const articleModel = Object.assign(
      jest.fn(() => ({
        save: jest.fn().mockResolvedValue(undefined),
      })),
      {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      },
    );
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
      articleModel,
      getNewId: jest.fn().mockResolvedValue(1),
      findOneByTitle: jest.fn().mockResolvedValue(null),
      updateById: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
      ...overrides.articleProvider,
    };
    const categoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue([]),
      addOne: jest.fn().mockResolvedValue(undefined),
      updateCategoryByName: jest.fn().mockResolvedValue(undefined),
      categoryModal: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.categoryProvider,
    };
    const tagProvider = {
      getAllTagRecords: jest.fn().mockResolvedValue([]),
      syncTagsFromArticles: jest.fn().mockResolvedValue(undefined),
      invalidateCache: jest.fn().mockResolvedValue(undefined),
      tagModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.tagProvider,
    };
    const metaProvider = {
      getAll: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue(undefined),
      updateTotalWords: jest.fn().mockResolvedValue(undefined),
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
      deleteCustomPage: jest.fn().mockResolvedValue(undefined),
      deleteOneBySign: jest.fn().mockResolvedValue(undefined),
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
      getCustomPageByPath: jest.fn().mockResolvedValue(null),
      createCustomPage: jest.fn().mockResolvedValue(undefined),
      updateCustomPage: jest.fn().mockResolvedValue(undefined),
      deleteByPath: jest.fn().mockResolvedValue(undefined),
      customPageModal: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.customPageProvider,
    };
    const pipelineProvider = {
      getAll: jest.fn().mockResolvedValue([]),
      getPipelineById: jest.fn().mockResolvedValue(null),
      createPipeline: jest.fn().mockResolvedValue(undefined),
      updatePipelineById: jest.fn().mockResolvedValue(undefined),
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
      createTool: jest.fn().mockResolvedValue(undefined),
      updateTool: jest.fn().mockResolvedValue(undefined),
      navToolModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.navToolProvider,
    };
    const navCategoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue([]),
      createCategory: jest.fn().mockResolvedValue(undefined),
      updateCategory: jest.fn().mockResolvedValue(undefined),
      navCategoryModel: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
      },
      ...overrides.navCategoryProvider,
    };
    const iconProvider = {
      getAllIcons: jest.fn().mockResolvedValue([]),
      getIconByName: jest.fn().mockResolvedValue(null),
      createIcon: jest.fn().mockResolvedValue(undefined),
      updateIcon: jest.fn().mockResolvedValue(undefined),
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
    const structuredDataService = {
      refreshAllFromRecordStore: jest.fn().mockResolvedValue(undefined),
      refreshCollectionsFromRecordStore: jest.fn().mockResolvedValue(undefined),
      clearStructuredDataForRestore: jest.fn().mockResolvedValue(undefined),
      deleteAllSettings: jest.fn().mockResolvedValue(undefined),
      deleteAllStatics: jest.fn().mockResolvedValue(undefined),
      deleteUsersExcept: jest.fn().mockResolvedValue(undefined),
      upsertMeta: jest.fn().mockResolvedValue(undefined),
      upsertDraft: jest.fn().mockResolvedValue(undefined),
      upsertMoment: jest.fn().mockResolvedValue(undefined),
      upsertDocument: jest.fn().mockResolvedValue(undefined),
      ...overrides.structuredDataService,
    };
    const backupImportJobProvider = {
      createJob: jest.fn().mockResolvedValue({
        created: true,
        job: { id: 'job-1' },
      }),
      getJob: jest.fn().mockResolvedValue(null),
      getActiveJob: jest.fn().mockResolvedValue(null),
      markRunning: jest.fn().mockResolvedValue(undefined),
      startStage: jest.fn().mockResolvedValue(undefined),
      advanceStage: jest.fn().mockResolvedValue(undefined),
      completeStage: jest.fn().mockResolvedValue(undefined),
      skipStage: jest.fn().mockResolvedValue(undefined),
      completeJob: jest.fn().mockResolvedValue(undefined),
      failJob: jest.fn().mockResolvedValue(undefined),
      ...overrides.backupImportJobProvider,
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
      structuredDataService as any,
      backupImportJobProvider as any,
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
      structuredDataService,
      backupImportJobProvider,
    };
  };

  it('exports full-site backup data including compatibility raw collections', async () => {
    let downloadCallback: (() => void) | undefined;
    const download = jest.fn((name, cb) => {
      downloadCallback = cb;
    });
    const { controller, categoryProvider, tagProvider, tokenProvider, mongoBackupProvider } =
      createController({
        categoryProvider: {
          getAllCategories: jest.fn().mockResolvedValue([{ id: 1, name: 'Tech' }]),
        },
        customPageProvider: {
          getAll: jest.fn().mockResolvedValue([{ path: '/landing', type: 'folder' }]),
        },
        tagProvider: {
          getAllTagRecords: jest.fn().mockResolvedValue([{ name: 'cloudflare', articleCount: 3 }]),
        },
        staticProvider: {
          exportAll: jest.fn().mockResolvedValue([
            { sign: 'img-1', storageType: 'local', staticType: 'img' },
          ]),
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
    expect(exportedJson.tokens).toEqual([]);
    expect(exportedJson.rawCollections).toEqual({
      articles: [{ id: 1, title: 'post' }],
      tokens: [],
    });
    expect(exportedJson.mongoCollections).toEqual(exportedJson.rawCollections);
    expect(exportedJson.backupInfo.rawCollectionCounts).toEqual({
      articles: 1,
      tokens: 0,
    });
    expect(exportedJson.backupInfo.mongoCollectionCounts).toEqual(
      exportedJson.backupInfo.rawCollectionCounts,
    );
    expect(exportedJson.backupInfo.credentialWarnings).toEqual({
      tokensExcluded: true,
      message:
        '为避免凭证泄露，JSON 备份不会导出登录会话 Token 或 API Token；恢复后需重新登录并重新创建 API Token。',
    });
    expect(exportedJson.backupInfo.artifactWarnings).toEqual({
      embedded: false,
      localStaticFiles: 1,
      customPageFolders: 1,
      message:
        '当前 JSON 备份不会内嵌本地静态文件和 folder 型自定义页面的实际文件内容；恢复时只会导入数据库记录。',
    });
    expect(download).toHaveBeenCalledWith(
      expect.stringMatching(/^vanblog-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/),
      expect.any(Function),
    );
    downloadCallback?.();
    expect(fs.existsSync(exportedPath)).toBe(false);
  });

  it('restores users and site info when importing into a fresh instance', async () => {
    const { controller, userProvider, metaProvider, settingProvider, structuredDataService } =
      createController();

    const result = await controller.importAllSync({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '4.0.0', formatVersion: '4.0.0' },
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
    expect(structuredDataService.refreshAllFromRecordStore).toHaveBeenCalledWith('backup-import');
    expect(structuredDataService.refreshCollectionsFromRecordStore).not.toHaveBeenCalled();
  });

  it('keeps only the current login credentials when importing into a non-empty instance', async () => {
    const {
      controller,
      userProvider,
      metaProvider,
      settingProvider,
      articleProvider,
      structuredDataService,
      tokenProvider,
      customPageProvider,
      staticProvider,
    } = createController({
      articleProvider: {
        getTotalNum: jest.fn().mockResolvedValue(1),
      },
      customPageProvider: {
        getAll: jest.fn().mockResolvedValue([{ path: '/landing', type: 'folder' }]),
      },
      staticProvider: {
        exportAll: jest.fn().mockResolvedValue([{ sign: 'img-1' }]),
      },
    });

    const result = await controller.importAllSync({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '4.0.0', formatVersion: '4.0.0' },
          users: [{ id: 0, name: 'admin', password: 'hash', salt: 'salt' }],
          tokens: [{ token: 'stale-admin-token', userId: 0 }],
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
    expect(staticProvider.deleteCustomPage).toHaveBeenCalledWith('/landing');
    expect(staticProvider.deleteOneBySign).toHaveBeenCalledWith('img-1');
    expect(userProvider.userModel.deleteMany).toHaveBeenCalledWith({ id: { $ne: 0 } });
    expect(structuredDataService.clearStructuredDataForRestore).toHaveBeenCalledWith([0]);
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
    expect(tokenProvider.importTokens).not.toHaveBeenCalled();
    expect(structuredDataService.refreshAllFromRecordStore).toHaveBeenCalledWith('backup-import');
    expect(structuredDataService.refreshCollectionsFromRecordStore).not.toHaveBeenCalled();
  });

  it('preserves imported admin profile fields while keeping the current login credentials', async () => {
    const { controller, userProvider } = createController({
      articleProvider: {
        getTotalNum: jest.fn().mockResolvedValue(1),
      },
      userProvider: {
        getUser: jest.fn().mockResolvedValue({
          id: 0,
          name: 'current-admin',
          password: 'current-hash',
          salt: 'current-salt',
          nickname: 'Current Nickname',
          avatar: 'current-avatar.png',
          type: 'admin',
        }),
      },
    });

    const result = await controller.importAllSync({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '4.0.0', formatVersion: '4.0.0' },
          users: [
            {
              id: 0,
              name: 'legacy-admin',
              password: 'legacy-hash',
              salt: 'legacy-salt',
              nickname: 'Legacy Nickname',
              avatar: 'legacy-avatar.png',
              introduction: 'keep-my-profile',
              type: 'admin',
            },
          ],
          meta: { siteInfo: { siteName: 'Restored Blog' } },
          settings: [{ type: 'menu', value: { data: [] } }],
        }),
      ),
    } as any);

    expect(result.statusCode).toBe(200);
    expect(userProvider.importUsers).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 0,
        name: 'current-admin',
        password: 'current-hash',
        salt: 'current-salt',
        nickname: 'Legacy Nickname',
        avatar: 'legacy-avatar.png',
        introduction: 'keep-my-profile',
      }),
    ]);
  });

  it('can hydrate import data from raw mongo collections when logical fields are absent', async () => {
    const { controller, userProvider, metaProvider, settingProvider, tokenProvider } =
      createController();

    const result = await controller.importAllSync({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '4.0.0', formatVersion: '4.0.0' },
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
    expect(tokenProvider.importTokens).not.toHaveBeenCalled();
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

    const result = await controller.importAllSync({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '4.0.0', formatVersion: '4.0.0' },
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

  it('restores articles with direct create saves instead of per-title merge lookups', async () => {
    const articleSaveMock = jest.fn().mockResolvedValue(undefined);
    const articleModel = Object.assign(
      jest.fn(() => ({
        save: articleSaveMock,
      })),
      {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue(null),
      },
    );

    const { controller, articleProvider, structuredDataService } = createController({
      articleProvider: {
        articleModel,
        findOneByTitle: jest.fn(() => {
          throw new Error('fast restore should not call title merge lookup');
        }),
      },
    });

    const result = await controller.importAllSync({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '4.0.0', formatVersion: '4.0.0' },
          articles: [
            { id: 1, title: 'Article A', content: 'alpha', category: 'Tech', tags: ['a'] },
            { id: 2, title: 'Article B', content: 'beta', category: 'Tech', tags: ['b'] },
          ],
        }),
      ),
    } as any);

    expect(result.statusCode).toBe(200);
    expect(articleSaveMock).toHaveBeenCalledTimes(2);
    expect(articleProvider.findOneByTitle).not.toHaveBeenCalled();
    expect(structuredDataService.refreshCollectionsFromRecordStore).toHaveBeenCalledWith(
      ['articles'],
      'backup-import',
    );
  });

  it('fails synchronously when required article categories cannot be recreated during restore', async () => {
    const { controller, structuredDataService } = createController({
      categoryProvider: {
        getAllCategories: jest.fn().mockResolvedValue([]),
        addOne: jest.fn().mockRejectedValue(new Error('duplicate key')),
      },
    });

    const result = await controller.importAllSync({
      buffer: Buffer.from(
        JSON.stringify({
          backupInfo: { version: '4.0.0', formatVersion: '4.0.0' },
          articles: [{ id: 1, title: 'Article A', content: 'alpha', category: 'Tech', tags: [] }],
        }),
      ),
    } as any);

    expect(result.statusCode).toBe(500);
    expect((result as any).message).toContain('articles 分类 恢复不完整');
    expect(structuredDataService.refreshAllFromRecordStore).not.toHaveBeenCalled();
    expect(structuredDataService.refreshCollectionsFromRecordStore).not.toHaveBeenCalled();
  });

  it('fails the restore instead of reporting success when a custom page import is only partially applied', async () => {
    const { controller, customPageProvider, backupImportJobProvider, structuredDataService } =
      createController({
        customPageProvider: {
          getCustomPageByPath: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null),
          createCustomPage: jest
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('disk write failed')),
        },
      });

    const importResult = await controller.importAll(
      {
        buffer: Buffer.from(
          JSON.stringify({
            backupInfo: { version: '4.0.0', formatVersion: '4.0.0' },
            customPages: [
              { path: '/ok', title: 'ok', html: '<p>ok</p>' },
              { path: '/broken', title: 'broken', html: '<p>bad</p>' },
            ],
          }),
        ),
      } as any,
      {},
    );

    expect(importResult.statusCode).toBe(202);

    await new Promise((resolve) => setImmediate(resolve));

    expect(customPageProvider.createCustomPage).toHaveBeenCalledTimes(2);

    const failedJobCall = backupImportJobProvider.failJob.mock.calls[0];
    expect(failedJobCall[0]).toBe('job-1');
    expect(failedJobCall[1]).toContain('自定义页面 恢复不完整');
    expect(failedJobCall[1]).toContain('/broken');

    expect(backupImportJobProvider.completeJob).not.toHaveBeenCalled();
    expect(structuredDataService.refreshAllFromRecordStore).not.toHaveBeenCalled();
    expect(structuredDataService.refreshCollectionsFromRecordStore).not.toHaveBeenCalled();
  });

  it('clears site initialization state, persisted files, and structured data when clear-all is requested', async () => {
    const {
      controller,
      userProvider,
      metaProvider,
      settingProvider,
      structuredDataService,
      tokenProvider,
      customPageProvider,
      staticProvider,
    } = createController({
      articleProvider: {
        findAll: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      },
      draftProvider: {
        getAll: jest.fn().mockResolvedValue([{ id: 3 }]),
      },
      momentProvider: {
        getByOption: jest.fn().mockResolvedValue({ total: 2, moments: [{ id: 4 }, { id: 5 }] }),
      },
      customPageProvider: {
        getAll: jest.fn().mockResolvedValue([{ path: '/landing', type: 'folder' }]),
      },
      navToolProvider: {
        getAllTools: jest.fn().mockResolvedValue([]),
        deleteTool: jest.fn().mockResolvedValue(undefined),
      },
      navCategoryProvider: {
        getAllCategories: jest.fn().mockResolvedValue([]),
        deleteCategory: jest.fn().mockResolvedValue(undefined),
      },
      iconProvider: {
        deleteAllIcons: jest.fn().mockResolvedValue(undefined),
      },
      pipelineProvider: {
        getAll: jest.fn().mockResolvedValue([]),
        deletePipelineById: jest.fn().mockResolvedValue(undefined),
      },
      documentProvider: {
        getByOption: jest.fn().mockResolvedValue({ total: 1, documents: [{ id: 6 }] }),
      },
      mindMapProvider: {
        getByOption: jest.fn().mockResolvedValue({ total: 1, mindMaps: [{ _id: 'mind-1' }] }),
        mindMapModel: {
          deleteMany: jest.fn().mockResolvedValue(undefined),
        },
      },
      viewerProvider: {
        getAll: jest.fn().mockResolvedValue([{ id: 7 }]),
        viewerModel: {
          deleteMany: jest.fn().mockResolvedValue(undefined),
        },
      },
      visitProvider: {
        getAll: jest.fn().mockResolvedValue([{ id: 8 }]),
        visitModel: {
          deleteMany: jest.fn().mockResolvedValue(undefined),
        },
      },
      staticProvider: {
        exportAll: jest.fn().mockResolvedValue([{ id: 9, sign: 'static-1' }]),
        staticModel: {
          deleteMany: jest.fn().mockResolvedValue(undefined),
        },
      },
      tokenProvider: {
        disableAll: jest.fn().mockResolvedValue(undefined),
        tokenModel: {
          deleteMany: jest.fn().mockResolvedValue(undefined),
        },
      },
      categoryProvider: {
        getAllCategories: jest.fn().mockResolvedValue([]),
      },
      tagProvider: {
        syncTagsFromArticles: jest.fn().mockResolvedValue(undefined),
        getAllTags: jest.fn().mockResolvedValue([]),
        tagModel: {
          deleteMany: jest.fn().mockResolvedValue(undefined),
        },
      },
    });

    const result = await controller.clearAllData();

    expect(result.statusCode).toBe(200);
    expect(metaProvider.metaModel.deleteMany).toHaveBeenCalledWith({});
    expect(userProvider.userModel.deleteMany).toHaveBeenCalledWith({});
    expect(settingProvider.settingModel.deleteMany).toHaveBeenCalledWith({});
    expect(staticProvider.deleteCustomPage).toHaveBeenCalledWith('/landing');
    expect(customPageProvider.deleteByPath).toHaveBeenCalledWith('/landing');
    expect(staticProvider.deleteOneBySign).toHaveBeenCalledWith('static-1');
    expect(tokenProvider.disableAll).toHaveBeenCalled();
    expect(structuredDataService.deleteUsersExcept).toHaveBeenCalledWith([]);
    expect(structuredDataService.deleteAllSettings).toHaveBeenCalled();
    expect(structuredDataService.refreshAllFromRecordStore).toHaveBeenCalledWith('clear-all');
  });
});
