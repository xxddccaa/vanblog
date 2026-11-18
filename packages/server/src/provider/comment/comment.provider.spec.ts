import { HttpException } from '@nestjs/common';
import { createStorageModel } from 'src/storage/collection-model';
import { COMMENT_LIMITS, CommentSetting, defaultCommentSetting } from 'src/types/comment.dto';
import { hashCommentActor } from 'src/utils/commentActor';
import { CommentRequestService } from './comment-request.service';
import { COMMENT_PAGE_TARGET_INFO, CommentProvider, CommentWriteContext } from './comment.provider';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const time = (value: any) => new Date(value).getTime();
const flush = () => new Promise((resolve) => setImmediate(resolve));
const IMAGE = `${'b'.repeat(64)}.webp`;
const ACTOR_A = 'A'.repeat(43);
const ACTOR_B = 'B'.repeat(43);

/** Minimal in-memory PostgresStoreService for the real record models. */
class MemoryRecordStore {
  collections = new Map<string, Map<string, any>>();

  private collection(name: string) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name)!;
  }

  all(name: string) {
    return [...this.collection(name).values()].map(clone);
  }

  async upsert(name: string, payload: any) {
    const normalized = clone(payload);
    this.collection(name).set(String(normalized._id), normalized);
    return clone(normalized);
  }

  async getAll(name: string) {
    return this.all(name);
  }

  async getRecords(name: string) {
    return [...this.collection(name).entries()].map(([recordId, payload]) => ({
      recordId,
      payload: clone(payload),
    }));
  }

  async countRecords(name: string) {
    return this.collection(name).size;
  }

  async mutateRecords(name: string, _plan: any, mutation: any) {
    const records = await this.getRecords(name);
    return await mutation(records, {
      upsert: (payload: any) => this.upsert(name, payload),
      deleteByIds: async (ids: string[]) => {
        let deleted = 0;
        for (const id of ids) if (this.collection(name).delete(id)) deleted += 1;
        return deleted;
      },
    });
  }
}

/** In-memory stand-in for the comment part of StructuredDataService (SQL is covered by the pg spec). */
class MemoryStructuredData {
  comments = new Map<number, any>();
  likes = new Map<string, { commentId: number; actorHash: string }>();
  articles: any[] = [];
  sequence = 0;

  async nextCommentId() {
    this.sequence += 1;
    return this.sequence;
  }

  async upsertComment(comment: any) {
    const row = clone(comment);
    row.id = Number(row.id);
    row.images = [...new Set(row.images || [])];
    this.sequence = Math.max(this.sequence, row.id);
    this.comments.set(row.id, row);
  }

  async deleteCommentsByIds(ids: number[]) {
    ids.forEach((id) => this.comments.delete(Number(id)));
  }

  async upsertCommentLike(like: any) {
    this.likes.set(`${like.commentId}:${like.actorHash}`, {
      commentId: Number(like.commentId),
      actorHash: like.actorHash,
    });
  }

  async deleteCommentLike(commentId: number, actorHash: string) {
    this.likes.delete(`${commentId}:${actorHash}`);
  }

  async deleteCommentLikesByCommentIds(ids: number[]) {
    for (const [key, like] of this.likes) if (ids.includes(like.commentId)) this.likes.delete(key);
  }

  async countCommentLikes(commentId: number) {
    return [...this.likes.values()].filter((like) => like.commentId === commentId).length;
  }

  async getLikedCommentIds(actorHash: string, ids: number[]) {
    return ids
      .filter((id) => this.likes.has(`${id}:${actorHash}`))
      .sort((left, right) => left - right);
  }

  async getCommentById(id: number) {
    return this.comments.has(Number(id)) ? clone(this.comments.get(Number(id))) : null;
  }

  async getCommentsByIds(ids: number[]) {
    return ids
      .map((id) => this.comments.get(Number(id)))
      .filter(Boolean)
      .map(clone);
  }

  private rows() {
    return [...this.comments.values()];
  }

  private rootVisible(root: any) {
    return (
      root.status === 'approved' ||
      (root.status === 'deleted' &&
        this.rows().some((reply) => reply.rootId === root.id && reply.status === 'approved'))
    );
  }

  private isCounted(comment: any) {
    if (comment.status !== 'approved') return false;
    if (comment.rootId === null) return true;
    const root = this.comments.get(comment.rootId);
    return Boolean(root) && ['approved', 'deleted'].includes(root.status);
  }

  async countPublicCommentThread(type: string, id: string) {
    const inTarget = this.rows().filter((row) => row.targetType === type && row.targetId === id);
    return {
      total: inTarget.filter((row) => row.rootId === null && this.rootVisible(row)).length,
      count: inTarget.filter((row) => this.isCounted(row)).length,
    };
  }

  async queryPublicComments(option: any) {
    const stats = await this.countPublicCommentThread(option.targetType, option.targetId);
    const key = (row: any) =>
      option.sort === 'hot'
        ? [row.status === 'approved' ? row.likes : 0, time(row.createdAt), row.id]
        : option.sort === 'oldest'
          ? [-time(row.createdAt), -row.id]
          : [time(row.createdAt), row.id];
    const roots = this.rows()
      .filter(
        (row) =>
          row.targetType === option.targetType &&
          row.targetId === option.targetId &&
          row.rootId === null &&
          this.rootVisible(row),
      )
      .sort((left, right) => {
        const pinned =
          Number(right.status === 'approved' && right.pinned) -
          Number(left.status === 'approved' && left.pinned);
        if (pinned) return pinned;
        const a = key(left);
        const b = key(right);
        for (let index = 0; index < a.length; index += 1) {
          if (a[index] !== b[index]) return b[index] - a[index];
        }
        return 0;
      })
      .slice((option.page - 1) * option.pageSize, option.page * option.pageSize);
    const rootIds = roots.map((root) => root.id);
    let replies = this.rows()
      .filter((row) => rootIds.includes(row.rootId) && row.status === 'approved')
      .sort((left, right) => time(left.createdAt) - time(right.createdAt) || left.id - right.id);
    const repliesTruncated = replies.length > option.maxReplies;
    replies = replies.slice(0, option.maxReplies);
    return { ...stats, roots: clone(roots), replies: clone(replies), repliesTruncated };
  }

  async countVisibleCommentsByTargets(targets: Array<{ type: string; id: string }>) {
    const result: Record<string, number> = {};
    for (const target of targets) {
      result[`${target.type}:${target.id}`] = (
        await this.countPublicCommentThread(target.type, target.id)
      ).count;
    }
    return result;
  }

