import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { StructuredDataService } from './structured-data.service';

const databaseUrl = process.env.VANBLOG_SEARCH_TEST_DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('StructuredDataService PostgreSQL article search', () => {
  let client: Client;
  let service: StructuredDataService;
  let schema: string;
  let lastQuery: { sql: string; params: any[] } | null;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    schema = `vanblog_search_${randomUUID().replace(/-/g, '')}`;
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    const store = {
      query: async (sql: string, params: any[] = []) => {
        lastQuery = { sql, params };
        return await client.query(sql, params);
      },
    };
    service = new StructuredDataService(store as any);
    await service.ensureSchema();
  }, 120000);

  afterAll(async () => {
    if (!client) {
      return;
    }
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });

  beforeEach(async () => {
    lastQuery = null;
    await client.query('TRUNCATE TABLE vanblog_articles CASCADE');
  });

  it('preserves weighted and substring matches across every public article field', async () => {
    const common = {
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    };
    await service.upsertArticle({
      ...common,
      id: 1,
      title: 'needle',
      content: 'plain',
      category: 'General',
      categories: ['General'],
      author: 'Writer',
      top: 0,
    });
    await service.upsertArticle({
      ...common,
      id: 2,
      title: 'Content match',
      content: 'needle',
      category: 'General',
      categories: ['General'],
      author: 'Writer',
      top: 999,
    });
    await service.upsertArticle({
      ...common,
      id: 3,
      title: 'Category match',
      content: 'plain',
      category: 'preNeedlePost',
      categories: ['preNeedlePost'],
      author: 'Writer',
    });
    await service.upsertArticle({
      ...common,
      id: 4,
      title: 'Secondary category match',
      content: 'plain',
      category: 'General',
      categories: ['General', 'preNeedleSecondary'],
      author: 'Writer',
    });
    await service.upsertArticle({
      ...common,
      id: 5,
      title: 'Author match',
      content: 'plain',
      category: 'General',
      categories: ['General'],
      author: 'preNeedleAuthor',
    });
    await service.upsertArticle({
      ...common,
      id: 6,
      title: 'Tag match',
      content: 'plain',
      category: 'General',
      categories: ['General'],
      author: 'Writer',
      tags: ['preNeedleTag'],
    });
    await service.upsertArticle({
      ...common,
      id: 7,
      title: 'needle hidden',
      hidden: true,
    });
    await service.upsertArticle({
      ...common,
      id: 8,
      title: 'needle deleted',
      deleted: true,
    });

    const publicResults = await service.searchArticles('needle', false, 20);
    const adminResults = await service.searchArticles('needle', true, 20);
    const publicIds = publicResults.map((article: any) => article.id);
    const adminIds = adminResults.map((article: any) => article.id);

    expect([...publicIds].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(publicIds.indexOf(1)).toBeLessThan(publicIds.indexOf(2));
    expect([...adminIds].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(adminIds).not.toContain(8);
  }, 120000);

  it('avoids a full article-table scan for a rare term across 100k rows', async () => {
    await client.query(`
      INSERT INTO vanblog_articles (
        id, title, content, category, categories, categories_text, search_vector,
        top_value, hidden, private_flag, deleted, viewer, visited, author,
        created_at, updated_at
      )
      SELECT
        value,
        CASE WHEN value = 100000 THEN 'ultrarareterm' ELSE 'article-' || value END,
        'ordinary body ' || value,
        'General',
        ARRAY['General']::text[],
        'General',
        setweight(
          to_tsvector(
            'simple',
            CASE WHEN value = 100000 THEN 'ultrarareterm' ELSE 'article-' || value END
          ),
          'A'
        )
          || setweight(to_tsvector('simple', 'General'), 'B')
          || setweight(to_tsvector('simple', 'ordinary body ' || value), 'D'),
        0,
        FALSE,
        FALSE,
        FALSE,
        0,
        0,
        'Writer',
        NOW(),
        NOW()
      FROM generate_series(1, 100000) AS value
    `);
    await client.query('ANALYZE vanblog_articles');

    const results = await service.searchArticles('ultrarareterm', false, 20);
    expect(results.map((article: any) => article.id)).toEqual([100000]);
    expect(lastQuery).not.toBeNull();

    const explain = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${lastQuery.sql}`,
      lastQuery.params,
    );
    const plan = explain.rows[0]['QUERY PLAN'][0].Plan;
    const nodes: any[] = [];
    const visit = (node: any) => {
      nodes.push(node);
      for (const child of node.Plans || []) {
        visit(child);
      }
    };
    visit(plan);

    expect(
      nodes.some(
        (node) => node['Node Type'] === 'Seq Scan' && node['Relation Name'] === 'vanblog_articles',
      ),
    ).toBe(false);
    expect(
      nodes.some(
        (node) =>
          node['Node Type'] === 'Bitmap Index Scan' &&
          ['idx_vanblog_articles_search_vector', 'idx_vanblog_articles_title_trgm'].includes(
            node['Index Name'],
          ),
      ),
    ).toBe(true);
  }, 120000);

  it('does not rewrite already synchronized search columns on a second schema bootstrap', async () => {
    await service.upsertArticle({
      id: 1,
      title: 'Stable search row',
      content: 'stable body',
      category: 'General',
      categories: ['General'],
      author: 'Writer',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
    await client.query('SELECT pg_stat_force_next_flush()');

    const before = await client.query<{
      ctid: string;
      n_tup_upd: string;
    }>(
      `
        SELECT a.ctid::text, s.n_tup_upd::text
        FROM vanblog_articles a
        CROSS JOIN pg_stat_user_tables s
        WHERE a.id = 1
          AND s.schemaname = current_schema()
          AND s.relname = 'vanblog_articles'
      `,
    );
    await service.ensureSchema();
    await client.query('SELECT pg_stat_force_next_flush()');
    const after = await client.query<{
      ctid: string;
      n_tup_upd: string;
    }>(
      `
        SELECT a.ctid::text, s.n_tup_upd::text
        FROM vanblog_articles a
        CROSS JOIN pg_stat_user_tables s
        WHERE a.id = 1
          AND s.schemaname = current_schema()
          AND s.relname = 'vanblog_articles'
      `,
    );

    expect(after.rows[0]?.ctid).toBe(before.rows[0]?.ctid);
    expect(Number(after.rows[0]?.n_tup_upd)).toBe(Number(before.rows[0]?.n_tup_upd));
  }, 120000);
});
