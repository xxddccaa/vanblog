import { StructuredDataService } from './structured-data.service';

describe('StructuredDataService', () => {
  const flushAsyncWork = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('clamps user sequence updates to at least 1 when restoring admin id 0', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await (service as any).ensureSequenceAtLeast('vanblog_users_id_seq', 0);

    expect(store.query).toHaveBeenCalledWith(
      expect.stringContaining('GREATEST('),
      ['vanblog_users_id_seq', 'vanblog_users_id_seq', 0, 1],
    );
  });

  it('persists admin user id 0 without attempting to move the sequence below 1', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.upsertUser({
      id: 0,
      name: 'dong',
      password: 'hash',
      salt: 'salt',
      type: 'admin',
    });

    expect(store.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT setval'),
      ['vanblog_users_id_seq', 'vanblog_users_id_seq', 0, 1],
    );
    expect(store.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO vanblog_users'),
      expect.arrayContaining([0, 'dong', 'hash']),
    );
  });

  it('serializes concurrent article table refreshes to avoid overlapping rebuilds', async () => {
    const store = {
      getAll: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    let releaseFirst!: () => void;
    const firstReplace = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const replaceArticles = jest
      .spyOn(service as any, 'replaceArticles')
      .mockImplementationOnce(async () => await firstReplace)
      .mockResolvedValue(undefined);

    const first = service.refreshArticlesFromRecordStore('first');
    await flushAsyncWork();
    const second = service.refreshArticlesFromRecordStore('second');
    await flushAsyncWork();

    expect(replaceArticles).toHaveBeenCalledTimes(1);

    releaseFirst();
    await Promise.all([first, second]);

    expect(replaceArticles).toHaveBeenCalledTimes(2);
    expect(store.getAll).toHaveBeenCalledTimes(2);
    expect(store.getAll).toHaveBeenNthCalledWith(1, 'articles');
    expect(store.getAll).toHaveBeenNthCalledWith(2, 'articles');
  });

  it('serializes concurrent article tag rebuilds during upsertArticle', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    let releaseFirst!: () => void;
    const firstReplaceTags = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const replaceArticleTags = jest
      .spyOn(service as any, 'replaceArticleTags')
      .mockImplementationOnce(async () => await firstReplaceTags)
      .mockResolvedValue(undefined);
    const rebuildTagAggregates = jest
      .spyOn(service as any, 'rebuildTagAggregates')
      .mockResolvedValue(undefined);

    const first = service.upsertArticle({
      id: 1,
      title: 'first',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      tags: ['alpha'],
    });
    await flushAsyncWork();
    const second = service.upsertArticle({
      id: 2,
      title: 'second',
      createdAt: new Date('2024-01-02T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      tags: ['beta'],
    });
    await flushAsyncWork();

    expect(replaceArticleTags).toHaveBeenCalledTimes(1);
    expect(rebuildTagAggregates).not.toHaveBeenCalled();

    releaseFirst();
    await Promise.all([first, second]);

    expect(replaceArticleTags).toHaveBeenCalledTimes(2);
    expect(rebuildTagAggregates).toHaveBeenCalledTimes(2);
  });

  it('uses the summary article select for list views so admin/article does not fetch full content', async () => {
    const store = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: '2394' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.queryArticles(
      {
        page: 1,
        pageSize: 20,
        regMatch: true,
        toListView: true,
      },
      false,
    );

    expect(store.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`''::text AS content`),
      [20, 0],
    );
  });

  it('keeps the full article select when preview content is requested', async () => {
    const store = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: '10' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.queryArticles(
      {
        page: 1,
        pageSize: 20,
        regMatch: true,
        toListView: true,
        withPreviewContent: true,
      },
      false,
    );

    expect(store.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('a.content'),
      [20, 0],
    );
  });

  it('uses the summary draft select for list views so draft management does not fetch full content', async () => {
    const store = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: '88' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.queryDrafts({
      page: 1,
      pageSize: 20,
      toListView: true,
    });

    expect(store.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`''::text AS content`),
      [20, 0],
    );
  });

  it('uses the summary document select for list views so document trees stay lightweight', async () => {
    const store = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: '12' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.queryDocuments({
      page: 1,
      pageSize: 20,
      toListView: true,
    });

    expect(store.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`''::text AS content`),
      [20, 0],
    );
  });

  it('lists documents without content by default so library trees do not fetch full bodies', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.listDocuments({ type: 'library' });

    expect(store.query).toHaveBeenCalledWith(
      expect.stringContaining(`''::text AS content`),
      ['library'],
    );
  });

  it('lists custom pages without html by default so custom page management stays lightweight', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.listCustomPages();

    expect(store.query).toHaveBeenCalledWith(
      expect.stringContaining(`''::text AS html`),
    );
  });
});