  async queryAdminComments(option: any) {
    const search = String(option.search || '').toLowerCase();
    const matches = this.rows()
      .filter((row) => !option.status || row.status === option.status)
      .filter(
        (row) =>
          !option.targetType ||
          (row.targetType === option.targetType && row.targetId === option.targetId),
      )
      .filter(
        (row) =>
          !search ||
          [row.content, row.nick, row.mail, row.ip].some((value) =>
            String(value).toLowerCase().includes(search),
          ),
      )
      .sort((left, right) => time(right.createdAt) - time(left.createdAt) || right.id - left.id);
    return {
      total: matches.length,
      comments: matches
        .slice((option.page - 1) * option.pageSize, option.page * option.pageSize)
        .map((row) => ({
          ...clone(row),
          parentExcerpt: row.parentId ? this.comments.get(row.parentId)?.content : undefined,
        })),
    };
  }

  async getCommentStats(size: number) {
    const byStatus: Record<string, number> = {};
    for (const row of this.rows()) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    const recent = this.rows()
      .filter((row) => row.status !== 'deleted')
      .sort((left, right) => right.id - left.id)
      .slice(0, size);
    return { byStatus, recent: clone(recent) };
  }

  async countAllComments() {
    return this.comments.size;
  }

  async getCommentDescendantIds(id: number) {
    const result = new Set<number>();
    const visit = (parentId: number) => {
      for (const row of this.rows()) {
        if (row.parentId === parentId && !result.has(row.id)) {
          result.add(row.id);
          visit(row.id);
        }
      }
    };
    visit(id);
    this.rows()
      .filter((row) => row.rootId === id)
      .forEach((row) => result.add(row.id));
    return [...result].sort((left, right) => left - right);
  }

  async getCommentTargetArticles(ids: number[]) {
    return this.articles.filter((article) => ids.includes(article.id)).map(clone);
  }
}

const visitor = (overrides: Partial<CommentWriteContext> = {}): CommentWriteContext => ({
  admin: null,
  ip: '203.0.113.5',
  ua: 'Mozilla/5.0',
  visitorKey: '203.0.113.5',
  ...overrides,
});

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as any;
      return { status: error.getStatus(), code: body.code, body };
    }
    throw error;
  }
  return null;
};

const createHarness = (
  options: { setting?: Partial<CommentSetting>; siteInfo?: Record<string, any> } = {},
) => {
  const store = new MemoryRecordStore();
  const structured = new MemoryStructuredData();
  structured.articles = [
    {
      id: 1,
      title: 'Hello',
      pathname: 'hello',
      hidden: false,
      private: false,
      privateCategory: false,
      deleted: false,
    },
    {
      id: 2,
      title: 'No slug',
      pathname: '',
      hidden: false,
      private: false,
      privateCategory: false,
      deleted: false,
    },
    {
      id: 3,
      title: 'Locked',
      pathname: '',
      hidden: false,
      private: true,
      privateCategory: false,
      deleted: false,
    },
    {
      id: 4,
      title: 'Secret category',
      pathname: '',
      hidden: false,
      private: false,
      privateCategory: true,
      deleted: false,
    },
    {
      id: 5,
      title: 'Hidden',
      pathname: 'hidden',
      hidden: true,
      private: false,
      privateCategory: false,
      deleted: false,
    },
    {
      id: 6,
      title: 'Gone',
      pathname: '',
      hidden: false,
      private: false,
      privateCategory: false,
      deleted: true,
    },
  ];
  const siteInfo: Record<string, any> = { enableComment: 'true', ...options.siteInfo };
  const setting: CommentSetting = {
    ...clone(defaultCommentSetting),
    ...options.setting,
    notify: { ...clone(defaultCommentSetting.notify), ownerEmail: 'owner@example.com' },
  };
  const cache = new Map<string, any>();
  const cacheProvider = {
    setIfAbsent: jest.fn(async (key: string, value: any) => {
      if (cache.has(key)) return false;
      cache.set(key, value);
      return true;
    }),
    del: jest.fn(async (key: string) => {
      cache.delete(key);
    }),
    incrementWithTtl: jest.fn(async (key: string) => {
      const next = Number(cache.get(key) || 0) + 1;
      cache.set(key, next);
      return next;
    }),
  };
  const requestService = new CommentRequestService(
    cacheProvider as any,
    { extractToken: jest.fn() } as any,
    { checkSuperAdminSessionToken: jest.fn() } as any,
    { getUser: jest.fn() } as any,
  );
  const consume = jest.spyOn(requestService, 'consume');
  const hooks = { afterCreate: jest.fn(), afterApprove: jest.fn() };
  const clientInfo = {
    inspect: jest.fn(async () => ({ location: 'Zhejiang', browser: 'Chrome 131', os: 'macOS' })),
  };
  const cloudflare = { purgeByTags: jest.fn().mockResolvedValue(undefined) };
  const provider = new CommentProvider(
    createStorageModel('comments', store as any) as any,
    createStorageModel('comment_likes', store as any) as any,
    structured as any,
    { getSiteInfo: jest.fn(async () => siteInfo) } as any,
    { getCommentSetting: jest.fn(async () => clone(setting)) } as any,
    cacheProvider as any,
    requestService,
    hooks,
    clientInfo,
    cloudflare as any,
  );

  let seconds = 0;
  /** Writes a comment straight into both stores, bypassing create(). */
  const seed = async (overrides: Record<string, any> = {}) => {
    const id = overrides.id ?? (await structured.nextCommentId());
    seconds += 1;
    const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)).toISOString();
    const record = {
      _id: `record-${id}`,
      id,
      targetType: 'post',
      targetId: '1',
      parentId: null,
      rootId: null,
      replyToNick: null,
      nick: `nick${id}`,
      mail: `v${id}@example.com`,
      link: '',
      content: `content ${id}`,
      status: 'approved',
      isAdmin: false,
      pinned: false,
      likes: 0,
      ip: '198.51.100.1',
      ua: 'UA',
      location: 'Beijing',
      browser: 'Firefox 130',
      os: 'Linux',
      images: [],
      createdAt,
      updatedAt: createdAt,
      ...overrides,
    };
    await store.upsert('comments', record);
    await structured.upsertComment(record);
    return record;
  };

  return {
    provider,
    store,
    structured,
    siteInfo,
    setting,
    cache,
    cacheProvider,
    consume,
    hooks,
    clientInfo,
    cloudflare,
    seed,
  };
};

