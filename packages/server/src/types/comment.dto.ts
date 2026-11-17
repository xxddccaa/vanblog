/**
 * Native comment system contract.
 *
 * This file is the single source of truth shared by the server, the website
 * theme and the admin. HTTP envelopes follow the existing convention:
 * `{ statusCode: 200, data: <payload> }` on success and Nest's default error
 * body plus a machine readable `code` (see CommentErrorCode) on failure.
 *
 * Public routes (prefix /api/public/comment, gated by private-site mode):
 *   GET    /                ?target=post:12&page=1&sort=latest     -> PublicCommentPage
 *   GET    /count           ?targets=post:1,post:2,page:link       -> PublicCommentCounts
 *   GET    /identity                                               -> PublicCommentIdentity (no-store)
 *   GET    /liked           ?ids=1,2,3                             -> PublicCommentLiked (no-store)
 *   POST   /                body CreateCommentBody (JSON only)     -> CreateCommentResult
 *   POST   /:id/like        empty JSON body                        -> CommentLikeResult
 *   POST   /image           multipart: file, target                -> CommentImageResult
 *
 * Admin routes (prefix /api/admin/comment, super admin only):
 *   GET    /                ?status=&search=&target=&page=&pageSize= -> AdminCommentList
 *   GET    /stats                                                  -> AdminCommentStats
 *   PATCH  /:id             body UpdateCommentBody                 -> AdminComment
 *   POST   /batch           body BatchCommentBody                  -> BatchCommentResult
 *   DELETE /:id                                                    -> AdminComment (soft delete)
 *   DELETE /:id/purge                                              -> { purged: number }
 *   POST   /:id/reply       body AdminReplyBody                    -> AdminComment
 *   GET    /setting                                                -> AdminCommentSetting
 *   PUT    /setting         body UpdateCommentSettingBody          -> AdminCommentSetting
 *   POST   /notify/test     body { to: string }                    -> { sent: true }
 */

export const COMMENT_STATUSES = ['approved', 'pending', 'spam', 'deleted'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
/** Statuses an administrator may set directly; deletion has its own routes. */
export type ModerationStatus = Exclude<CommentStatus, 'deleted'>;

export const COMMENT_TARGET_TYPES = ['post', 'page'] as const;
export type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number];

/** Non-article pages that host a comment section. */
export const COMMENT_PAGE_TARGETS = ['link', 'about'] as const;
export type CommentPageTarget = (typeof COMMENT_PAGE_TARGETS)[number];

/**
 * Wire format of a comment target: `post:<articleId>` or `page:<link|about>`.
 * Articles are always addressed by numeric id, never by pathname, so slug
 * changes and URL encoding differences cannot split a thread.
 */
export type CommentTargetKey = `post:${number}` | `page:${CommentPageTarget}`;

export interface CommentTarget {
  type: CommentTargetType;
  /** Article id as a decimal string, or a CommentPageTarget. */
  id: string;
}

/** A target that exists and is currently open for public comments. */
export interface ResolvedCommentTarget extends CommentTarget {
  key: CommentTargetKey;
  /** Article title, or the page name, for notifications and the admin list. */
  title: string;
  /** Site-relative URL of the page hosting the thread, e.g. `/post/hello`. */
  url: string;
  /** Numeric article id when type is `post`. */
  articleId?: number;
}

export const COMMENT_SORTS = ['latest', 'oldest', 'hot'] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];

export const COMMENT_MODERATION_MODES = ['all', 'suspicious', 'off'] as const;
export type CommentModerationMode = (typeof COMMENT_MODERATION_MODES)[number];

export const COMMENT_BATCH_ACTIONS = ['approve', 'spam', 'pending', 'delete', 'purge'] as const;
export type CommentBatchAction = (typeof COMMENT_BATCH_ACTIONS)[number];

