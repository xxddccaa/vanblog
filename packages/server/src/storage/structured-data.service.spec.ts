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

  it('creates and backfills materialized article search columns with index coverage', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.ensureSchema();

    const schemaSql = store.query.mock.calls.map(([sql]) => String(sql)).join('\n');
    expect(schemaSql).toContain(
      `ALTER TABLE vanblog_articles ADD COLUMN IF NOT EXISTS search_vector TSVECTOR`,
    );
    expect(schemaSql).toContain(
      `ALTER TABLE vanblog_articles ADD COLUMN IF NOT EXISTS categories_text TEXT`,
    );
    expect(schemaSql).toContain('SET\n        categories_text = array_to_string(categories');
    expect(schemaSql).toContain(
      'categories_text IS DISTINCT FROM array_to_string(categories, \' \')',
    );
    expect(schemaSql).toContain('search_vector IS DISTINCT FROM');
    expect(schemaSql).toContain(
      'idx_vanblog_articles_search_vector ON vanblog_articles USING GIN (search_vector)',
    );
    expect(schemaSql).toContain(
      'idx_vanblog_articles_category_trgm ON vanblog_articles USING GIN (category gin_trgm_ops)',
    );
    expect(schemaSql).toContain(
      'idx_vanblog_articles_categories_text_trgm ON vanblog_articles USING GIN (categories_text gin_trgm_ops)',
    );
    expect(schemaSql).toContain(
      'idx_vanblog_articles_author_trgm ON vanblog_articles USING GIN (author gin_trgm_ops)',
    );
    expect(schemaSql).toContain(
      'idx_vanblog_article_tags_name_trgm ON vanblog_article_tags USING GIN (tag_name gin_trgm_ops)',
    );
  });

  it('synchronizes article search columns during upsert and replacement', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);
    jest.spyOn(service as any, 'ensureSequenceAtLeast').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'replaceArticleTags').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'rebuildTagAggregates').mockResolvedValue(undefined);

    const article = {
      id: 7,
      title: 'Search title',
      content: 'Search content',
      category: 'Primary',
      categories: ['Primary', 'Secondary'],
      author: 'Author',
      tags: ['tag'],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    };

    await service.upsertArticle(article);
    await (service as any).replaceArticles([article]);

    const articleWrites = store.query.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.includes('INSERT INTO vanblog_articles'));
    expect(articleWrites).toHaveLength(2);
    for (const sql of articleWrites) {
      expect(sql).toContain('categories_text, search_vector');
      expect(sql).toContain(`array_to_string($5::text[], ' ')`);
      expect(sql).toContain(`setweight(to_tsvector('simple', COALESCE($2, '')), 'A')`);
      expect(sql).toContain(`setweight(to_tsvector('simple', COALESCE($3, '')), 'D')`);
    }
    expect(articleWrites[0]).toContain('categories_text = EXCLUDED.categories_text');
    expect(articleWrites[0]).toContain('search_vector = EXCLUDED.search_vector');
  });

  it('builds indexed article candidate unions before ranking the joined rows', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.searchArticles('rare phrase', false, 25);

    expect(store.query).toHaveBeenCalledTimes(1);
    const [sql, params] = store.query.mock.calls[0];
    expect(sql).toContain('candidate_ids AS MATERIALIZED');
    expect(String(sql).match(/\sUNION\s/g) || []).toHaveLength(6);
    expect(sql).toContain('a.search_vector @@ q.query');
    expect(sql).toContain(`a.title ILIKE '%' || $1 || '%'`);
    expect(sql).toContain(`a.content ILIKE '%' || $1 || '%'`);
    expect(sql).toContain(`a.category ILIKE '%' || $1 || '%'`);
    expect(sql).toContain(`a.categories_text ILIKE '%' || $1 || '%'`);
    expect(sql).toContain(`a.author ILIKE '%' || $1 || '%'`);
    expect(sql).toContain(`t.tag_name ILIKE '%' || $1 || '%'`);
    expect(sql).toContain('INNER JOIN candidate_ids c ON c.id = a.id');
    expect(sql).toContain('a.deleted = FALSE');
    expect(sql).toContain('a.hidden = FALSE');
    expect(sql).toContain('ts_rank_cd(a.search_vector, q.query) DESC');
    expect(sql).toContain('a.top_value DESC');
    expect(sql).toContain('a.created_at DESC');
    expect(sql).not.toContain(`to_tsvector('simple', COALESCE(a.title`);
    expect(params).toEqual(['rare phrase', 25]);
  });

  it('returns timeline years and the latest visible timestamp from one SQL snapshot', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            year: 2026,
            article_count: 2,
            latest_timestamp: '2026-04-12T00:00:00.000Z',
          },
          {
            year: 2025,
            article_count: 1,
            latest_timestamp: '2026-04-12T00:00:00.000Z',
          },
        ],
      }),
    };
    const service = new StructuredDataService(store as any);

    await expect(service.getTimelineSummaryPayload(false)).resolves.toEqual({
      summary: [
        { year: '2026', articleCount: 2 },
        { year: '2025', articleCount: 1 },
      ],
      latestTimestamp: '2026-04-12T00:00:00.000Z',
    });
    expect(store.query).toHaveBeenCalledTimes(1);
    expect(store.query.mock.calls[0][0]).toContain(
      'MAX(MAX(COALESCE(a.updated_at, a.created_at))) OVER () AS latest_timestamp',
    );
    expect(store.query.mock.calls[0][0]).toContain('a.deleted = FALSE');
    expect(store.query.mock.calls[0][0]).toContain('a.hidden = FALSE');
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

  it('increments article views by pathname in one SQL statement with pathname precedence', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 12 }] }),
    };
    const service = new StructuredDataService(store as any);

    await expect(service.incrementArticleViewerByPathname('123', true)).resolves.toBe(true);

    expect(store.query).toHaveBeenCalledTimes(1);
    const [sql, params] = store.query.mock.calls[0];
    expect(sql).toContain('WITH input AS');
    expect(sql).toContain('target AS');
    expect(sql).toContain('UNION ALL');
    expect(sql).toContain("WHEN input.numeric_pathname IS NOT NULL");
    expect(sql).toContain("input.numeric_pathname <= '9223372036854775807'");
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM target)');
    expect(sql).toContain('RETURNING a.id');
    expect(params).toEqual(['123', 1]);
  });

  it('does not cast an out-of-range numeric pathname to bigint', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await expect(
      service.incrementArticleViewerByPathname('9223372036854775808', true),
    ).resolves.toBe(false);

    const [sql, params] = store.query.mock.calls[0];
    expect(sql).toContain('length(input.numeric_pathname) <= 19');
    expect(params).toEqual(['9223372036854775808', 1]);
  });

  it('increments non-new pathname visits without increasing unique visitors', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 12 }] }),
    };
    const service = new StructuredDataService(store as any);

    await expect(service.incrementArticleViewerByPathname('article-path', false)).resolves.toBe(true);

    expect(store.query.mock.calls[0][1]).toEqual(['article-path', 0]);
  });

  it('falls back to a numeric article id when no pathname matches', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 42 }] }),
    };
    const service = new StructuredDataService(store as any);

    await expect(service.incrementArticleViewerByPathname('42', true)).resolves.toBe(true);

    const [sql, params] = store.query.mock.calls[0];
    expect(sql).toContain('a.id = CASE');
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM target)');
    expect(params).toEqual(['42', 1]);
  });

  it('returns false when neither pathname nor numeric id resolves', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await expect(service.incrementArticleViewerByPathname('missing', true)).resolves.toBe(false);
  });

  it('builds one structured related-article query with score and fallback ordering', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 2,
            title: 'Related',
            content: '',
            categories: ['Engineering'],
            tags: ['typescript'],
            created_at: new Date('2024-01-02T00:00:00.000Z'),
          },
        ],
      }),
    };
    const service = new StructuredDataService(store as any);

    await expect(service.getRelatedPublicArticles(1, 5)).resolves.toEqual([
      expect.objectContaining({ id: 2, title: 'Related' }),
    ]);

    expect(store.query).toHaveBeenCalledTimes(1);
    const [sql, params] = store.query.mock.calls[0];
    expect(sql).toContain('WITH current_article AS');
    expect(sql).toContain('AND a.hidden = FALSE');
    expect(sql).toContain('AND a.id <> c.id');
    expect(sql).toContain('category.private_flag = TRUE');
    expect(sql).toContain('a.hidden,\n            a.private_flag,\n            a.deleted');
    expect(sql).toContain('THEN 3');
    expect(sql).toContain(') * 2');
    expect(sql).toContain('LEAST(COALESCE(candidate_base.viewer, 0), 500)');
    expect(sql).toContain('score > 0');
    expect(sql).toContain('bucket ASC');
    expect(sql).toContain('top_value > 0');
    expect(sql).toContain('LIMIT $2');
    expect(params).toEqual([1, 5]);
  });

  it('does not query structured storage for a non-positive related limit', async () => {
    const store = {
      query: jest.fn(),
    };
    const service = new StructuredDataService(store as any);

    await expect(service.getRelatedPublicArticles(1, 0)).resolves.toEqual([]);
    expect(store.query).not.toHaveBeenCalled();
  });

  it('uses the summary article select only when explicitly requested', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.listArticles({ includeContent: false });
    await service.listArticles();

    expect(store.query.mock.calls[0][0]).toContain(`''::text AS content`);
    expect(store.query.mock.calls[1][0]).toContain('a.content');
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

  it('matches tags exactly (not substring) when regMatch is false so tag pages exclude Django/Google for Go', async () => {
    const store = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.queryArticles(
      { page: 1, pageSize: -1, regMatch: false, tags: 'Go', toListView: true },
      true,
    );

    const [countSql, countParams] = store.query.mock.calls[0];
    expect(countSql).toContain('t.tag_name = ANY(');
    expect(countSql).not.toContain('t.tag_name ILIKE');
    expect(countParams).toContainEqual(['Go']);
  });

  it('filters archive month via session-timezone EXTRACT so detail matches the archive summary buckets', async () => {
    const store = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.getArchiveMonthArticles('2024', '2', true);

    const [countSql, countParams] = store.query.mock.calls[0];
    // Must use the same EXTRACT(...) grouping basis as getArchiveSummary,
    // not absolute UTC created_at bounds (which drop month-boundary articles).
    expect(countSql).toContain('EXTRACT(YEAR FROM a.created_at)::int =');
    expect(countSql).toContain('EXTRACT(MONTH FROM a.created_at)::int =');
    expect(countSql).not.toContain('a.created_at >=');
    expect(countParams).toEqual([2024, 2]);
  });
});