describe('CommentProvider', () => {
  beforeAll(() => {
    (global as any).jwtSecret = 'comment-provider-spec-secret';
  });

  afterAll(() => {
    delete (global as any).jwtSecret;
  });

  describe('targets', () => {
    it('resolves articles by canonical id with title and url', async () => {
      const { provider } = createHarness();
      await expect(provider.resolvePublicTarget('post:1')).resolves.toEqual({
        type: 'post',
        id: '1',
        key: 'post:1',
        articleId: 1,
        title: 'Hello',
        url: '/post/hello',
      });
      await expect(provider.resolvePublicTarget('post:2')).resolves.toEqual(
        expect.objectContaining({ url: '/post/2', title: 'No slug' }),
      );
    });

    it('resolves the link and about pages', async () => {
      const { provider } = createHarness();
      await expect(provider.resolvePublicTarget('page:link')).resolves.toEqual({
        type: 'page',
        id: 'link',
        key: 'page:link',
        title: COMMENT_PAGE_TARGET_INFO.link.title,
        url: '/link',
      });
      await expect(provider.resolvePublicTarget('page:about')).resolves.toEqual(
        expect.objectContaining({ title: COMMENT_PAGE_TARGET_INFO.about.title, url: '/about' }),
      );
      expect(COMMENT_PAGE_TARGET_INFO.link.title).toBeTruthy();
    });

    it('rejects id aliases, unknown, deleted, private and private-category articles', async () => {
      const { provider } = createHarness();
      for (const key of [
        'post:01',
        'post:1.0',
        'post:99',
        'post:3',
        'post:4',
        'post:6',
        'page:moment',
        'hello',
        1,
      ]) {
        expect(await codeOf(provider.resolvePublicTarget(key))).toEqual(
          expect.objectContaining({ status: 404, code: 'COMMENT_TARGET_UNAVAILABLE' }),
        );
      }
    });

    it('opens hidden articles only when the site allows opening them by URL', async () => {
      const closed = createHarness();
      expect((await codeOf(closed.provider.resolvePublicTarget('post:5')))?.status).toBe(404);
      const open = createHarness({ siteInfo: { allowOpenHiddenPostByUrl: 'true' } });
      await expect(open.provider.resolvePublicTarget('post:5')).resolves.toEqual(
        expect.objectContaining({ url: '/post/hidden' }),
      );
    });

    it('treats a never-saved comment switch as off', async () => {
      for (const enableComment of [undefined, '', 'yes']) {
        const { provider } = createHarness({ siteInfo: { enableComment } });
        expect(await codeOf(provider.listPublic({ target: 'page:link' }))).toEqual(
          expect.objectContaining({ status: 403, code: 'COMMENT_DISABLED' }),
        );
      }
    });

    it('answers 403 COMMENT_DISABLED on every public operation when comments are off', async () => {
      const { provider, seed } = createHarness({ siteInfo: { enableComment: 'false' } });
      await seed();
      const calls = [
        provider.resolvePublicTarget('post:1'),
        provider.listPublic({ target: 'post:1' }),
        provider.countPublic('post:1'),
        provider.create({ target: 'post:1', content: 'hi' }, visitor()),
        provider.toggleLike(1, { actorToken: ACTOR_A, visitorKey: 'v' }),
        provider.likedIds('1', ACTOR_A),
        provider.assertCommentsEnabled(),
      ];
      for (const call of calls) {
        expect(await codeOf(call)).toEqual(
          expect.objectContaining({ status: 403, code: 'COMMENT_DISABLED' }),
        );
      }
    });
  });

  describe('create', () => {
    it('stores an approved visitor comment in both stores and returns the public view', async () => {
      const { provider, store, structured, hooks, clientInfo, cacheProvider, cloudflare } =
        createHarness();
      const result = await provider.create(
        {
          target: 'post:1',
          nick: ' Alice ',
          mail: 'alice@example.com',
          link: 'https://alice.example',
          content: '  Great post  ',
          website: '',
        },
        visitor(),
      );
      expect(result.status).toBe('approved');
      expect(result.comment).toEqual({
        id: 1,
        target: 'post:1',
        parentId: null,
        rootId: null,
        replyToNick: null,
        nick: 'Alice',
        link: 'https://alice.example/',
        isAdmin: false,
        pinned: false,
        content: 'Great post',
        likes: 0,
        createdAt: expect.any(String),
        location: 'Zhejiang',
        browser: 'Chrome 131',
        os: 'macOS',
      });
      expect(JSON.stringify(result)).not.toMatch(/alice@example|203\.0\.113|Mozilla/u);
      const [record] = store.all('comments');
      expect(record).toEqual(
        expect.objectContaining({
          id: 1,
          targetType: 'post',
          targetId: '1',
          mail: 'alice@example.com',
          ip: '203.0.113.5',
          ua: 'Mozilla/5.0',
          status: 'approved',
          images: [],
        }),
      );
      expect(structured.comments.get(1)).toEqual(expect.objectContaining({ status: 'approved' }));
      expect(clientInfo.inspect).toHaveBeenCalledWith('203.0.113.5', 'Mozilla/5.0');
      await flush();
      expect(hooks.afterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, mail: 'alice@example.com' }),
        { target: expect.objectContaining({ key: 'post:1', title: 'Hello' }), parent: null },
      );
      expect(hooks.afterCreate.mock.calls[0][0]._id).toBeUndefined();
      expect(cacheProvider.del).toHaveBeenCalledWith('public:article:engagement:1');
      expect(cacheProvider.del).toHaveBeenCalledWith('public:article:engagement:hello');
      expect(cacheProvider.del).toHaveBeenCalledWith('public:article:fragments:hello:4');
      expect(cloudflare.purgeByTags).toHaveBeenCalledWith(
        expect.arrayContaining(['comment:post-1', 'post-comments:1', 'post-comments:hello']),
        expect.any(String),
      );
    });

    it('fakes success for honeypot hits without storing anything or using shared budgets', async () => {
      const { provider, store, structured, hooks, consume } = createHarness();
      const result = await provider.create(
        { target: 'post:1', nick: 'Bot', content: 'buy now', website: 'http://spam.example' },
        visitor(),
      );
      expect(result.status).toBe('pending');
      expect(result.comment).toEqual(
        expect.objectContaining({ id: expect.any(Number), content: 'buy now', nick: 'Bot' }),
      );
      expect(store.all('comments')).toEqual([]);
      expect(structured.comments.size).toBe(0);
      await flush();
      expect(hooks.afterCreate).not.toHaveBeenCalled();
      expect(consume.mock.calls.map((call) => call[0])).toEqual([
        'createPerVisitorShort',
        'createPerVisitorDay',
      ]);
    });

    it('validates every field', async () => {
      const { provider, setting } = createHarness({ setting: { maxLength: 100 } });
      const cases: Array<[Record<string, any>, string]> = [
        [{ target: 'post:1', content: '   ' }, 'COMMENT_INVALID_INPUT'],
        [{ target: 'post:1', content: 'x'.repeat(101) }, 'COMMENT_CONTENT_TOO_LONG'],
        [{ target: 'post:1', content: 'a\u0000b' }, 'COMMENT_INVALID_INPUT'],
        [{ target: 'post:1', content: 'ok', nick: 'n'.repeat(33) }, 'COMMENT_INVALID_INPUT'],
        [{ target: 'post:1', content: 'ok', nick: 'a\nb' }, 'COMMENT_INVALID_INPUT'],
        [{ target: 'post:1', content: 'ok', mail: 'bad' }, 'COMMENT_INVALID_INPUT'],
        [{ target: 'post:1', content: 'ok', link: 'javascript:alert(1)' }, 'COMMENT_INVALID_INPUT'],
        [
          { target: 'post:1', content: 'ok', link: 'https://u:p@x.example' },
          'COMMENT_INVALID_INPUT',
        ],
        [{ target: 'post:1', content: 'ok', parentId: 'x' }, 'COMMENT_INVALID_INPUT'],
        [{ target: 'post:01', content: 'ok' }, 'COMMENT_TARGET_UNAVAILABLE'],
      ];
      for (const [body, code] of cases) {
        expect((await codeOf(provider.create(body, visitor())))?.code).toBe(code);
      }
      expect((await codeOf(provider.create(null, visitor())))?.code).toBe('COMMENT_INVALID_INPUT');
      expect((await codeOf(provider.create([], visitor())))?.code).toBe('COMMENT_INVALID_INPUT');
      setting.requireMail = true;
      expect(
        (await codeOf(provider.create({ target: 'post:1', content: 'ok' }, visitor())))?.code,
      ).toBe('COMMENT_MAIL_REQUIRED');
    });

    it('threads replies under the root and records the replied nick', async () => {
      const { provider, seed } = createHarness();
      const root = await seed({ nick: 'Root' });
      const first = await provider.create(
        { target: 'post:1', content: 'reply', parentId: root.id },
        visitor(),
      );
      expect(first.comment).toEqual(
        expect.objectContaining({ parentId: root.id, rootId: root.id, replyToNick: 'Root' }),
      );
      const nested = await provider.create(
        { target: 'post:1', nick: 'Carol', content: 'nested', parentId: first.comment.id },
        visitor({ visitorKey: 'other' }),
      );
      expect(nested.comment).toEqual(
        expect.objectContaining({ parentId: first.comment.id, rootId: root.id, replyToNick: '' }),
      );
    });

    it('does not charge the shared budgets for invalid parents or duplicates', async () => {
      const { provider, consume } = createHarness();
      await codeOf(
        provider.create({ target: 'post:1', content: 'orphan', parentId: 999 }, visitor()),
      );
      await provider.create({ target: 'post:1', content: 'once' }, visitor());
      consume.mockClear();
      expect(
        await codeOf(provider.create({ target: 'post:1', content: 'once' }, visitor())),
      ).toEqual(expect.objectContaining({ status: 409 }));
      const shared = consume.mock.calls
        .map((call) => call[0])
        .filter((name) => name === 'createPerTargetHour' || name === 'createGlobalHour');
      expect(shared).toEqual([]);
    });

    it('rejects parents that are missing, unapproved or on another target', async () => {
      const { provider, seed } = createHarness();
      const pending = await seed({ status: 'pending' });
      const elsewhere = await seed({ targetId: '2' });
      const spamRoot = await seed({ status: 'spam' });
      const underSpam = await seed({ parentId: spamRoot.id, rootId: spamRoot.id });
      for (const parentId of [999, pending.id, elsewhere.id, underSpam.id]) {
        expect(
          await codeOf(
            provider.create({ target: 'post:1', content: `x${parentId}`, parentId }, visitor()),
          ),
        ).toEqual(expect.objectContaining({ status: 400, code: 'COMMENT_PARENT_UNAVAILABLE' }));
      }
      const placeholder = await seed({ status: 'deleted' });
      const visibleReply = await seed({ parentId: placeholder.id, rootId: placeholder.id });
      await expect(
        provider.create({ target: 'post:1', content: 'ok', parentId: visibleReply.id }, visitor()),
      ).resolves.toEqual(expect.objectContaining({ status: 'approved' }));
    });

    it('rejects duplicates within the window and frees the key when the write fails', async () => {
      const { provider, structured, seed } = createHarness();
      const root = await seed();
      const body = { target: 'post:1', nick: 'A', content: 'same' };
      await provider.create(body, visitor());
      expect(await codeOf(provider.create(body, visitor()))).toEqual(
        expect.objectContaining({ status: 409, code: 'COMMENT_DUPLICATE' }),
      );
      await expect(
        provider.create({ ...body, parentId: root.id }, visitor()),
      ).resolves.toBeTruthy();
      await expect(provider.create({ ...body, nick: 'B' }, visitor())).resolves.toBeTruthy();

      const upsert = jest
        .spyOn(structured, 'upsertComment')
        .mockRejectedValueOnce(new Error('db down'));
      await expect(
        provider.create({ ...body, content: 'retry me' }, visitor({ visitorKey: 'x' })),
      ).rejects.toThrow('db down');
      upsert.mockRestore();
      await expect(
        provider.create({ ...body, content: 'retry me' }, visitor({ visitorKey: 'x' })),
      ).resolves.toBeTruthy();
    });

    it('rate limits visitors per short window, per target and globally', async () => {
      const { provider, consume } = createHarness();
      for (let index = 0; index < 5; index += 1) {
        await provider.create({ target: 'post:1', content: `c${index}` }, visitor());
      }
      expect(await codeOf(provider.create({ target: 'post:1', content: 'c6' }, visitor()))).toEqual(
        expect.objectContaining({
          status: 429,
          code: 'COMMENT_RATE_LIMITED',
          body: expect.objectContaining({ retryAfterSeconds: 600 }),
        }),
      );
      expect(consume).toHaveBeenCalledWith('createPerTargetHour', 'post:1');
      expect(consume).toHaveBeenCalledWith('createGlobalHour', 'global');
      expect(consume).toHaveBeenCalledWith('createPerVisitorDay', '203.0.113.5');
    });

    it('applies the moderation modes and forbidden words', async () => {
      const all = createHarness({ setting: { moderation: 'all' } });
      expect(
        (await all.provider.create({ target: 'post:1', content: 'hello' }, visitor())).status,
      ).toBe('pending');
      const off = createHarness({ setting: { moderation: 'off' } });
      expect(
        (
          await off.provider.create(
            { target: 'post:1', content: 'https://a.b https://c.d https://e.f' },
            visitor(),
          )
        ).status,
      ).toBe('approved');

      const suspicious = createHarness();
      const linky = await suspicious.provider.create(
        { target: 'post:1', content: 'https://a.example https://b.example https://c.example' },
        visitor(),
      );
      expect(linky.status).toBe('pending');
      const shouting = await suspicious.provider.create(
        { target: 'post:1', content: `no${'!'.repeat(20)}` },
        visitor({ visitorKey: 'v2' }),
      );
      expect(shouting.status).toBe('pending');
      const image = await suspicious.provider.create(
        { target: 'post:1', content: `look ![x](/static/img/comment/${IMAGE})` },
        visitor({ visitorKey: 'v3' }),
      );
      expect(image.status).toBe('pending');
      expect(suspicious.structured.comments.get(image.comment.id).images).toEqual([IMAGE]);

      const words = createHarness({ setting: { moderation: 'off', forbiddenWords: ['Casino'] } });
      const spam = await words.provider.create(
        { target: 'post:1', content: 'best CASINO' },
        visitor(),
      );
      expect(spam.status).toBe('pending');
      expect(words.structured.comments.get(spam.comment.id).status).toBe('spam');
      await expect(words.provider.countPublic('post:1')).resolves.toEqual({ 'post:1': 0 });
    });

    it('posts as the site owner without limits, honeypot or moderation', async () => {
      const { provider, consume, structured } = createHarness({
        setting: { moderation: 'all', forbiddenWords: ['secret'] },
      });
      const admin = visitor({ admin: { nick: 'Owner' } });
      const result = await provider.create(
        {
          target: 'page:about',
          nick: 'Impostor',
          mail: 'x@example.com',
          link: 'https://x.example',
          content: `secret ${'y'.repeat(COMMENT_LIMITS.contentDefaultMaxLength)}`,
          website: 'filled',
        },
        admin,
      );
      expect(result.status).toBe('approved');
      expect(result.comment).toEqual(
        expect.objectContaining({ nick: 'Owner', link: '', isAdmin: true, target: 'page:about' }),
      );
      expect(structured.comments.get(result.comment.id)).toEqual(
        expect.objectContaining({ mail: 'owner@example.com', isAdmin: true, status: 'approved' }),
      );
      expect(consume).not.toHaveBeenCalled();
    });

    it('never lets a failing hook or client info lookup break the request', async () => {
      const { provider, hooks, clientInfo } = createHarness();
      hooks.afterCreate.mockImplementation(() => {
        throw new Error('smtp down');
      });
      clientInfo.inspect.mockRejectedValue(new Error('no database'));
      const result = await provider.create({ target: 'post:1', content: 'still works' }, visitor());
      expect(result.comment).toEqual(expect.not.objectContaining({ location: expect.anything() }));
      await flush();
      expect(hooks.afterCreate).toHaveBeenCalled();
    });
  });

  describe('public list', () => {
    it('shows placeholders, hides unapproved comments and counts visible ones', async () => {
      const { provider, seed } = createHarness();
      const approved = await seed({ nick: 'A', link: 'https://a.example/' });
      await seed({ parentId: approved.id, rootId: approved.id, nick: 'R1' });
      await seed({ parentId: approved.id, rootId: approved.id, status: 'pending' });
      const pendingRoot = await seed({ status: 'pending' });
      await seed({ parentId: pendingRoot.id, rootId: pendingRoot.id });
      const deletedWithReply = await seed({
        status: 'deleted',
        nick: 'Gone',
        content: 'secret',
        likes: 4,
      });
      await seed({ parentId: deletedWithReply.id, rootId: deletedWithReply.id, nick: 'R2' });
      await seed({ status: 'deleted' });
      await seed({ status: 'spam' });

      const page = await provider.listPublic({ target: 'post:1', sort: 'oldest' });
      expect(page.total).toBe(2);
      expect(page.count).toBe(3);
      expect(page.items.map((item) => item.id)).toEqual([approved.id, deletedWithReply.id]);
      expect(page.items[0].replies.map((reply) => reply.nick)).toEqual(['R1']);
      expect(page.items[1]).toEqual({
        id: deletedWithReply.id,
        target: 'post:1',
        parentId: null,
        rootId: null,
        replyToNick: null,
        nick: '',
        link: '',
        isAdmin: false,
        pinned: false,
        content: '',
        likes: 0,
        createdAt: expect.any(String),
        deleted: true,
        replies: [expect.objectContaining({ nick: 'R2' })],
      });
      expect(JSON.stringify(page)).not.toMatch(/@example\.com|198\.51\.100|"ua"|"mail"|"ip"/u);
      expect(page.config).toEqual({
        pageSize: 10,
        maxLength: 5000,
        allowVisitorImage: true,
        requireMail: false,
      });
    });

    it('puts pinned roots first and supports every sort', async () => {
      const { provider, seed } = createHarness();
      const old = await seed({ likes: 2 });
      const hot = await seed({ likes: 9 });
      const pinned = await seed({ pinned: true });
      const newest = await seed({ likes: 5 });
      const ids = async (sort: unknown) =>
        (await provider.listPublic({ target: 'post:1', sort })).items.map((item) => item.id);
      expect(await ids('latest')).toEqual([pinned.id, newest.id, hot.id, old.id]);
      expect(await ids('oldest')).toEqual([pinned.id, old.id, hot.id, newest.id]);
      expect(await ids('hot')).toEqual([pinned.id, hot.id, newest.id, old.id]);
      expect(await ids('bogus')).toEqual(await ids('latest'));
      expect((await provider.listPublic({ target: 'post:1' })).sort).toBe('latest');
      expect((await provider.listPublic({ target: 'post:1' })).items[0].pinned).toBe(true);
    });

    it('paginates with the configured page size and caps replies', async () => {
      const { provider, seed, setting } = createHarness();
      setting.pageSize = 5;
      for (let index = 0; index < 7; index += 1) await seed();
      const second = await provider.listPublic({ target: 'post:1', page: '2' });
      expect(second).toEqual(expect.objectContaining({ page: 2, pageSize: 5, total: 7 }));
      expect(second.items).toHaveLength(2);
      expect((await provider.listPublic({ target: 'post:1', page: '-1' })).page).toBe(1);

      const many = createHarness();
      const root = await many.seed();
      for (let index = 0; index < COMMENT_LIMITS.maxRepliesPerPage + 1; index += 1) {
        await many.seed({ parentId: root.id, rootId: root.id });
      }
      const result = await many.provider.listPublic({ target: 'post:1' });
      expect(result.items[0].replies).toHaveLength(COMMENT_LIMITS.maxRepliesPerPage);
      expect(result.repliesTruncated).toBe(true);
    });

    it('includes client info only when enabled in the setting', async () => {
      const { provider, seed, setting } = createHarness();
      await seed();
      setting.showLocation = false;
      setting.showOs = false;
      const [item] = (await provider.listPublic({ target: 'post:1' })).items;
      expect(item.browser).toBe('Firefox 130');
      expect(item).not.toHaveProperty('location');
      expect(item).not.toHaveProperty('os');
    });
  });

  describe('counts', () => {
    it('counts visible comments per target and zero for closed targets', async () => {
      const { provider, seed } = createHarness();
      await seed();
      await seed({ status: 'pending' });
      await seed({ targetType: 'page', targetId: 'link' });
      await seed({ targetId: '3' });
      await expect(
        provider.countPublic('post:1,page:link,post:3,post:99,page:about'),
      ).resolves.toEqual({
        'post:1': 1,
        'page:link': 1,
        'post:3': 0,
        'post:99': 0,
        'page:about': 0,
      });
      await expect(provider.countPublic(['post:1', 'post:1'])).resolves.toEqual({ 'post:1': 1 });
    });

    it('rejects malformed and oversized target lists', async () => {
      const { provider } = createHarness();
      expect((await codeOf(provider.countPublic('')))?.code).toBe('COMMENT_INVALID_INPUT');
      expect((await codeOf(provider.countPublic('post:01')))?.code).toBe('COMMENT_INVALID_INPUT');
      const tooMany = Array.from(
        { length: COMMENT_LIMITS.countMaxTargets + 1 },
        (_, index) => `post:${index + 1}`,
      );
      expect((await codeOf(provider.countPublic(tooMany.join(','))))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
    });

    it('counts article comments for the engagement endpoints without throwing', async () => {
      const { provider, seed, structured } = createHarness();
      await seed();
      await seed({ targetId: '3' });
      await expect(provider.countForArticle(1)).resolves.toBe(1);
      await expect(provider.countForArticle('3')).resolves.toBe(0);
      await expect(provider.countForArticle('abc')).resolves.toBe(0);
      jest.spyOn(structured, 'countVisibleCommentsByTargets').mockRejectedValueOnce(new Error('x'));
      await expect(provider.countForArticle(1)).resolves.toBe(0);
    });
  });

  describe('likes', () => {
    it('toggles one like per browser identity and recomputes the total', async () => {
      const { provider, seed, store, structured } = createHarness();
      const comment = await seed();
      const like = (actorToken: string) =>
        provider.toggleLike(String(comment.id), { actorToken, visitorKey: 'v' });

      await expect(like(ACTOR_A)).resolves.toEqual({ liked: true, likes: 1 });
      await expect(like(ACTOR_B)).resolves.toEqual({ liked: true, likes: 2 });
      await expect(like(ACTOR_A)).resolves.toEqual({ liked: false, likes: 1 });
      await expect(like(ACTOR_A)).resolves.toEqual({ liked: true, likes: 2 });

      const likeRecords = store.all('comment_likes');
      expect(likeRecords.map((record) => record._id).sort()).toEqual(
        [
          `${comment.id}:${hashCommentActor(ACTOR_A)}`,
          `${comment.id}:${hashCommentActor(ACTOR_B)}`,
        ].sort(),
      );
      expect(JSON.stringify(likeRecords)).not.toContain(ACTOR_A);
      expect(store.all('comments')[0].likes).toBe(2);
      expect(store.all('comments')[0].updatedAt).toBe(comment.updatedAt);
      expect(structured.comments.get(comment.id).likes).toBe(2);

      await expect(provider.likedIds(`${comment.id},999`, ACTOR_A)).resolves.toEqual({
        ids: [comment.id],
      });
      await expect(provider.likedIds(String(comment.id), '')).resolves.toEqual({ ids: [] });
      expect((await codeOf(provider.likedIds('x', ACTOR_A)))?.code).toBe('COMMENT_INVALID_INPUT');
    });

    it('only accepts likes on publicly visible comments', async () => {
      const { provider, seed } = createHarness();
      const pending = await seed({ status: 'pending' });
      const placeholder = await seed({ status: 'deleted' });
      const reply = await seed({ parentId: placeholder.id, rootId: placeholder.id });
      const closed = await seed({ targetId: '3' });
      for (const id of [pending.id, placeholder.id, closed.id, 999, 'abc']) {
        const result = await codeOf(
          provider.toggleLike(id, { actorToken: ACTOR_A, visitorKey: 'v' }),
        );
        expect(result?.status).toBe(404);
      }
      await expect(
        provider.toggleLike(reply.id, { actorToken: ACTOR_A, visitorKey: 'v' }),
      ).resolves.toEqual({ liked: true, likes: 1 });
    });

    it('rate limits likes per visitor', async () => {
      const { provider, seed } = createHarness();
      const comment = await seed();
      for (let index = 0; index < 60; index += 1) {
        await provider.toggleLike(comment.id, { actorToken: ACTOR_A, visitorKey: 'busy' });
      }
      expect(
        (await codeOf(provider.toggleLike(comment.id, { actorToken: ACTOR_A, visitorKey: 'busy' })))
          ?.code,
      ).toBe('COMMENT_RATE_LIMITED');
    });
  });

  describe('admin', () => {
    it('lists with filters, full fields and target metadata', async () => {
      const { provider, seed } = createHarness();
      const root = await seed({ content: 'root text' });
      await seed({
        parentId: root.id,
        rootId: root.id,
        status: 'pending',
        mail: 'find@me.example',
      });
      await seed({ targetId: '6' });
      const list = await provider.listAdmin({
        status: 'pending',
        search: 'FIND@',
        pageSize: '500',
      });
      expect(list.pageSize).toBe(COMMENT_LIMITS.adminPageSizeMax);
      expect(list.items).toEqual([
        expect.objectContaining({
          status: 'pending',
          mail: 'find@me.example',
          ip: '198.51.100.1',
          ua: 'UA',
          parentExcerpt: 'root text',
          targetTitle: 'Hello',
          targetUrl: '/post/hello',
          targetAvailable: true,
        }),
      ]);
      const gone = await provider.listAdmin({ target: 'post:6' });
      expect(gone.items[0]).toEqual(
        expect.objectContaining({ targetAvailable: false, targetUrl: '', targetTitle: 'Gone' }),
      );
      expect((await provider.listAdmin({ status: 'all' })).total).toBe(3);
      expect((await codeOf(provider.listAdmin({ status: 'weird' })))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
      expect((await codeOf(provider.listAdmin({ target: 'post:x' })))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
    });

    it('reports status counts and recent comments', async () => {
      const { provider, seed } = createHarness();
      await seed({ status: 'pending' });
      await seed({ status: 'spam' });
      await seed({ status: 'deleted' });
      await seed();
      const stats = await provider.getStats();
      expect(stats).toEqual(
        expect.objectContaining({ pending: 1, approved: 1, spam: 1, deleted: 1, total: 4 }),
      );
      expect(stats.recent.map((comment) => comment.status)).toEqual([
        'approved',
        'spam',
        'pending',
      ]);
    });

    it('approves pending comments, firing afterApprove with the parent', async () => {
      const { provider, seed, hooks, cacheProvider } = createHarness();
      const root = await seed();
      const reply = await seed({ parentId: root.id, rootId: root.id, status: 'pending' });
      const updated = await provider.updateAdmin(String(reply.id), { status: 'approved' });
      expect(updated.status).toBe('approved');
      await flush();
      expect(hooks.afterApprove).toHaveBeenCalledWith(
        expect.objectContaining({ id: reply.id, status: 'approved' }),
        {
          target: expect.objectContaining({ key: 'post:1' }),
          parent: expect.objectContaining({ id: root.id }),
        },
      );
      expect(cacheProvider.del).toHaveBeenCalledWith('public:article:engagement:1');

      hooks.afterApprove.mockClear();
      await provider.updateAdmin(reply.id, { status: 'approved' });
      await provider.updateAdmin(reply.id, { status: 'spam' });
      await provider.updateAdmin(reply.id, { status: 'approved' });
      await flush();
      expect(hooks.afterApprove).toHaveBeenCalledTimes(1);
    });

    it('requires the direct parent to be approved or deleted before approving a reply', async () => {
      const { provider, seed } = createHarness();
      const root = await seed({ status: 'pending' });
      const reply = await seed({ parentId: root.id, rootId: root.id, status: 'pending' });
      expect(await codeOf(provider.updateAdmin(reply.id, { status: 'approved' }))).toEqual(
        expect.objectContaining({ status: 400, code: 'COMMENT_PARENT_UNAVAILABLE' }),
      );
      await provider.softDelete(root.id);
      await expect(provider.updateAdmin(reply.id, { status: 'approved' })).resolves.toEqual(
        expect.objectContaining({ status: 'approved' }),
      );
    });

    it('cascades pending and spam to non-deleted descendants', async () => {
      const { provider, seed, structured, store } = createHarness();
      const root = await seed();
      const reply = await seed({ parentId: root.id, rootId: root.id });
      const nested = await seed({ parentId: reply.id, rootId: root.id });
      const deleted = await seed({ parentId: root.id, rootId: root.id, status: 'deleted' });
      const other = await seed();
      await provider.updateAdmin(root.id, { status: 'spam' });
      const statusOf = (id: number) => structured.comments.get(id).status;
      expect([root.id, reply.id, nested.id, deleted.id, other.id].map(statusOf)).toEqual([
        'spam',
        'spam',
        'spam',
        'deleted',
        'approved',
      ]);
      expect(store.all('comments').find((record) => record.id === nested.id).status).toBe('spam');
      await provider.updateAdmin(root.id, { status: 'approved' });
      await provider.updateAdmin(reply.id, { status: 'pending' });
      expect([root.id, reply.id, nested.id].map(statusOf)).toEqual([
        'approved',
        'pending',
        'pending',
      ]);
    });

    it('pins only root comments', async () => {
      const { provider, seed } = createHarness();
      const root = await seed();
      const reply = await seed({ parentId: root.id, rootId: root.id });
      await expect(provider.updateAdmin(root.id, { pinned: true })).resolves.toEqual(
        expect.objectContaining({ pinned: true }),
      );
      expect((await codeOf(provider.updateAdmin(reply.id, { pinned: true })))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
      expect((await codeOf(provider.updateAdmin(root.id, { pinned: 'yes' })))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
    });

    it('edits content, recomputing images and enforcing the hard limit', async () => {
      const { provider, seed, structured } = createHarness({ setting: { maxLength: 100 } });
      const comment = await seed({ images: ['old.webp'] });
      const edited = await provider.updateAdmin(comment.id, {
        content: `${'z'.repeat(500)} ![](/static/img/comment/${IMAGE})`,
      });
      expect(edited.content).toContain('zzz');
      expect(structured.comments.get(comment.id).images).toEqual([IMAGE]);
      expect(
        (
          await codeOf(
            provider.updateAdmin(comment.id, {
              content: 'x'.repeat(COMMENT_LIMITS.contentHardMaxLength + 1),
            }),
          )
        )?.code,
      ).toBe('COMMENT_CONTENT_TOO_LONG');
      expect((await codeOf(provider.updateAdmin(comment.id, {})))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
      expect((await codeOf(provider.updateAdmin(comment.id, { status: 'deleted' })))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
      expect((await codeOf(provider.updateAdmin(999, { pinned: false })))?.code).toBe(
        'COMMENT_NOT_FOUND',
      );
      expect((await codeOf(provider.updateAdmin('01', { pinned: false })))?.code).toBe(
        'COMMENT_NOT_FOUND',
      );
    });

    it('soft deletes and restores comments while keeping the data', async () => {
      const { provider, seed, store } = createHarness();
      const comment = await seed({ content: 'keep me' });
      const deleted = await provider.softDelete(comment.id);
      expect(deleted).toEqual(expect.objectContaining({ status: 'deleted', content: 'keep me' }));
      expect(store.all('comments')[0].content).toBe('keep me');
      expect((await provider.listAdmin({ status: 'deleted' })).items).toHaveLength(1);
      await expect(provider.updateAdmin(comment.id, { status: 'approved' })).resolves.toEqual(
        expect.objectContaining({ status: 'approved' }),
      );
    });

    it('purges a comment with all descendants and their likes', async () => {
      const { provider, seed, store, structured } = createHarness();
      const root = await seed();
      const reply = await seed({ parentId: root.id, rootId: root.id });
      await seed({ parentId: reply.id, rootId: root.id });
      const keep = await seed();
      await provider.toggleLike(reply.id, { actorToken: ACTOR_A, visitorKey: 'v' });
      await provider.toggleLike(keep.id, { actorToken: ACTOR_A, visitorKey: 'v' });
      await expect(provider.purge(root.id)).resolves.toEqual({ purged: 3 });
      expect(store.all('comments').map((record) => record.id)).toEqual([keep.id]);
      expect([...structured.comments.keys()]).toEqual([keep.id]);
      expect(store.all('comment_likes').map((record) => record.commentId)).toEqual([keep.id]);
      expect([...structured.likes.values()].map((like) => like.commentId)).toEqual([keep.id]);
      expect((await codeOf(provider.purge(root.id)))?.code).toBe('COMMENT_NOT_FOUND');
    });

    it('applies batch actions in id order and reports per-id failures', async () => {
      const { provider, seed, structured, hooks } = createHarness();
      const root = await seed({ status: 'pending' });
      const reply = await seed({ parentId: root.id, rootId: root.id, status: 'pending' });
      const orphan = await seed({ status: 'spam' });
      const orphanReply = await seed({ parentId: orphan.id, rootId: orphan.id, status: 'spam' });
      const result = await provider.batch({
        ids: [reply.id, root.id, orphanReply.id, 999],
        action: 'approve',
      });
      expect(result).toEqual({
        updated: 2,
        failed: [
          { id: orphanReply.id, reason: 'COMMENT_PARENT_UNAVAILABLE' },
          { id: 999, reason: 'COMMENT_NOT_FOUND' },
        ],
      });
      expect(structured.comments.get(reply.id).status).toBe('approved');
      await flush();
      expect(hooks.afterApprove).toHaveBeenCalledTimes(2);

      await expect(provider.batch({ ids: [root.id, reply.id], action: 'purge' })).resolves.toEqual({
        updated: 2,
        failed: [],
      });
      expect(structured.comments.has(reply.id)).toBe(false);
      await expect(provider.batch({ ids: [orphan.id], action: 'delete' })).resolves.toEqual({
        updated: 1,
        failed: [],
      });
      expect(structured.comments.get(orphan.id).status).toBe('deleted');
    });

    it('validates batch requests', async () => {
      const { provider } = createHarness();
      const tooMany = Array.from(
        { length: COMMENT_LIMITS.batchMaxIds + 1 },
        (_, index) => index + 1,
      );
      for (const body of [
        { ids: [1], action: 'explode' },
        { ids: [], action: 'approve' },
        { ids: 'nope', action: 'approve' },
        { ids: tooMany, action: 'approve' },
        { ids: [1, 'x'], action: 'approve' },
        null,
      ]) {
        expect((await codeOf(provider.batch(body)))?.code).toBe('COMMENT_INVALID_INPUT');
      }
    });

    it('replies as the owner, approving a pending parent first', async () => {
      const { provider, seed, structured, hooks } = createHarness();
      const parent = await seed({ status: 'pending', nick: 'Guest' });
      const reply = await provider.replyAsAdmin(
        parent.id,
        { content: 'Thanks!' },
        { nick: 'Owner', ip: '127.0.0.1', ua: 'Admin UA' },
      );
      expect(reply).toEqual(
        expect.objectContaining({
          parentId: parent.id,
          rootId: parent.id,
          replyToNick: 'Guest',
          nick: 'Owner',
          mail: 'owner@example.com',
          link: '',
          isAdmin: true,
          status: 'approved',
        }),
      );
      expect(structured.comments.get(parent.id).status).toBe('approved');
      await flush();
      expect(hooks.afterApprove).toHaveBeenCalledWith(
        expect.objectContaining({ id: parent.id }),
        expect.objectContaining({ target: expect.objectContaining({ key: 'post:1' }) }),
      );
      expect(hooks.afterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ id: reply.id, isAdmin: true }),
        expect.objectContaining({
          parent: expect.objectContaining({ id: parent.id, status: 'approved' }),
        }),
      );
    });

    it('refuses to reply to spam or deleted comments', async () => {
      const { provider, seed } = createHarness();
      const context = { nick: 'Owner', ip: '', ua: '' };
      for (const status of ['spam', 'deleted']) {
        const parent = await seed({ status });
        expect(
          (await codeOf(provider.replyAsAdmin(parent.id, { content: 'x' }, context)))?.code,
        ).toBe('COMMENT_PARENT_UNAVAILABLE');
      }
      expect((await codeOf(provider.replyAsAdmin(999, { content: 'x' }, context)))?.code).toBe(
        'COMMENT_NOT_FOUND',
      );
      const ok = await seed();
      expect((await codeOf(provider.replyAsAdmin(ok.id, { content: ' ' }, context)))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
    });
  });

  describe('backup import', () => {
    it('restores valid comment and like records and skips malformed ones', async () => {
      const { provider, store } = createHarness();
      const hash = 'c'.repeat(64);
      const result = await provider.importRecords(
        [
          {
            _id: 'r1',
            id: 1,
            targetType: 'post',
            targetId: '1',
            parentId: null,
            rootId: null,
            nick: 'A',
            content: `hi ![](/static/img/comment/${IMAGE})`,
            status: 'approved',
            pinned: true,
            likes: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 2,
            targetType: 'post',
            targetId: '1',
            parentId: 1,
            rootId: 1,
            content: 'r',
            status: 'pending',
            pinned: true,
          },
          { id: 1, targetType: 'post', targetId: '1', content: 'dup', status: 'approved' },
          { id: 3, targetType: 'post', targetId: '01', content: 'alias', status: 'approved' },
          { id: 4, targetType: 'post', targetId: '1', content: 'x', status: 'weird' },
          {
            id: 5,
            targetType: 'post',
            targetId: '1',
            parentId: 1,
            rootId: null,
            content: 'x',
            status: 'approved',
          },
          'garbage',
        ],
        [
          { commentId: 1, actorHash: hash },
          { commentId: 1, actorHash: hash },
          { commentId: 9, actorHash: hash },
          { commentId: 1, actorHash: 'short' },
        ],
      );
      expect(result).toEqual({ comments: 2, likes: 1, skipped: 7 });
      const records = store.all('comments').sort((left, right) => left.id - right.id);
      expect(records.map((record) => [record.id, record.pinned, record.images])).toEqual([
        [1, true, [IMAGE]],
        [2, false, []],
      ]);
      expect(records[0]._id).toBe('r1');
      expect(store.all('comment_likes')).toEqual([
        expect.objectContaining({ _id: `1:${hash}`, commentId: 1, actorHash: hash }),
      ]);
      await expect(provider.deleteAllRecords()).resolves.toBe(0);
      expect(store.all('comments')).toEqual([]);
      expect(store.all('comment_likes')).toEqual([]);
    });
  });
});