export const COMMENT_LIMITS = {
  nickMaxLength: 32,
  mailMaxLength: 128,
  linkMaxLength: 200,
  /** Default and hard ceiling for the configurable content length. */
  contentDefaultMaxLength: 5_000,
  contentHardMaxLength: 20_000,
  pageSizeDefault: 10,
  pageSizeMin: 5,
  pageSizeMax: 50,
  /** Upper bound of replies returned together with one page of root comments. */
  maxRepliesPerPage: 500,
  adminPageSizeDefault: 20,
  adminPageSizeMax: 100,
  adminSearchMaxLength: 100,
  batchMaxIds: 200,
  countMaxTargets: 50,
  likedMaxIds: 600,
  forbiddenWordsMax: 500,
  forbiddenWordMaxLength: 64,
  /** Suspicious-mode heuristics. */
  suspiciousLinkCount: 3,
  suspiciousRepeatedRun: 16,
  duplicateWindowSeconds: 600,
  imageMaxBytes: 5 * 1024 * 1024,
  imageMaxPixels: 40_000_000,
  imageMaxConcurrent: 2,
  /** Unreferenced uploads older than this are removed by the cleanup task. */
  imageOrphanTtlSeconds: 24 * 60 * 60,
  recentStatsSize: 10,
} as const;

export interface CommentRateLimitRule {
  max: number;
  windowSeconds: number;
}

/**
 * Per-visitor rules are keyed by getRateLimitBucket(getRequestIp(req)) so an
 * IPv6 /64 counts as one visitor. Requests carrying a valid super admin
 * session bypass every rule here.
 */
export const COMMENT_RATE_LIMITS = {
  createPerVisitorShort: { max: 5, windowSeconds: 600 },
  createPerVisitorDay: { max: 30, windowSeconds: 86_400 },
  createPerTargetHour: { max: 30, windowSeconds: 3_600 },
  createGlobalHour: { max: 300, windowSeconds: 3_600 },
  likePerVisitorShort: { max: 60, windowSeconds: 600 },
  imagePerVisitorHour: { max: 10, windowSeconds: 3_600 },
  imagePerVisitorDay: { max: 30, windowSeconds: 86_400 },
  imageGlobalHour: { max: 200, windowSeconds: 3_600 },
  readPerVisitorMinute: { max: 120, windowSeconds: 60 },
} as const satisfies Record<string, CommentRateLimitRule>;

export const COMMENT_NOTIFY_LIMITS = {
  perRecipientDay: { max: 10, windowSeconds: 86_400 },
  globalDay: { max: 200, windowSeconds: 86_400 },
  webhookTimeoutMs: 5_000,
  smtpTimeoutMs: 10_000,
  /** Characters of comment content quoted in an email or webhook payload. */
  excerptLength: 500,
} as const;

/** httpOnly cookie holding the random anonymous like identity. */
export const COMMENT_ACTOR_COOKIE = 'vanblog_comment_actor';

/** Directory below the static root where visitor images are stored. */
export const COMMENT_IMAGE_DIR = 'img/comment';

/** Pipeline events dispatched by the comment system (passive). */
export const COMMENT_PIPELINE_EVENTS = {
  afterCreate: 'afterCommentCreate',
  afterApprove: 'afterCommentApprove',
} as const;

/** Machine readable error codes; the clients map them to localized copy. */
export const COMMENT_ERROR_CODES = [
  'COMMENT_DISABLED',
  'COMMENT_TARGET_UNAVAILABLE',
  'COMMENT_INVALID_INPUT',
  'COMMENT_CONTENT_TOO_LONG',
  'COMMENT_MAIL_REQUIRED',
  'COMMENT_PARENT_UNAVAILABLE',
  'COMMENT_DUPLICATE',
  'COMMENT_RATE_LIMITED',
  'COMMENT_CROSS_SITE',
  'COMMENT_UNSUPPORTED_MEDIA',
  'COMMENT_IMAGE_DISABLED',
  'COMMENT_IMAGE_INVALID',
  'COMMENT_IMAGE_TOO_LARGE',
  'COMMENT_NOT_FOUND',
  'COMMENT_NOTIFY_FAILED',
] as const;
export type CommentErrorCode = (typeof COMMENT_ERROR_CODES)[number];

export interface CommentErrorBody {
  statusCode: number;
  message: string;
  code: CommentErrorCode;
  /** Present on COMMENT_RATE_LIMITED. */
  retryAfterSeconds?: number;
}

