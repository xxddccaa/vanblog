import { HttpException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { CacheProvider } from 'src/provider/cache/cache.provider';
import { CloudflareCacheProvider } from 'src/provider/cloudflare-cache/cloudflare-cache.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { CommentDocument } from 'src/scheme/comment.schema';
import { CommentLikeDocument, commentLikeRecordId } from 'src/scheme/commentLike.schema';
import { InjectModel, Model } from 'src/storage/mongoose-compat';
import { StructuredDataService } from 'src/storage/structured-data.service';
import {
  AdminComment,
  AdminCommentList,
  AdminCommentStats,
  BatchCommentResult,
  COMMENT_BATCH_ACTIONS,
  COMMENT_CLIENT_INFO,
  COMMENT_LIFECYCLE_HOOKS,
  COMMENT_LIMITS,
  COMMENT_SORTS,
  COMMENT_STATUSES,
  CommentBatchAction,
  CommentClientInfo,
  CommentClientInfoResolver,
  CommentHookContext,
  CommentLifecycleHooks,
  CommentLikeResult,
  CommentRecord,
  CommentSetting,
  CommentSort,
  CommentStatus,
  CommentTarget,
  CommentTargetKey,
  CommentTargetResolver,
  CreateCommentResult,
  ModerationStatus,
  PublicComment,
  PublicCommentCounts,
  PublicCommentLiked,
  PublicCommentPage,
  ResolvedCommentTarget,
} from 'src/types/comment.dto';
import { toCacheTag } from 'src/utils/cacheTag';
import {
  decideCommentStatus,
  extractCommentImages,
  formatCommentTargetKey,
  invalidCommentInput,
  normalizeCommentContent,
  normalizeCommentLink,
  normalizeCommentMail,
  normalizeCommentNick,
  normalizeCommentParentId,
  parseCommentIdList,
  parseCommentTargetKey,
  parsePositiveInteger,
  splitCommentListParam,
} from 'src/utils/commentInput';
import { hashCommentActor } from 'src/utils/commentActor';
import { NoopCommentLifecycleHooks } from './comment-hooks';
import { CommentRequestService, commentError } from './comment-request.service';

/** Who is writing, as established by the controller. */
export interface CommentWriteContext {
  /** Set when the request carries a valid super admin session. */
  admin: { nick: string } | null;
  ip: string;
  ua: string;
  /** Rate limit identity, see CommentRequestService.visitorKey. */
  visitorKey: string;
}

type StoredComment = CommentRecord & { _id?: string; parentExcerpt?: string };

interface StatusChange {
  before: StoredComment;
  after: StoredComment;
  /** Direct parent, loaded when the change approved a reply. */
  parent: StoredComment | null;
  /** The public view of the thread may have changed. */
  affectsPublic: boolean;
}

type CommentTargetArticle = Awaited<
  ReturnType<StructuredDataService['getCommentTargetArticles']>
>[number];

interface TargetInfo {
  target: ResolvedCommentTarget;
  /** The article exists (or the target is a page). */
  exists: boolean;
  /** Open for public comments, ignoring the site-wide switch. */
  available: boolean;
  pathname?: string;
}

/** Titles are user-facing copy (notifications, admin list). */
export const COMMENT_PAGE_TARGET_INFO: Record<string, { title: string; url: string }> = {
  link: { title: '友情链接', url: '/link' },
  about: { title: '关于', url: '/about' },
};

const MAX_PUBLIC_PAGE = 10_000;
/** Sizes accepted by /api/public/article/:id/fragments, which caches one key per size. */
const FRAGMENT_CACHE_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];
const MODERATION_STATUSES: ModerationStatus[] = ['approved', 'pending', 'spam'];

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toIso = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const toDate = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

/**
 * Core of the native comment system: target resolution, posting, threads,
 * moderation, likes and counts. Writes go to the `comments` / `comment_likes`
 * record collections and are mirrored into the structured tables, which serve
 * every read.
 */
