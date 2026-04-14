jest.mock('src/config', () => ({
  config: {
    log: '/var/log',
  },
}));

jest.mock('picgo', () => ({
  PicGo: class PicGo {},
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import * as fs from 'fs';
import { AutoBackupTask } from './auto-backup.task';

describe('AutoBackupTask', () => {
  beforeEach(() => {
    jest
      .spyOn(AutoBackupTask.prototype as any, 'initializeDynamicTasks')
      .mockImplementation(async () => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const createTask = (overrides: Record<string, any> = {}) =>
    new AutoBackupTask(
      { getAll: jest.fn().mockResolvedValue([]), ...overrides.articleProvider } as any,
      { getAllCategories: jest.fn().mockResolvedValue([]), ...overrides.categoryProvider } as any,
      { getAllTagRecords: jest.fn().mockResolvedValue([]), ...overrides.tagProvider } as any,
      { getAll: jest.fn().mockResolvedValue({}), ...overrides.metaProvider } as any,
      { getAll: jest.fn().mockResolvedValue([]), ...overrides.draftProvider } as any,
      {
        getUser: jest.fn().mockResolvedValue({ id: 0, name: 'admin' }),
        getAllUsers: jest.fn().mockResolvedValue([]),
        ...overrides.userProvider,
      } as any,
      { getAll: jest.fn().mockResolvedValue([]), ...overrides.viewerProvider } as any,
      { getAll: jest.fn().mockResolvedValue([]), ...overrides.visitProvider } as any,
      {
        getAutoBackupSetting: jest.fn().mockResolvedValue({
          enabled: false,
          backupTime: '03:00',
          retentionCount: 10,
          aliyunpan: {
            enabled: false,
            syncTime: '03:30',
            localPath: '/app/static',
            panPath: '/backup/vanblog-static',
          },
        }),
        getStaticSetting: jest.fn().mockResolvedValue({}),
        exportAllSettings: jest.fn().mockResolvedValue([]),
        getLayoutSetting: jest.fn().mockResolvedValue(null),
        ...overrides.settingProvider,
      } as any,
      { exportAll: jest.fn().mockResolvedValue([]), ...overrides.staticProvider } as any,
      { getByOption: jest.fn().mockResolvedValue({ moments: [] }), ...overrides.momentProvider } as any,
      { getAll: jest.fn().mockResolvedValue([]), ...overrides.customPageProvider } as any,
      { getAll: jest.fn().mockResolvedValue([]), ...overrides.pipelineProvider } as any,
      { getAllTokens: jest.fn().mockResolvedValue([]), ...overrides.tokenProvider } as any,
      { getAllTools: jest.fn().mockResolvedValue([]), ...overrides.navToolProvider } as any,
      { getAllCategories: jest.fn().mockResolvedValue([]), ...overrides.navCategoryProvider } as any,
      { getAllIcons: jest.fn().mockResolvedValue([]), ...overrides.iconProvider } as any,
      { getConfig: jest.fn().mockResolvedValue(null), ...overrides.aiTaggingProvider } as any,
      { ...overrides.aliyunpanProvider } as any,
      { getByOption: jest.fn().mockResolvedValue({ documents: [] }), ...overrides.documentProvider } as any,
      { getAllForBackup: jest.fn().mockResolvedValue([]), ...overrides.mindMapProvider } as any,
      { exportAllCollections: jest.fn().mockResolvedValue({}), ...overrides.mongoBackupProvider } as any,
    );

  it('stores automatic backups under the non-public log directory', () => {
    const task = createTask();

    expect((task as any).backupDir).toBe('/var/log/backups');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/var/log/backups', { recursive: true });
  });

  it('lists backup files from the non-public backup directory only', () => {
    (fs.readdirSync as jest.Mock).mockReturnValueOnce(['vanblog-backup-a.json', 'note.txt']);
    (fs.statSync as jest.Mock).mockReturnValue({
      size: 123,
      birthtime: new Date('2026-04-13T10:00:00.000Z'),
      mtime: new Date('2026-04-13T11:00:00.000Z'),
    });
    const task = createTask();

    const files = task.getBackupFiles();

    expect(fs.readdirSync).toHaveBeenLastCalledWith('/var/log/backups');
    expect(fs.statSync).toHaveBeenCalledWith('/var/log/backups/vanblog-backup-a.json');
    expect(files).toHaveLength(1);
    expect(files[0]).toEqual(
      expect.objectContaining({
        name: 'vanblog-backup-a.json',
        size: 123,
      }),
    );
  });

  it('excludes active tokens from automatic json backups', async () => {
    const task = createTask({
      articleProvider: {
        getAll: jest.fn().mockResolvedValue([{ id: 1, title: 'post' }]),
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

    await task.executeBackup();

    const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls;
    const backupJsonCall = writeCalls.find((call) => String(call[0]).includes('/var/log/backups/'));

    expect(backupJsonCall).toBeTruthy();
    const payload = JSON.parse(String(backupJsonCall![1]));

    expect(payload.tokens).toEqual([]);
    expect(payload.rawCollections).toEqual({
      articles: [{ id: 1, title: 'post' }],
      tokens: [],
    });
    expect(payload.mongoCollections).toEqual(payload.rawCollections);
    expect(payload.backupInfo.counts.tokens).toBe(0);
    expect(payload.backupInfo.rawCollectionCounts.tokens).toBe(0);
    expect(payload.backupInfo.credentialWarnings).toEqual({
      tokensExcluded: true,
      message:
        '为避免凭证泄露，自动 JSON 备份不会导出登录会话 Token 或 API Token；恢复后需重新登录并重新创建 API Token。',
    });
  });
});
