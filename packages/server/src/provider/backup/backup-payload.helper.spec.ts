import {
  buildImportStages,
  buildImportSummary,
  normalizeBackupPayload,
  parseIncludeAnalyticsFlag,
  sanitizeRawCollectionsForBackup,
  throwIfImportFailures,
} from './backup-payload.helper';

describe('backup-payload.helper', () => {
  it('parses analytics include flag values consistently', () => {
    expect(parseIncludeAnalyticsFlag(true)).toBe(true);
    expect(parseIncludeAnalyticsFlag('true')).toBe(true);
    expect(parseIncludeAnalyticsFlag('YES')).toBe(true);
    expect(parseIncludeAnalyticsFlag('1')).toBe(true);
    expect(parseIncludeAnalyticsFlag('false')).toBe(false);
    expect(parseIncludeAnalyticsFlag(undefined)).toBe(false);
  });

  it('strips tokens from raw collections on export', () => {
    const sanitized = sanitizeRawCollectionsForBackup({
      articles: [{ id: 1 }],
      tokens: [{ token: 'secret' }],
    });

    expect(sanitized.articles).toEqual([{ id: 1 }]);
    expect(sanitized.tokens).toEqual([]);
  });

  it('normalizes legacy mongoCollections into top-level fields', () => {
    const normalized = normalizeBackupPayload({
      mongoCollections: {
        articles: [{ id: 1, title: 'A' }],
        metas: [{ siteInfo: { siteName: 'Blog' } }],
        users: [{ id: 0, name: 'admin' }],
        settings: [
          { type: 'static', value: { storageType: 'local' } },
          { type: 'layout', value: { css: '' } },
        ],
        comment_likes: [{ commentId: 1 }],
      },
    });

    expect(normalized.articles).toEqual([{ id: 1, title: 'A' }]);
    expect(normalized.meta).toEqual({ siteInfo: { siteName: 'Blog' } });
    expect(normalized.user).toEqual({ id: 0, name: 'admin' });
    expect(normalized.setting).toEqual({ static: { storageType: 'local' } });
    expect(normalized.layoutSetting).toEqual({ css: '' });
    expect(normalized.commentLikes).toEqual([{ commentId: 1 }]);
  });

  it('builds import summary and ordered stages from prepared payload', () => {
    const prepared: any = {
      backupVersion: '2.0.0',
      currentAdmin: { id: 0 },
      canRestoreProtectedData: false,
      includeAnalytics: false,
      meta: {},
      users: [{ id: 0 }],
      settings: [],
      categories: ['Tech'],
      tags: [],
      articles: [{ id: 1 }],
      drafts: [],
      viewer: [],
      visit: [],
      staticItems: [],
      moments: [],
      customPages: [],
      pipelines: [],
      tokens: [],
      navTools: [],
      navCategories: [],
      icons: [],
      documents: [],
      mindMaps: [],
      comments: [],
      commentLikes: [],
    };

    const summary = buildImportSummary(prepared);
    const stages = buildImportStages(prepared);

    expect(summary.counts.articles).toBe(1);
    expect(stages.map((stage) => stage.key)).toEqual([
      'cleanupExisting',
      'users',
      'meta',
      'categories',
      'articles',
      'analytics',
      'structuredData',
      'syncTags',
    ]);
  });

  it('throws with preview when import failures occur', () => {
    expect(() => throwIfImportFailures('articles', [])).not.toThrow();
    expect(() =>
      throwIfImportFailures('articles', ['a', 'b', 'c', 'd']),
    ).toThrow(/articles.*4.*a；b；c.*1/);
  });
});
