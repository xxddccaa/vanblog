import { BackupImportJobProvider } from './backup-import-job.provider';

describe('BackupImportJobProvider', () => {
  const createProvider = () => {
    const store = new Map<string, any>();
    const cacheProvider = {
      get: jest.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
      set: jest.fn(async (key: string, value: any) => {
        store.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    };

    return {
      provider: new BackupImportJobProvider(cacheProvider as any),
      cacheProvider,
    };
  };

  it('tracks queued, running and completed progress for staged imports', async () => {
    const { provider } = createProvider();

    const created = await provider.createJob([
      { key: 'articles', label: '恢复文章', total: 4 },
      { key: 'analytics', label: '访问统计', total: 2 },
    ]);

    expect(created.created).toBe(true);
    expect(created.job.status).toBe('queued');
    expect(created.job.progress).toBe(0);

    await provider.markRunning(created.job.id, '开始导入');
    await provider.startStage(created.job.id, 'articles', '准备导入文章');
    await provider.advanceStage(created.job.id, 'articles', 2, '已处理一半');

    let running = await provider.getJob(created.job.id);
    expect(running?.status).toBe('running');
    expect(running?.currentStageKey).toBe('articles');
    expect(running?.progress).toBe(33);

    await provider.completeStage(created.job.id, 'articles', '文章已恢复');
    await provider.skipStage(created.job.id, 'analytics', '默认跳过统计数据');
    await provider.completeJob(created.job.id, { imported: true }, '导入完成');

    const completed = await provider.getJob(created.job.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.progress).toBe(100);
    expect(completed?.result).toEqual({ imported: true });
    expect(completed?.stages).toEqual([
      expect.objectContaining({ key: 'articles', status: 'completed', completed: 4 }),
      expect.objectContaining({ key: 'analytics', status: 'skipped', completed: 2 }),
    ]);
    expect(await provider.getActiveJob()).toBeNull();
  });

  it('rejects a second queued job while one import is already active', async () => {
    const { provider } = createProvider();

    const first = await provider.createJob([{ key: 'meta', label: '恢复站点信息', total: 1 }]);
    const second = await provider.createJob([{ key: 'meta', label: '恢复站点信息', total: 1 }]);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);

    await provider.failJob(first.job.id, '导入失败');

    const third = await provider.createJob([{ key: 'meta', label: '恢复站点信息', total: 1 }]);
    expect(third.created).toBe(true);
    expect(third.job.id).not.toBe(first.job.id);
  });

  it('keeps terminal jobs immutable so later duplicate updates cannot overwrite the final state', async () => {
    const { provider } = createProvider();

    const created = await provider.createJob([{ key: 'meta', label: '恢复站点信息', total: 1 }]);
    await provider.markRunning(created.job.id, '开始导入');
    await provider.completeJob(created.job.id, { imported: true }, '导入完成');
    await provider.failJob(created.job.id, '迟到的失败');
    await provider.completeJob(created.job.id, { imported: false }, '重复完成');

    const finished = await provider.getJob(created.job.id);
    expect(finished?.status).toBe('completed');
    expect(finished?.message).toBe('导入完成');
    expect(finished?.result).toEqual({ imported: true });
    expect(finished?.error).toBeUndefined();
  });
});