@Injectable()
export class CommentProvider implements CommentTargetResolver {
  private readonly logger = new Logger(CommentProvider.name);
  private readonly hooks: CommentLifecycleHooks;
  private readonly clientInfo: CommentClientInfoResolver | null;
  /**
   * Comment writes run one at a time in this process so that the record write
   * and its structured mirror are applied in the same order.
   */
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    @InjectModel('Comment')
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel('CommentLike')
    private readonly commentLikeModel: Model<CommentLikeDocument>,
    private readonly structuredDataService: StructuredDataService,
    private readonly metaProvider: MetaProvider,
    private readonly settingProvider: SettingProvider,
    private readonly cacheProvider: CacheProvider,
    private readonly requestService: CommentRequestService,
    @Optional() @Inject(COMMENT_LIFECYCLE_HOOKS) hooks?: CommentLifecycleHooks,
    @Optional() @Inject(COMMENT_CLIENT_INFO) clientInfo?: CommentClientInfoResolver,
    @Optional() private readonly cloudflareCacheProvider?: CloudflareCacheProvider,
  ) {
    this.hooks = hooks || new NoopCommentLifecycleHooks();
    this.clientInfo = clientInfo || null;
  }

  // ---------------------------------------------------------------------------
  // Targets
  // ---------------------------------------------------------------------------

  private async getSiteInfo(): Promise<Record<string, any>> {
    return ((await this.metaProvider.getSiteInfo()) as any) || {};
  }

  private assertEnabled(siteInfo: Record<string, any>) {
    // Off unless explicitly enabled, matching the website and the admin form,
    // which both treat a never-saved switch as off.
    if (String(siteInfo?.enableComment) !== 'true') {
      throw commentError(403, 'COMMENT_DISABLED', 'Comments are disabled on this site');
    }
  }

  /** Throws 403 COMMENT_DISABLED when the site-wide comment switch is off. */
  async assertCommentsEnabled() {
    this.assertEnabled(await this.getSiteInfo());
  }

  private unavailableTarget() {
    return commentError(404, 'COMMENT_TARGET_UNAVAILABLE', 'This page does not accept comments');
  }

  /** Title, URL and availability of each target, whether or not it is open. */
  private async describeTargets(
    targets: CommentTarget[],
    siteInfo?: Record<string, any>,
  ): Promise<Map<string, TargetInfo>> {
    const result = new Map<string, TargetInfo>();
    const articleIds = [
      ...new Set(
        targets
          .filter((target) => target.type === 'post')
          .map((target) => parsePositiveInteger(target.id))
          .filter((id): id is number => id !== null),
      ),
    ];
    const articles = articleIds.length
      ? await this.structuredDataService.getCommentTargetArticles(articleIds)
      : [];
    const articleById = new Map<number, CommentTargetArticle>(
      articles.map((article) => [article.id, article]),
    );
    const allowHidden =
      articleIds.length > 0 &&
      String((siteInfo || (await this.getSiteInfo()))?.allowOpenHiddenPostByUrl) === 'true';

    for (const target of targets) {
      const key = formatCommentTargetKey(target.type, target.id);
      if (result.has(key)) continue;
      if (target.type === 'page') {
        const page = COMMENT_PAGE_TARGET_INFO[target.id];
        result.set(key, {
          target: {
            type: 'page',
            id: target.id,
            key,
            title: page?.title || target.id,
            url: page?.url || '',
          },
          exists: Boolean(page),
          available: Boolean(page),
        });
        continue;
      }
      const articleId = Number(target.id);
      const article = articleById.get(articleId);
      const exists = Boolean(article) && !article.deleted;
      result.set(key, {
        target: {
          type: 'post',
          id: target.id,
          key,
          articleId,
          title: article?.title || '',
          url: exists ? `/post/${article.pathname || article.id}` : '',
        },
        exists,
        available:
          exists &&
          !article.private &&
          !article.privateCategory &&
          (!article.hidden || allowHidden),
        pathname: article?.pathname || undefined,
      });
    }
    return result;
  }

  async resolvePublicTarget(
    targetKey: unknown,
    siteInfo?: Record<string, any>,
  ): Promise<ResolvedCommentTarget> {
    const site = siteInfo || (await this.getSiteInfo());
    this.assertEnabled(site);
    const parsed = parseCommentTargetKey(targetKey);
    if (!parsed) throw this.unavailableTarget();
    const info = (await this.describeTargets([parsed], site)).get(parsed.key);
    if (!info?.available) throw this.unavailableTarget();
    return info.target;
  }

  private targetOf(comment: Pick<CommentRecord, 'targetType' | 'targetId'>): CommentTarget {
    return { type: comment.targetType, id: String(comment.targetId) };
  }

  // ---------------------------------------------------------------------------
  // Public reads
  // ---------------------------------------------------------------------------

  private publicConfig(setting: CommentSetting) {
    return {
      pageSize: setting.pageSize,
      maxLength: setting.maxLength,
      allowVisitorImage: setting.allowVisitorImage,
      requireMail: setting.requireMail,
    };
  }

  /** Whitelisted public view; mail, IP and user agent never leave through here. */
  private toPublicComment(comment: StoredComment, setting: CommentSetting): PublicComment {
    const base = {
      id: Number(comment.id),
      target: formatCommentTargetKey(comment.targetType, comment.targetId),
      parentId: comment.parentId ?? null,
      rootId: comment.rootId ?? null,
      createdAt: toIso(comment.createdAt),
    };
    if (comment.status === 'deleted') {
      return {
        ...base,
        replyToNick: null,
        nick: '',
        link: '',
        isAdmin: false,
        pinned: false,
        content: '',
        likes: 0,
        deleted: true,
      };
    }
    const result: PublicComment = {
      ...base,
      replyToNick: comment.replyToNick ?? null,
      nick: comment.nick || '',
      link: comment.link || '',
      isAdmin: Boolean(comment.isAdmin),
      pinned:
        comment.rootId === null || comment.rootId === undefined ? Boolean(comment.pinned) : false,
      content: comment.content || '',
      likes: Number(comment.likes || 0),
    };
    if (setting.showLocation && comment.location) result.location = comment.location;
    if (setting.showBrowser && comment.browser) result.browser = comment.browser;
    if (setting.showOs && comment.os) result.os = comment.os;
    return result;
  }

  async listPublic(query: {
    target?: unknown;
    page?: unknown;
    sort?: unknown;
  }): Promise<PublicCommentPage> {
    const target = await this.resolvePublicTarget(query.target);
    const setting = await this.settingProvider.getCommentSetting();
    const page = Math.min(parsePositiveInteger(query.page) ?? 1, MAX_PUBLIC_PAGE);
    const sort: CommentSort = (COMMENT_SORTS as readonly unknown[]).includes(query.sort)
      ? (query.sort as CommentSort)
      : 'latest';
    const result = await this.structuredDataService.queryPublicComments({
      targetType: target.type,
      targetId: target.id,
      sort,
      page,
      pageSize: setting.pageSize,
      maxReplies: COMMENT_LIMITS.maxRepliesPerPage,
    });
    const repliesByRoot = new Map<number, PublicComment[]>();
    for (const reply of result.replies as StoredComment[]) {
      const list = repliesByRoot.get(Number(reply.rootId)) || [];
      list.push(this.toPublicComment(reply, setting));
      repliesByRoot.set(Number(reply.rootId), list);
    }
    return {
      items: (result.roots as StoredComment[]).map((root) => ({
        ...this.toPublicComment(root, setting),
        replies: repliesByRoot.get(Number(root.id)) || [],
      })),
      total: result.total,
      count: result.count,
      page,
      pageSize: setting.pageSize,
      sort,
      config: this.publicConfig(setting),
      repliesTruncated: result.repliesTruncated,
    };
  }

  async countPublic(targetsParam: unknown): Promise<PublicCommentCounts> {
    const siteInfo = await this.getSiteInfo();
    this.assertEnabled(siteInfo);
    const keys = [...new Set(splitCommentListParam(targetsParam))];
    if (!keys.length) throw invalidCommentInput('targets is required');
    if (keys.length > COMMENT_LIMITS.countMaxTargets) {
      throw invalidCommentInput(`At most ${COMMENT_LIMITS.countMaxTargets} targets are allowed`);
    }
    const targets = keys.map((key) => {
      const parsed = parseCommentTargetKey(key);
      if (!parsed) throw invalidCommentInput(`Invalid comment target: ${key.slice(0, 40)}`);
      return parsed;
    });
    const infos = await this.describeTargets(targets, siteInfo);
    const open = targets.filter((target) => infos.get(target.key)?.available);
    const counts = await this.structuredDataService.countVisibleCommentsByTargets(open);
    const result: PublicCommentCounts = {};
    for (const target of targets) {
      result[target.key] = Number(counts[target.key] || 0);
    }
    return result;
  }

  /** Visible comment count of an article for the engagement endpoints; never throws. */
  async countForArticle(articleId: number | string): Promise<number> {
    const id = parsePositiveInteger(typeof articleId === 'number' ? articleId : String(articleId));
    if (id === null) return 0;
    try {
      const key = formatCommentTargetKey('post', id);
      const target = { type: 'post' as const, id: String(id) };
      const info = (await this.describeTargets([target])).get(key);
      if (!info?.available) return 0;
      const counts = await this.structuredDataService.countVisibleCommentsByTargets([target]);
      return Number(counts[key] || 0);
    } catch (error) {
      this.logger.warn(`Failed to count comments of article ${id}: ${error?.message || error}`);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Public writes
  // ---------------------------------------------------------------------------

  private async runSerialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.catch(() => undefined);
    return await run;
  }

  private async inspectClient(ip: string, ua: string): Promise<CommentClientInfo> {
    const empty = { location: '', browser: '', os: '' };
    if (!this.clientInfo) return empty;
    try {
      const info = await this.clientInfo.inspect(ip, ua);
      return {
        location: String(info?.location || ''),
        browser: String(info?.browser || ''),
        os: String(info?.os || ''),
      };
    } catch (error) {
      this.logger.warn(`Client info lookup failed: ${error?.message || error}`);
      return empty;
    }
  }

  private fireHook(
    name: 'afterCreate' | 'afterApprove',
    comment: CommentRecord,
    context: CommentHookContext,
  ) {
    void Promise.resolve()
      .then(() => this.hooks[name](comment, context))
      .catch((error) => {
        this.logger.warn(`Comment hook ${name} failed: ${error?.message || error}`);
      });
  }

  private toRecord(stored: any): StoredComment {
    const source = stored?.toObject ? stored.toObject() : stored;
    return {
      ...source,
      id: Number(source.id),
      parentId: source.parentId ?? null,
      rootId: source.rootId ?? null,
      replyToNick: source.replyToNick ?? null,
      images: Array.isArray(source.images) ? source.images : [],
      likes: Number(source.likes || 0),
      createdAt: toDate(source.createdAt),
      updatedAt: toDate(source.updatedAt),
    };
  }

  private async getStored(id: number): Promise<StoredComment | null> {
    const comment = await this.structuredDataService.getCommentById(id);
    return comment ? this.toRecord(comment) : null;
  }

  private async insertComment(record: Omit<CommentRecord, 'id'>): Promise<StoredComment> {
    return await this.runSerialized(async () => {
      const id = await this.structuredDataService.nextCommentId();
      const payload = { ...record, id, _id: randomUUID() };
      const document = new this.commentModel(payload);
      await document.save();
      await this.structuredDataService.upsertComment(payload);
      return payload;
    });
  }

  private parentUnavailable() {
    return commentError(
      400,
      'COMMENT_PARENT_UNAVAILABLE',
      'The comment being replied to is not available',
    );
  }

  /** The parent must be an approved, publicly visible comment of the same target. */
  private async loadReplyParent(parentId: number, target: CommentTarget) {
    const parent = await this.getStored(parentId);
    if (
      !parent ||
      parent.status !== 'approved' ||
      parent.targetType !== target.type ||
      String(parent.targetId) !== String(target.id)
    ) {
      throw this.parentUnavailable();
    }
    if (parent.rootId !== null) {
      const root = await this.getStored(parent.rootId);
      if (!root || (root.status !== 'approved' && root.status !== 'deleted')) {
        throw this.parentUnavailable();
      }
    }
    return parent;
  }

  async create(body: unknown, context: CommentWriteContext): Promise<CreateCommentResult> {
    const siteInfo = await this.getSiteInfo();
    this.assertEnabled(siteInfo);
    if (!isRecord(body)) throw invalidCommentInput('Expected a JSON object');
    const setting = await this.settingProvider.getCommentSetting();
    const admin = context.admin;

    const content = normalizeCommentContent(
      body.content,
      admin ? COMMENT_LIMITS.contentHardMaxLength : setting.maxLength,
    );
    const parentId = normalizeCommentParentId(body.parentId);
    const nick = admin ? admin.nick : normalizeCommentNick(body.nick);
    const mail = admin
      ? setting.notify.ownerEmail
      : normalizeCommentMail(body.mail, setting.requireMail);
    const link = admin ? '' : normalizeCommentLink(body.link);
    const target = await this.resolvePublicTarget(body.target, siteInfo);

    if (!admin) {
      // Honeypot hits count against the visitor's own budget, so a bot sees the
      // same 429 a person would, but they never use up the shared budgets.
      await this.requestService.consume('createPerVisitorShort', context.visitorKey);
      await this.requestService.consume('createPerVisitorDay', context.visitorKey);
      const honeypot = body.website;
      if (honeypot !== undefined && honeypot !== null && String(honeypot) !== '') {
        const parent = parentId === null ? null : await this.loadReplyParent(parentId, target);
        return await this.pretendCreated(target, { parent, nick, link, content }, setting, context);
      }
    }

    const parent = parentId === null ? null : await this.loadReplyParent(parentId, target);

    const dedupeKey = `comment:dedupe:${createHash('sha256')
      .update(JSON.stringify([target.key, parentId, nick, content]))
      .digest('hex')}`;
    const fresh = await this.cacheProvider.setIfAbsent(
      dedupeKey,
      1,
      COMMENT_LIMITS.duplicateWindowSeconds,
    );
    if (!fresh) {
      throw commentError(409, 'COMMENT_DUPLICATE', 'The same comment was just posted');
    }

    let record: StoredComment;
    try {
      if (!admin) {
        // Shared budgets are charged only once the request is known to be
        // storable, so invalid parents or duplicates cannot drain them.
        await this.requestService.consume('createPerTargetHour', target.key);
        await this.requestService.consume('createGlobalHour', 'global');
      }
      const images = extractCommentImages(content);
      const status = decideCommentStatus({
        isAdmin: Boolean(admin),
        moderation: setting.moderation,
        forbiddenWords: setting.forbiddenWords,
        nick,
        mail,
        link,
        content,
        images,
      });
      const clientInfo = await this.inspectClient(context.ip, context.ua);
      const now = new Date();
      record = await this.insertComment({
        targetType: target.type,
        targetId: target.id,
        parentId: parent ? parent.id : null,
        rootId: parent ? parent.rootId ?? parent.id : null,
        replyToNick: parent ? parent.nick : null,
        nick,
        mail,
        link,
        content,
        status,
        isAdmin: Boolean(admin),
        pinned: false,
        likes: 0,
        ip: context.ip || '',
        ua: context.ua || '',
        ...clientInfo,
        images,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      await this.cacheProvider.del(dedupeKey).catch(() => undefined);
      throw error;
    }

    this.fireHook('afterCreate', this.withoutStorageFields(record), {
      target,
      parent: parent ? this.withoutStorageFields(parent) : null,
    });
    if (record.status === 'approved') {
      await this.invalidateTargets([target]);
    }
    return {
      comment: this.toPublicComment(record, setting),
      status: record.status === 'approved' ? 'approved' : 'pending',
    };
  }

  /** Honeypot hit: answer exactly like a held comment, but store nothing. */
  private async pretendCreated(
    target: ResolvedCommentTarget,
    input: { parent: StoredComment | null; nick: string; link: string; content: string },
    setting: CommentSetting,
    context: CommentWriteContext,
  ): Promise<CreateCommentResult> {
    const id = await this.structuredDataService.nextCommentId();
    const now = new Date();
    // Same visible metadata as a stored comment, so the trap cannot be told apart.
    const clientInfo = await this.inspectClient(context.ip, context.ua);
    const comment = this.toPublicComment(
      {
        id,
        targetType: target.type,
        targetId: target.id,
        parentId: input.parent ? input.parent.id : null,
        rootId: input.parent ? input.parent.rootId ?? input.parent.id : null,
        replyToNick: input.parent ? input.parent.nick : null,
        nick: input.nick,
        mail: '',
        link: input.link,
        content: input.content,
        status: 'pending',
        isAdmin: false,
        pinned: false,
        likes: 0,
        ip: '',
        ua: '',
        ...clientInfo,
        images: [],
        createdAt: now,
        updatedAt: now,
      },
      setting,
    );
    return { comment, status: 'pending' };
  }

  private withoutStorageFields(comment: StoredComment): CommentRecord {
    const { _id, parentExcerpt, ...record } = comment as any;
    return record;
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  private notFound() {
    return commentError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }

  private parseId(value: unknown): number {
    const id = parsePositiveInteger(typeof value === 'number' ? value : String(value ?? ''));
    if (id === null) throw this.notFound();
    return id;
  }

  private toAdminComment(comment: StoredComment, infos: Map<string, TargetInfo>): AdminComment {
    const key = formatCommentTargetKey(comment.targetType, comment.targetId);
    const info = infos.get(key);
    return {
      id: Number(comment.id),
      target: key,
      targetTitle: info?.target.title || '',
      targetUrl: info?.target.url || '',
      targetAvailable: Boolean(info?.available),
      parentId: comment.parentId ?? null,
      rootId: comment.rootId ?? null,
      replyToNick: comment.replyToNick ?? null,
      ...(comment.parentExcerpt ? { parentExcerpt: comment.parentExcerpt } : {}),
      nick: comment.nick || '',
      mail: comment.mail || '',
      link: comment.link || '',
      content: comment.content || '',
      status: comment.status,
      isAdmin: Boolean(comment.isAdmin),
      pinned: Boolean(comment.pinned),
      likes: Number(comment.likes || 0),
      ip: comment.ip || '',
      ua: comment.ua || '',
      location: comment.location || '',
      browser: comment.browser || '',
      os: comment.os || '',
      createdAt: toIso(comment.createdAt),
      updatedAt: toIso(comment.updatedAt),
    };
  }

  private async toAdminComments(comments: StoredComment[]): Promise<AdminComment[]> {
    const infos = await this.describeTargets(comments.map((comment) => this.targetOf(comment)));
    return comments.map((comment) => this.toAdminComment(comment, infos));
  }

  private async toAdminView(comment: StoredComment): Promise<AdminComment> {
    const [view] = await this.toAdminComments([comment]);
    return view;
  }

  async listAdmin(query: Record<string, unknown> = {}): Promise<AdminCommentList> {
    let status: CommentStatus | undefined;
    if (query.status !== undefined && query.status !== '' && query.status !== 'all') {
      if (!(COMMENT_STATUSES as readonly unknown[]).includes(query.status)) {
        throw invalidCommentInput(`status must be one of ${COMMENT_STATUSES.join(', ')}`);
      }
      status = query.status as CommentStatus;
    }
    const search =
      typeof query.search === 'string'
        ? query.search.trim().slice(0, COMMENT_LIMITS.adminSearchMaxLength)
        : '';
    let target: CommentTarget | null = null;
    if (query.target !== undefined && query.target !== '') {
      target = parseCommentTargetKey(query.target);
      if (!target) throw invalidCommentInput('Invalid comment target');
    }
    const page = Math.min(parsePositiveInteger(query.page) ?? 1, MAX_PUBLIC_PAGE);
    const pageSize = Math.min(
      parsePositiveInteger(query.pageSize) ?? COMMENT_LIMITS.adminPageSizeDefault,
      COMMENT_LIMITS.adminPageSizeMax,
    );
    const result = await this.structuredDataService.queryAdminComments({
      status,
      search,
      targetType: target?.type,
      targetId: target?.id,
      page,
      pageSize,
    });
    return {
      items: await this.toAdminComments(result.comments.map((comment) => this.toRecord(comment))),
      total: result.total,
      page,
      pageSize,
    };
  }

  async getStats(): Promise<AdminCommentStats> {
    const { byStatus, recent } = await this.structuredDataService.getCommentStats(
      COMMENT_LIMITS.recentStatsSize,
    );
    const pending = Number(byStatus.pending || 0);
    const approved = Number(byStatus.approved || 0);
    const spam = Number(byStatus.spam || 0);
    const deleted = Number(byStatus.deleted || 0);
    return {
      pending,
      approved,
      spam,
      deleted,
      total: pending + approved + spam + deleted,
      recent: await this.toAdminComments(recent.map((comment) => this.toRecord(comment))),
    };
  }

  /** Writes fields to the record and mirrors the result. Runs inside the write queue. */
  private async writeFields(
    id: number,
    fields: Partial<CommentRecord>,
    touch = true,
  ): Promise<StoredComment> {
    const update = touch ? { ...fields, updatedAt: new Date() } : fields;
    const updated = await this.commentModel.findOneAndUpdate(
      { id },
      { $set: update },
      { new: true },
    );
    if (!updated) throw this.notFound();
    const record = this.toRecord(updated);
    await this.structuredDataService.upsertComment(record);
    return record;
  }

  /**
   * Moves one comment to a new status. Approving a reply requires its direct
   * parent to be approved or deleted; pending and spam cascade to every
   * non-deleted descendant. Runs inside the write queue.
   */
  private async applyStatus(current: StoredComment, next: CommentStatus): Promise<StatusChange> {
    if (current.status === next) {
      return { before: current, after: current, parent: null, affectsPublic: false };
    }
    let parent: StoredComment | null = null;
    if (next === 'approved' && current.parentId !== null) {
      parent = await this.getStored(current.parentId);
      if (!parent || (parent.status !== 'approved' && parent.status !== 'deleted')) {
        throw commentError(
          400,
          'COMMENT_PARENT_UNAVAILABLE',
          'The parent comment must be approved first',
        );
      }
    }
    const after = await this.writeFields(current.id, { status: next });
    if (next === 'pending' || next === 'spam') {
      const descendantIds = await this.structuredDataService.getCommentDescendantIds(current.id);
      const descendants = await this.structuredDataService.getCommentsByIds(descendantIds);
      const ids = descendants
        .filter((item) => item.status !== 'deleted' && item.status !== next)
        .map((item) => Number(item.id));
      if (ids.length) {
        await this.commentModel.updateMany(
          { id: { $in: ids } },
          { $set: { status: next, updatedAt: new Date() } },
        );
        const refreshed = await this.commentModel
          .find({ id: { $in: ids } })
          .lean()
          .exec();
        for (const record of refreshed || []) {
          await this.structuredDataService.upsertComment(record);
        }
      }
    }
    const visible = (status: CommentStatus) => status === 'approved' || status === 'deleted';
    return {
      before: current,
      after,
      parent,
      affectsPublic: visible(current.status) || visible(next),
    };
  }

  private async moderate(id: number, next: CommentStatus): Promise<StatusChange> {
    return await this.runSerialized(async () => {
      const current = await this.getStored(id);
      if (!current) throw this.notFound();
      return await this.applyStatus(current, next);
    });
  }

  /** Hooks and cache invalidation after committed status changes. Never throws. */
  private async afterModeration(changes: StatusChange[]) {
    try {
      const approvals = changes.filter(
        (change) =>
          (change.before.status === 'pending' || change.before.status === 'spam') &&
          change.after.status === 'approved',
      );
      if (approvals.length) {
        const infos = await this.describeTargets(
          approvals.map((change) => this.targetOf(change.after)),
        );
        for (const change of approvals) {
          const info = infos.get(
            formatCommentTargetKey(change.after.targetType, change.after.targetId),
          );
          if (!info) continue;
          this.fireHook('afterApprove', this.withoutStorageFields(change.after), {
            target: info.target,
            parent: change.parent ? this.withoutStorageFields(change.parent) : null,
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to dispatch approval hooks: ${error?.message || error}`);
    }
    const targets = changes
      .filter((change) => change.affectsPublic)
      .map((change) => this.targetOf(change.after));
    if (targets.length) await this.invalidateTargets(targets);
  }

  async updateAdmin(idParam: unknown, body: unknown): Promise<AdminComment> {
    const id = this.parseId(idParam);
    if (!isRecord(body)) throw invalidCommentInput('Expected a JSON object');
    const hasStatus = body.status !== undefined;
    const hasPinned = body.pinned !== undefined;
    const hasContent = body.content !== undefined;
    if (!hasStatus && !hasPinned && !hasContent) throw invalidCommentInput('Nothing to update');
    if (hasStatus && !MODERATION_STATUSES.includes(body.status)) {
      throw invalidCommentInput(`status must be one of ${MODERATION_STATUSES.join(', ')}`);
    }
    if (hasPinned && typeof body.pinned !== 'boolean') {
      throw invalidCommentInput('pinned must be a boolean');
    }
    const content = hasContent
      ? normalizeCommentContent(body.content, COMMENT_LIMITS.contentHardMaxLength)
      : undefined;

    const result = await this.runSerialized(async () => {
      const current = await this.getStored(id);
      if (!current) throw this.notFound();
      if (hasPinned && body.pinned && current.rootId !== null) {
        throw invalidCommentInput('Only root comments can be pinned');
      }
      const change = hasStatus
        ? await this.applyStatus(current, body.status as CommentStatus)
        : { before: current, after: current, parent: null, affectsPublic: false };
      const fields: Partial<CommentRecord> = {};
      if (content !== undefined && content !== current.content) {
        fields.content = content;
        fields.images = extractCommentImages(content);
      }
      if (hasPinned && body.pinned !== current.pinned) fields.pinned = body.pinned;
      if (!Object.keys(fields).length) return change;
      const after = await this.writeFields(id, fields);
      return {
        ...change,
        after,
        affectsPublic:
          change.affectsPublic || after.status === 'approved' || after.status === 'deleted',
      };
    });
    await this.afterModeration([result]);
    return await this.toAdminView(result.after);
  }

  async softDelete(idParam: unknown): Promise<AdminComment> {
    const change = await this.moderate(this.parseId(idParam), 'deleted');
    await this.afterModeration([change]);
    return await this.toAdminView(change.after);
  }

  /** Hard-deletes a comment, all of its descendants and their likes. Runs inside the write queue. */
  private async purgeTree(id: number): Promise<{ ids: number[]; target: CommentTarget }> {
    const current = await this.getStored(id);
    if (!current) throw this.notFound();
    const ids = [id, ...(await this.structuredDataService.getCommentDescendantIds(id))];
    await this.commentModel.deleteMany({ id: { $in: ids } });
    await this.commentLikeModel.deleteMany({ commentId: { $in: ids } });
    await this.structuredDataService.deleteCommentsByIds(ids);
    await this.structuredDataService.deleteCommentLikesByCommentIds(ids);
    return { ids, target: this.targetOf(current) };
  }

  async purge(idParam: unknown): Promise<{ purged: number }> {
    const id = this.parseId(idParam);
    const result = await this.runSerialized(() => this.purgeTree(id));
    await this.invalidateTargets([result.target]);
    return { purged: result.ids.length };
  }

  async batch(body: unknown): Promise<BatchCommentResult> {
    if (!isRecord(body)) throw invalidCommentInput('Expected a JSON object');
    if (!(COMMENT_BATCH_ACTIONS as readonly unknown[]).includes(body.action)) {
      throw invalidCommentInput(`action must be one of ${COMMENT_BATCH_ACTIONS.join(', ')}`);
    }
    if (!Array.isArray(body.ids) || !body.ids.length) {
      throw invalidCommentInput('ids must be a non-empty array');
    }
    if (body.ids.length > COMMENT_LIMITS.batchMaxIds) {
      throw invalidCommentInput(`At most ${COMMENT_LIMITS.batchMaxIds} ids are allowed`);
    }
    const ids = parseCommentIdList(body.ids, COMMENT_LIMITS.batchMaxIds).sort((a, b) => a - b);
    const action = body.action as CommentBatchAction;
    const statusByAction: Partial<Record<CommentBatchAction, CommentStatus>> = {
      approve: 'approved',
      spam: 'spam',
      pending: 'pending',
      delete: 'deleted',
    };
    const failed: BatchCommentResult['failed'] = [];
    const changes: StatusChange[] = [];
    const purgedTargets: CommentTarget[] = [];
    const purged = new Set<number>();
    let updated = 0;
    // Ascending ids put parents before their replies, so approving a thread in
    // one batch works and purging a root covers the replies listed after it.
    for (const id of ids) {
      if (purged.has(id)) {
        updated += 1;
        continue;
      }
      try {
        if (action === 'purge') {
          const result = await this.runSerialized(() => this.purgeTree(id));
          result.ids.forEach((item) => purged.add(item));
          purgedTargets.push(result.target);
        } else {
          changes.push(await this.moderate(id, statusByAction[action]!));
        }
        updated += 1;
      } catch (error) {
        failed.push({ id, reason: this.failureReason(error) });
      }
    }
    await this.afterModeration(changes);
    if (purgedTargets.length) await this.invalidateTargets(purgedTargets);
    return { updated, failed };
  }

  private failureReason(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse() as any;
      return String(response?.code || response?.message || error.message);
    }
    this.logger.warn(`Batch comment action failed: ${(error as any)?.message || error}`);
    return 'COMMENT_ACTION_FAILED';
  }

  /**
   * Replies to a comment as the site owner. A pending parent is approved first
   * (firing afterApprove); spam or deleted parents cannot be answered.
   */
  async replyAsAdmin(
    idParam: unknown,
    body: unknown,
    context: { nick: string; ip: string; ua: string },
  ): Promise<AdminComment> {
    const id = this.parseId(idParam);
    if (!isRecord(body)) throw invalidCommentInput('Expected a JSON object');
    const content = normalizeCommentContent(body.content, COMMENT_LIMITS.contentHardMaxLength);
    let parent = await this.getStored(id);
    if (!parent) throw this.notFound();
    if (parent.status === 'spam' || parent.status === 'deleted') throw this.parentUnavailable();
    const changes: StatusChange[] = [];
    if (parent.status === 'pending') {
      const change = await this.moderate(id, 'approved');
      changes.push(change);
      parent = change.after;
    }
    const setting = await this.settingProvider.getCommentSetting();
    const parentTarget = this.targetOf(parent);
    const info = (await this.describeTargets([parentTarget])).get(
      formatCommentTargetKey(parentTarget.type, parentTarget.id),
    );
    const clientInfo = await this.inspectClient(context.ip, context.ua);
    const now = new Date();
    const record = await this.insertComment({
      targetType: parent.targetType,
      targetId: String(parent.targetId),
      parentId: parent.id,
      rootId: parent.rootId ?? parent.id,
      replyToNick: parent.nick,
      nick: context.nick,
      mail: setting.notify.ownerEmail,
      link: '',
      content,
      status: 'approved',
      isAdmin: true,
      pinned: false,
      likes: 0,
      ip: context.ip || '',
      ua: context.ua || '',
      ...clientInfo,
      images: extractCommentImages(content),
      createdAt: now,
      updatedAt: now,
    });
    await this.afterModeration(changes);
    if (info) {
      this.fireHook('afterCreate', this.withoutStorageFields(record), {
        target: info.target,
        parent: this.withoutStorageFields(parent),
      });
    }
    await this.invalidateTargets([parentTarget]);
    return await this.toAdminView(record);
  }

  /** Called after the comment setting changed; cached public payloads depend on it. */
  afterSettingChanged() {
    if (!this.cloudflareCacheProvider) return;
    void this.cloudflareCacheProvider
      .purgeByTags(['comment-public'], 'comment setting change')
      .catch(() => undefined);
  }

  // ---------------------------------------------------------------------------
  // Likes
  // ---------------------------------------------------------------------------

  /** Approved, and (for replies) the root is approved or a placeholder. */
  private async isPubliclyVisible(comment: StoredComment): Promise<boolean> {
    if (comment.status !== 'approved') return false;
    if (comment.rootId === null) return true;
    const root = await this.getStored(comment.rootId);
    return Boolean(root) && (root.status === 'approved' || root.status === 'deleted');
  }

  /**
   * Toggles the like of one anonymous browser identity and recomputes the
   * comment's `likes` from the like rows. `actorToken` is the cookie value.
   */
  async toggleLike(
    idParam: unknown,
    context: { actorToken: string; visitorKey: string },
  ): Promise<CommentLikeResult> {
    const siteInfo = await this.getSiteInfo();
    this.assertEnabled(siteInfo);
    const id = this.parseId(idParam);
    await this.requestService.consume('likePerVisitorShort', context.visitorKey);
    const comment = await this.getStored(id);
    if (!comment || !(await this.isPubliclyVisible(comment))) throw this.notFound();
    await this.resolvePublicTarget(
      formatCommentTargetKey(comment.targetType, comment.targetId),
      siteInfo,
    );
    const actorHash = hashCommentActor(context.actorToken);
    return await this.runSerialized(async () => {
      const recordId = commentLikeRecordId(id, actorHash);
      const [existing] = await this.structuredDataService.getLikedCommentIds(actorHash, [id]);
      let liked: boolean;
      if (existing) {
        await this.commentLikeModel.deleteOne({ _id: recordId });
        await this.structuredDataService.deleteCommentLike(id, actorHash);
        liked = false;
      } else {
        const like = { _id: recordId, commentId: id, actorHash, createdAt: new Date() };
        await new this.commentLikeModel(like).save();
        await this.structuredDataService.upsertCommentLike(like);
        liked = true;
      }
      const likes = await this.structuredDataService.countCommentLikes(id);
      // Likes are not an edit, so updatedAt stays as it is.
      await this.writeFields(id, { likes }, false);
      return { liked, likes };
    });
  }

  /** Ids among `idsParam` the browser identity has liked; never creates the identity. */
  async likedIds(idsParam: unknown, actorToken: string): Promise<PublicCommentLiked> {
    await this.assertCommentsEnabled();
    const ids = parseCommentIdList(idsParam, COMMENT_LIMITS.likedMaxIds);
    if (!actorToken || !ids.length) return { ids: [] };
    return {
      ids: await this.structuredDataService.getLikedCommentIds(hashCommentActor(actorToken), ids),
    };
  }

  // ---------------------------------------------------------------------------
  // Backup
  // ---------------------------------------------------------------------------

  /** Number of stored comments of any status. */
  async countAll(): Promise<number> {
    return await this.structuredDataService.countAllComments();
  }

  /** Removes every comment and like record (full-site restore and clear). */
  async deleteAllRecords(): Promise<number> {
    const total = await this.countAll().catch(() => 0);
    await this.commentModel.deleteMany({});
    await this.commentLikeModel.deleteMany({});
    return total;
  }

  /**
   * Writes comment and like records from a backup. Malformed entries are
   * skipped; ids are kept so threads and likes stay connected. The caller
   * rebuilds the structured tables afterwards.
   */
  async importRecords(
    comments: unknown[],
    likes: unknown[],
  ): Promise<{ comments: number; likes: number; skipped: number }> {
    let skipped = 0;
    const seen = new Set<number>();
    const imported: number[] = [];
    for (const item of comments || []) {
      const record = this.sanitizeImportedComment(item);
      if (!record || seen.has(record.id)) {
        skipped += 1;
        continue;
      }
      seen.add(record.id);
      await new this.commentModel(record).save();
      imported.push(record.id);
    }
    const likeIds = new Set<string>();
    let likeCount = 0;
    for (const item of likes || []) {
      if (!isRecord(item)) {
        skipped += 1;
        continue;
      }
      const commentId = parsePositiveInteger(item.commentId);
      const actorHash = typeof item.actorHash === 'string' ? item.actorHash : '';
      if (commentId === null || !seen.has(commentId) || !/^[0-9a-f]{64}$/u.test(actorHash)) {
        skipped += 1;
        continue;
      }
      const recordId = commentLikeRecordId(commentId, actorHash);
      if (likeIds.has(recordId)) continue;
      likeIds.add(recordId);
      await new this.commentLikeModel({
        _id: recordId,
        commentId,
        actorHash,
        createdAt: toDate(item.createdAt),
      }).save();
      likeCount += 1;
    }
    return { comments: imported.length, likes: likeCount, skipped };
  }

  private sanitizeImportedComment(item: unknown): (CommentRecord & { _id: string }) | null {
    if (!isRecord(item)) return null;
    const id = parsePositiveInteger(item.id);
    const target =
      typeof item.targetType === 'string' && item.targetId !== undefined && item.targetId !== null
        ? parseCommentTargetKey(formatCommentTargetKey(item.targetType, String(item.targetId)))
        : null;
    if (id === null || !target) return null;
    if (!(COMMENT_STATUSES as readonly unknown[]).includes(item.status)) return null;
    const optionalId = (value: unknown) =>
      value === null || value === undefined ? null : parsePositiveInteger(value);
    const text = (value: unknown, max: number) =>
      typeof value === 'string' ? value.slice(0, max) : '';
    const parentId = optionalId(item.parentId);
    const rootId = optionalId(item.rootId);
    if ((parentId === null) !== (rootId === null)) return null;
    const content = text(item.content, COMMENT_LIMITS.contentHardMaxLength);
    return {
      _id: typeof item._id === 'string' && item._id ? item._id : randomUUID(),
      id,
      targetType: target.type,
      targetId: target.id,
      parentId,
      rootId,
      replyToNick:
        typeof item.replyToNick === 'string'
          ? item.replyToNick.slice(0, COMMENT_LIMITS.nickMaxLength)
          : null,
      nick: text(item.nick, COMMENT_LIMITS.nickMaxLength),
      mail: text(item.mail, COMMENT_LIMITS.mailMaxLength),
      link: text(item.link, COMMENT_LIMITS.linkMaxLength),
      content,
      status: item.status as CommentStatus,
      isAdmin: item.isAdmin === true,
      pinned: item.pinned === true && rootId === null,
      likes: Math.max(0, Math.trunc(Number(item.likes) || 0)),
      ip: text(item.ip, 64),
      ua: text(item.ua, 512),
      location: text(item.location, 128),
      browser: text(item.browser, 128),
      os: text(item.os, 128),
      images: extractCommentImages(content),
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt || item.createdAt),
    };
  }

  // ---------------------------------------------------------------------------
  // Cache invalidation
  // ---------------------------------------------------------------------------

  /**
   * Drops server-side caches derived from the visible comments of the targets
   * (article engagement and fragment payloads) and asks the CDN to purge the
   * tagged comment responses. Never throws.
   */
  private async invalidateTargets(targets: CommentTarget[]) {
    try {
      const unique = [
        ...new Map(
          targets.map((target) => [formatCommentTargetKey(target.type, target.id), target]),
        ).values(),
      ];
      const infos = await this.describeTargets(unique);
      const keys: string[] = [];
      const tags: string[] = [];
      for (const target of unique) {
        const key = formatCommentTargetKey(target.type, target.id);
        tags.push(toCacheTag('comment', key));
        if (target.type !== 'post') continue;
        const aliases = [target.id, infos.get(key)?.pathname].filter(Boolean) as string[];
        for (const alias of aliases) {
          keys.push(`public:article:engagement:${alias}`);
          for (const size of FRAGMENT_CACHE_SIZES) {
            keys.push(`public:article:fragments:${alias}:${size}`);
          }
          tags.push(toCacheTag('post-comments', alias));
          tags.push(toCacheTag('post-comments', encodeURIComponent(alias)));
        }
      }
      await Promise.all(keys.map((key) => this.cacheProvider.del(key)));
      if (this.cloudflareCacheProvider && tags.length) {
        void this.cloudflareCacheProvider
          .purgeByTags(tags, 'comment change')
          .catch(() => undefined);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate comment caches: ${error?.message || error}`);
    }
  }
}
