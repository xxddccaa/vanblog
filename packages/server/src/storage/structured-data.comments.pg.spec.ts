import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { StructuredDataService } from './structured-data.service';

const databaseUrl = process.env.VANBLOG_TEST_DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres('StructuredDataService PostgreSQL comments', () => {
  let client: Client;
  let service: StructuredDataService;
  let schema: string;
  const records: Record<string, any[]> = {};
  let nextId = 1;

  const base = (overrides: Record<string, any> = {}) => {
    const id = overrides.id ?? nextId++;
    return {
      _id: randomUUID(),
      id,
      targetType: 'post',
      targetId: '1',
      parentId: null,
      rootId: null,
      replyToNick: null,
      nick: `nick-${id}`,
      mail: '',
      link: '',
      content: `content ${id}`,
      status: 'approved',
      isAdmin: false,
      pinned: false,
      likes: 0,
      ip: '',
      ua: '',
      location: '',
      browser: '',
      os: '',
      images: [],
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, id)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, id)).toISOString(),
      ...overrides,
    };
  };

  const insert = async (...comments: any[]) => {
    for (const comment of comments) {
      await service.upsertComment(comment);
    }
    return comments;
  };

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    schema = `vanblog_comments_${randomUUID().replace(/-/g, '')}`;
    // The extension is database-wide; keep it out of the throwaway schema.
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    const store = {
      query: async (sql: string, params: any[] = []) => await client.query(sql, params),
      getAll: async (name: string) => records[name] || [],
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
    nextId = 1;
    await client.query('TRUNCATE TABLE vanblog_comments, vanblog_comment_likes');
    await client.query('TRUNCATE TABLE vanblog_articles, vanblog_categories CASCADE');
  });

  it('creates the comment indexes', async () => {
    const result = await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = 'vanblog_comments'`,
      [schema],
    );
    expect(result.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'idx_vanblog_comments_thread',
        'idx_vanblog_comments_status_created',
        'idx_vanblog_comments_root',
        'idx_vanblog_comments_content_trgm',
        'idx_vanblog_comments_nick_trgm',
      ]),
    );
    const likes = await client.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = 'vanblog_comment_likes'`,
      [schema],
    );
    expect(likes.rows.map((row) => row.indexdef).join('\n')).toContain('(comment_id, actor_hash)');
  });

  it('round-trips every stored field', async () => {
    const [stored] = await insert(
      base({
        id: 7,
        targetType: 'page',
        targetId: 'about',
        parentId: 3,
        rootId: 2,
        replyToNick: 'Bob',
        nick: 'Alice',
        mail: 'a@example.com',
        link: 'https://example.com/',
        content: 'hi\nthere',
        status: 'pending',
        isAdmin: true,
        pinned: true,
        likes: 4,
        ip: '203.0.113.1',
        ua: 'UA',
        location: 'Shanghai',
        browser: 'Chrome 131',
        os: 'macOS',
        images: ['a.webp', 'a.webp', 'b.webp'],
      }),
    );
    const loaded = await service.getCommentById(7);
    expect(loaded).toEqual(
      expect.objectContaining({
        _id: stored._id,
        id: 7,
        targetType: 'page',
        targetId: 'about',
        parentId: 3,
        rootId: 2,
        replyToNick: 'Bob',
        nick: 'Alice',
        mail: 'a@example.com',
        link: 'https://example.com/',
        content: 'hi\nthere',
        status: 'pending',
        isAdmin: true,
        pinned: true,
        likes: 4,
        ip: '203.0.113.1',
        ua: 'UA',
        location: 'Shanghai',
        browser: 'Chrome 131',
        os: 'macOS',
        images: ['a.webp', 'b.webp'],
      }),
    );
    expect(new Date(loaded.createdAt).toISOString()).toBe(stored.createdAt);

    await service.upsertComment({ ...stored, status: 'approved', likes: 5 });
    expect(await service.getCommentById(7)).toEqual(
      expect.objectContaining({ status: 'approved', likes: 5 }),
    );
    await service.deleteCommentsByIds([7]);
    expect(await service.getCommentById(7)).toBeNull();
  });

  it('applies the public visibility rules to counts and threads', async () => {
    const approvedRoot = base();
    const pendingRoot = base({ status: 'pending' });
    const spamRoot = base({ status: 'spam' });
    const deletedRootWithReply = base({ status: 'deleted', content: 'gone', nick: 'Gone' });
    const deletedRootAlone = base({ status: 'deleted' });
    const deletedRootPendingReply = base({ status: 'deleted' });
    await insert(approvedRoot, pendingRoot, spamRoot, deletedRootWithReply, deletedRootAlone);
    await insert(deletedRootPendingReply);
    await insert(
      base({ parentId: approvedRoot.id, rootId: approvedRoot.id }),
      base({ parentId: approvedRoot.id, rootId: approvedRoot.id, status: 'pending' }),
      base({ parentId: pendingRoot.id, rootId: pendingRoot.id }),
      base({ parentId: spamRoot.id, rootId: spamRoot.id }),
      base({ parentId: deletedRootWithReply.id, rootId: deletedRootWithReply.id }),
      base({
        parentId: deletedRootPendingReply.id,
        rootId: deletedRootPendingReply.id,
        status: 'pending',
      }),
      base({ targetId: '2' }),
    );

    expect(await service.countPublicCommentThread('post', '1')).toEqual({ total: 2, count: 3 });
    const page = await service.queryPublicComments({
      targetType: 'post',
      targetId: '1',
      sort: 'oldest',
      page: 1,
      pageSize: 10,
      maxReplies: 500,
    });
    expect(page.total).toBe(2);
    expect(page.count).toBe(3);
    expect(page.roots.map((root) => [root.id, root.status])).toEqual([
      [approvedRoot.id, 'approved'],
      [deletedRootWithReply.id, 'deleted'],
    ]);
    expect(page.replies.map((reply) => reply.rootId)).toEqual([
      approvedRoot.id,
      deletedRootWithReply.id,
    ]);
    expect(page.repliesTruncated).toBe(false);

    expect(
      await service.countVisibleCommentsByTargets([
        { type: 'post', id: '1' },
        { type: 'post', id: '2' },
        { type: 'post', id: '3' },
        { type: 'page', id: 'link' },
      ]),
    ).toEqual({ 'post:1': 3, 'post:2': 1, 'post:3': 0, 'page:link': 0 });
  });

  it('orders pinned roots first in every sort and paginates', async () => {
    const old = base({ likes: 1 });
    const hot = base({ likes: 9 });
    const pinned = base({ pinned: true, likes: 0 });
    const newest = base({ likes: 3 });
    const deletedPinned = base({ status: 'deleted', pinned: true, likes: 50 });
    await insert(old, hot, pinned, newest, deletedPinned);
    await insert(base({ parentId: deletedPinned.id, rootId: deletedPinned.id }));
    const query = (sort: 'latest' | 'oldest' | 'hot', page = 1, pageSize = 10) =>
      service
        .queryPublicComments({
          targetType: 'post',
          targetId: '1',
          sort,
          page,
          pageSize,
          maxReplies: 500,
        })
        .then((result) => result.roots.map((root) => root.id));

    expect(await query('latest')).toEqual([pinned.id, deletedPinned.id, newest.id, hot.id, old.id]);
    expect(await query('oldest')).toEqual([pinned.id, old.id, hot.id, newest.id, deletedPinned.id]);
    expect(await query('hot')).toEqual([pinned.id, hot.id, newest.id, old.id, deletedPinned.id]);
    expect(await query('latest', 2, 2)).toEqual([newest.id, hot.id]);
    expect(await query('latest', 9, 2)).toEqual([]);
  });

  it('returns replies chronologically and flags truncation', async () => {
    const first = base();
    const second = base();
    await insert(first, second);
    const replies = [
      base({ parentId: second.id, rootId: second.id }),
      base({ parentId: first.id, rootId: first.id }),
      base({ parentId: first.id, rootId: first.id }),
    ];
    await insert(...replies);
    const result = await service.queryPublicComments({
      targetType: 'post',
      targetId: '1',
      sort: 'latest',
      page: 1,
      pageSize: 10,
      maxReplies: 2,
    });
    expect(result.replies.map((reply) => reply.id)).toEqual([replies[0].id, replies[1].id]);
    expect(result.repliesTruncated).toBe(true);
  });

  it('keeps likes idempotent per actor and counts them', async () => {
    await insert(base({ id: 1 }), base({ id: 2 }));
    await service.upsertCommentLike({ _id: '1:a', commentId: 1, actorHash: 'a' });
    await service.upsertCommentLike({ _id: '1:a', commentId: 1, actorHash: 'a' });
    await service.upsertCommentLike({ _id: '1:b', commentId: 1, actorHash: 'b' });
    await service.upsertCommentLike({ _id: '2:a', commentId: 2, actorHash: 'a' });
    expect(await service.countCommentLikes(1)).toBe(2);
    expect(await service.getLikedCommentIds('a', [1, 2, 3])).toEqual([1, 2]);
    expect(await service.getLikedCommentIds('b', [2])).toEqual([]);
    await service.deleteCommentLike(1, 'a');
    expect(await service.countCommentLikes(1)).toBe(1);
    await service.deleteCommentLikesByCommentIds([1, 2]);
    expect(await service.getLikedCommentIds('a', [1, 2])).toEqual([]);
  });

  it('filters and searches the admin list literally', async () => {
    const root = base({ content: 'parent body for excerpt', nick: 'Root' });
    await insert(
      root,
      base({ content: '100% off', status: 'spam' }),
      base({ content: '100 percent', status: 'pending' }),
      base({ nick: 'under_score' }),
      base({ nick: 'underXscore' }),
      base({ mail: 'Mail@Example.com' }),
      base({ ip: '198.51.100.7', targetType: 'page', targetId: 'link' }),
      base({ parentId: root.id, rootId: root.id, content: 'child' }),
    );
    const search = async (option: Record<string, any>) =>
      (await service.queryAdminComments({ page: 1, pageSize: 50, ...option })).comments.map(
        (comment) => comment.id,
      );

    expect(await search({ search: '100%' })).toEqual([2]);
    expect(await search({ search: 'under_' })).toEqual([4]);
    expect(await search({ search: 'mail@example' })).toEqual([6]);
    expect(await search({ search: '198.51' })).toEqual([7]);
    expect(await search({ status: 'pending' })).toEqual([3]);
    expect(await search({ targetType: 'page', targetId: 'link' })).toEqual([7]);

    const pageTwo = await service.queryAdminComments({ page: 2, pageSize: 3 });
    expect(pageTwo.total).toBe(8);
    expect(pageTwo.comments.map((comment) => comment.id)).toEqual([5, 4, 3]);

    const [child] = (await service.queryAdminComments({ search: 'child', page: 1, pageSize: 5 }))
      .comments;
    expect(child.parentExcerpt).toBe('parent body for excerpt');
  });

  it('summarizes statuses and lists recent non-deleted comments', async () => {
    await insert(
      base({ status: 'approved' }),
      base({ status: 'pending' }),
      base({ status: 'pending' }),
      base({ status: 'spam' }),
      base({ status: 'deleted' }),
    );
    const stats = await service.getCommentStats(3);
    expect(stats.byStatus).toEqual({ approved: 1, pending: 2, spam: 1, deleted: 1 });
    expect(stats.recent.map((comment) => comment.id)).toEqual([4, 3, 2]);
    expect(await service.countAllComments()).toBe(5);
  });

  it('collects nested descendants', async () => {
    const root = base();
    const reply = base({ parentId: root.id, rootId: root.id });
    const nested = base({ parentId: reply.id, rootId: root.id });
    const deeper = base({ parentId: nested.id, rootId: root.id });
    const sibling = base({ parentId: root.id, rootId: root.id });
    const other = base();
    await insert(root, reply, nested, deeper, sibling, other);
    expect(await service.getCommentDescendantIds(root.id)).toEqual([
      reply.id,
      nested.id,
      deeper.id,
      sibling.id,
    ]);
    expect(await service.getCommentDescendantIds(reply.id)).toEqual([nested.id, deeper.id]);
    expect(await service.getCommentDescendantIds(other.id)).toEqual([]);
  });

  it('reports article availability facts including private categories', async () => {
    await client.query(`
      INSERT INTO vanblog_categories (id, name, private_flag) VALUES (1, 'Secret', TRUE), (2, 'Open', FALSE)
    `);
    await client.query(`
      INSERT INTO vanblog_articles (id, title, pathname, category, categories, hidden, private_flag, deleted)
      VALUES
        (1, 'Open', 'open-post', 'Open', ARRAY['Open']::text[], FALSE, FALSE, FALSE),
        (2, 'Locked', NULL, 'Open', ARRAY['Open']::text[], FALSE, TRUE, FALSE),
        (3, 'In secret', NULL, 'Secret', ARRAY[]::text[], FALSE, FALSE, FALSE),
        (4, 'Hidden', NULL, NULL, ARRAY['Open', 'Secret']::text[], TRUE, FALSE, TRUE)
    `);
    const articles = await service.getCommentTargetArticles([1, 2, 3, 4, 5]);
    expect(articles.sort((left, right) => left.id - right.id)).toEqual([
      {
        id: 1,
        title: 'Open',
        pathname: 'open-post',
        hidden: false,
        private: false,
        privateCategory: false,
        deleted: false,
      },
      expect.objectContaining({ id: 2, private: true, privateCategory: false }),
      expect.objectContaining({ id: 3, privateCategory: true }),
      expect.objectContaining({ id: 4, hidden: true, deleted: true, privateCategory: true }),
    ]);
  });

  it('rebuilds both tables from the record store and moves the id sequence past them', async () => {
    records.comments = [
      base({ id: 41 }),
      base({ id: 42, parentId: 41, rootId: 41 }),
      base({ id: 0 }),
      { id: 43 },
    ];
    records.comment_likes = [
      { _id: '41:x', commentId: 41, actorHash: 'x' },
      { _id: '41:x', commentId: 41, actorHash: 'x' },
      { _id: 'bad', commentId: 'nope', actorHash: 'x' },
    ];
    try {
      await service.refreshCollectionsFromRecordStore(['comments', 'commentLikes'], 'test');
      const rows = await client.query('SELECT id FROM vanblog_comments ORDER BY id');
      expect(rows.rows.map((row) => Number(row.id))).toEqual([41, 42]);
      expect(await service.countCommentLikes(41)).toBe(1);
      expect(await service.nextCommentId()).toBe(43);
    } finally {
      delete records.comments;
      delete records.comment_likes;
    }
  });

  it('reports which uploaded images are still referenced', async () => {
    await insert(
      base({ images: ['a.webp', 'b.webp'] }),
      base({ images: ['c.webp'], status: 'deleted' }),
    );
    expect(await service.getReferencedCommentImages(['a.webp', 'c.webp', 'z.webp'])).toEqual([
      'a.webp',
      'c.webp',
    ]);
    expect(await service.getReferencedCommentImages([])).toEqual([]);
  });

  it('truncates the comment tables when the site is restored', async () => {
    await insert(base());
    await service.upsertCommentLike({ commentId: 1, actorHash: 'a' });
    await service.clearStructuredDataForRestore([0]);
    expect(await service.countAllComments()).toBe(0);
    expect(await service.countCommentLikes(1)).toBe(0);
  });
});