// ---------------------------------------------------------------------------
// Public payloads
// ---------------------------------------------------------------------------

export interface PublicComment {
  id: number;
  target: CommentTargetKey;
  /** Direct parent; null for a root comment. */
  parentId: number | null;
  /** Root of the thread; null for a root comment. */
  rootId: number | null;
  replyToNick: string | null;
  /** Empty string means anonymous; clients render their own placeholder. */
  nick: string;
  link: string;
  isAdmin: boolean;
  pinned: boolean;
  /** Raw Markdown. Clients must render it with the strict comment schema. */
  content: string;
  likes: number;
  /** ISO 8601. */
  createdAt: string;
  /** Present only when enabled in the comment setting. */
  location?: string;
  browser?: string;
  os?: string;
  /** Soft-deleted root kept as a placeholder for visible replies; content is empty. */
  deleted?: boolean;
  /** Only on root comments: visible replies in chronological order. */
  replies?: PublicComment[];
}

/** Public subset of the comment setting needed to render the form. */
export interface PublicCommentConfig {
  pageSize: number;
  maxLength: number;
  allowVisitorImage: boolean;
  requireMail: boolean;
}

export interface PublicCommentPage {
  items: PublicComment[];
  /** Visible root comments, used for pagination. */
  total: number;
  /** Visible comments including replies, used for the heading counter. */
  count: number;
  page: number;
  pageSize: number;
  sort: CommentSort;
  config: PublicCommentConfig;
  /** True when replies beyond COMMENT_LIMITS.maxRepliesPerPage were omitted. */
  repliesTruncated?: boolean;
}

export type PublicCommentCounts = Record<string, number>;

export interface PublicCommentIdentity {
  admin: boolean;
  nick?: string;
}

export interface PublicCommentLiked {
  ids: number[];
}

export interface CreateCommentBody {
  target: string;
  parentId?: number | null;
  nick?: string;
  mail?: string;
  link?: string;
  content: string;
  /** Honeypot. Real clients always send an empty string or omit it. */
  website?: string;
}

export interface CreateCommentResult {
  comment: PublicComment;
  /** Spam is reported as `pending` so automated posters learn nothing. */
  status: 'approved' | 'pending';
}

export interface CommentLikeResult {
  liked: boolean;
  likes: number;
}

export interface CommentImageResult {
  /** Site-relative URL, e.g. `/static/img/comment/<sha256>.webp`. */
  url: string;
  /** Ready-to-insert Markdown image snippet. */
  markdown: string;
}

// ---------------------------------------------------------------------------
// Admin payloads
// ---------------------------------------------------------------------------

