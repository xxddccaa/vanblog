import { Client } from 'pg';
import { StructuredDataService } from './structured-data.service';

const describeIfDatabase = process.env.VANBLOG_TEST_DATABASE_URL ? describe : describe.skip;

describeIfDatabase('StructuredDataService PostgreSQL integration', () => {
  let client: Client;
  const schemaName = `vanblog_test_${process.pid}_${Date.now()}`;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.VANBLOG_TEST_DATABASE_URL });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}"`);
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await client.end();
  });

  beforeEach(async () => {
    await client.query(`
      CREATE TABLE vanblog_articles (
        id BIGINT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        category TEXT,
        categories TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
        top_value INTEGER NOT NULL DEFAULT 0,
        hidden BOOLEAN NOT NULL DEFAULT FALSE,
        private_flag BOOLEAN NOT NULL DEFAULT FALSE,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        viewer INTEGER NOT NULL DEFAULT 0,
        visited INTEGER NOT NULL DEFAULT 0,
        author TEXT,
        password TEXT,
        pathname TEXT,
        copyright TEXT,
        last_visited_time TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT
      )
    `);
    await client.query(`
      CREATE TABLE vanblog_article_tags (
        article_id BIGINT NOT NULL,
        tag_name TEXT NOT NULL,
        PRIMARY KEY (article_id, tag_name)
      )
    `);
    await client.query(`
      CREATE TABLE vanblog_categories (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        private_flag BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
  });

  afterEach(async () => {
    await client.query('DROP TABLE vanblog_article_tags');
    await client.query('DROP TABLE vanblog_categories');
    await client.query('DROP TABLE vanblog_articles');
  });

  it('updates a numeric article id without overflowing bigint conversion', async () => {
    await client.query(
      `INSERT INTO vanblog_articles (id, title, pathname, viewer, visited)
       VALUES (7, 'numeric', NULL, 2, 1), (8, 'large pathname', '9223372036854775808', 4, 2)`,
    );
    const service = new StructuredDataService({ query: client.query.bind(client) } as any);

    await expect(service.incrementArticleViewerByPathname('7', true)).resolves.toBe(true);
    await expect(
      service.incrementArticleViewerByPathname('9223372036854775808', false),
    ).resolves.toBe(true);

    const result = await client.query(
      'SELECT id, viewer, visited FROM vanblog_articles ORDER BY id',
    );
    expect(result.rows).toEqual([
      expect.objectContaining({ id: '7', viewer: 3, visited: 2 }),
      expect.objectContaining({ id: '8', viewer: 5, visited: 2 }),
    ]);
  });

  it('executes the related-article CTE with private flags and grouped tags', async () => {
    await client.query(`
      INSERT INTO vanblog_articles
        (id, title, category, categories, viewer, created_at, updated_at)
      VALUES
        (1, 'Current', 'Tech', ARRAY['Tech']::text[], 0, NOW(), NOW()),
        (2, 'Related', 'Tech', ARRAY['Tech']::text[], 10, NOW(), NOW()),
        (3, 'Unrelated', 'Other', ARRAY['Other']::text[], 0, NOW(), NOW())
    `);
    await client.query(`
      INSERT INTO vanblog_article_tags (article_id, tag_name)
      VALUES (1, 'typescript'), (2, 'typescript')
    `);
    const service = new StructuredDataService({ query: client.query.bind(client) } as any);

    await expect(service.getRelatedPublicArticles(1, 2)).resolves.toEqual([
      expect.objectContaining({ id: 2, title: 'Related' }),
      expect.objectContaining({ id: 3, title: 'Unrelated' }),
    ]);
  });
});