export interface AdminComment {
  id: number;
  target: CommentTargetKey;
  targetTitle: string;
  /** Site-relative URL; empty when the target no longer exists. */
  targetUrl: string;
  targetAvailable: boolean;
  parentId: number | null;
  rootId: number | null;
  replyToNick: string | null;
  /** First characters of the direct parent, for context in the list. */
  parentExcerpt?: string;
  nick: string;
  mail: string;
  link: string;
  content: string;
  status: CommentStatus;
  isAdmin: boolean;
  pinned: boolean;
  likes: number;
  ip: string;
  ua: string;
  location: string;
  browser: string;
  os: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCommentListQuery {
  status?: CommentStatus;
  /** Matches content, nick, mail or IP. */
  search?: string;
  target?: string;
  page: number;
  pageSize: number;
}

export interface AdminCommentList {
  items: AdminComment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminCommentStats {
  pending: number;
  approved: number;
  spam: number;
  deleted: number;
  total: number;
  /** Latest non-deleted comments of any status, newest first. */
  recent: AdminComment[];
}

export interface UpdateCommentBody {
  status?: ModerationStatus;
  /** Only root comments can be pinned. */
  pinned?: boolean;
  content?: string;
}

export interface BatchCommentBody {
  ids: number[];
  action: CommentBatchAction;
}

export interface BatchCommentResult {
  updated: number;
  failed: Array<{ id: number; reason: string }>;
}

export interface AdminReplyBody {
  content: string;
}

// ---------------------------------------------------------------------------
// Setting (stored under setting type `comment`)
// ---------------------------------------------------------------------------

export interface CommentSmtpSetting {
  enabled: boolean;
  host: string;
  port: number;
  /** true for implicit TLS (usually port 465). */
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface CommentNotifySetting {
  /** Receives owner notifications; also used as the RSS author email. */
  ownerEmail: string;
  notifyOwner: boolean;
  notifyReply: boolean;
  /** Empty disables the webhook. Only http(s) URLs are accepted. */
  webhook: string;
  smtp: CommentSmtpSetting;
}

export interface CommentSetting {
  moderation: CommentModerationMode;
  forbiddenWords: string[];
  pageSize: number;
  maxLength: number;
  allowVisitorImage: boolean;
  requireMail: boolean;
  showLocation: boolean;
  showBrowser: boolean;
  showOs: boolean;
  notify: CommentNotifySetting;
}

/** What GET /api/admin/comment/setting returns: the password is never echoed. */
export type AdminCommentSetting = Omit<CommentSetting, 'notify'> & {
  notify: Omit<CommentNotifySetting, 'smtp'> & {
    smtp: Omit<CommentSmtpSetting, 'pass'> & { pass: ''; passSet: boolean };
  };
};

/**
 * PUT body. Every field is optional and merged into the stored value.
 * `notify.smtp.pass`: omitted or '' keeps the stored password, null clears it,
 * any other string replaces it.
 */
export type UpdateCommentSettingBody = Partial<Omit<CommentSetting, 'notify'>> & {
  notify?: Partial<Omit<CommentNotifySetting, 'smtp'>> & {
    smtp?: Partial<Omit<CommentSmtpSetting, 'pass'>> & { pass?: string | null };
  };
};

export const defaultCommentSetting: CommentSetting = {
  moderation: 'suspicious',
  forbiddenWords: [],
  pageSize: COMMENT_LIMITS.pageSizeDefault,
  maxLength: COMMENT_LIMITS.contentDefaultMaxLength,
  allowVisitorImage: true,
  requireMail: false,
  showLocation: true,
  showBrowser: true,
  showOs: true,
  notify: {
    ownerEmail: '',
    notifyOwner: true,
    notifyReply: true,
    webhook: '',
    smtp: {
      enabled: false,
      host: '',
      port: 465,
      secure: true,
      user: '',
      pass: '',
      fromName: '',
      fromEmail: '',
    },
  },
};

// ---------------------------------------------------------------------------
// Server-internal: lifecycle hooks implemented by the notification module
// ---------------------------------------------------------------------------

/** Full stored comment, as persisted in the `comments` collection. */
export interface CommentRecord {
  id: number;
  targetType: CommentTargetType;
  targetId: string;
  parentId: number | null;
  rootId: number | null;
  replyToNick: string | null;
  nick: string;
  mail: string;
  link: string;
  content: string;
  status: CommentStatus;
  isAdmin: boolean;
  pinned: boolean;
  likes: number;
  ip: string;
  ua: string;
  location: string;
  browser: string;
  os: string;
  /** File names under COMMENT_IMAGE_DIR referenced by the content. */
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentHookContext {
  target: ResolvedCommentTarget;
  /** Direct parent, when the comment is a reply. */
  parent?: CommentRecord | null;
}

/**
 * The core comment provider calls these after the write has been committed.
 * Implementations must never throw into the caller and must not block the
 * HTTP response on network I/O (fire and forget with their own logging).
 */
export interface CommentLifecycleHooks {
  /** A visitor or the admin created a comment (any initial status). */
  afterCreate(comment: CommentRecord, context: CommentHookContext): void | Promise<void>;
  /** A comment changed from pending or spam to approved. */
  afterApprove(comment: CommentRecord, context: CommentHookContext): void | Promise<void>;
}

/** Nest injection token for CommentLifecycleHooks. */
export const COMMENT_LIFECYCLE_HOOKS = 'COMMENT_LIFECYCLE_HOOKS';
