/**
 * Browser client for the native comment API.
 *
 * The types below mirror `packages/server/src/types/comment.dto.ts`, which is
 * the binding contract. They are copied rather than imported so the website
 * bundle never depends on server code. Keep both sides in sync.
 *
 * Every request is relative to the current origin and sends cookies only to
 * that origin: the server identifies the blog owner and the anonymous like
 * actor from same-origin cookies.
 */

export const COMMENT_API_BASE = '/api/public/comment';

export const COMMENT_LIMITS = {
  nickMaxLength: 32,
  mailMaxLength: 128,
  linkMaxLength: 200,
  contentDefaultMaxLength: 5_000,
  contentHardMaxLength: 20_000,
  pageSizeDefault: 10,
  countMaxTargets: 50,
  likedMaxIds: 600,
  imageMaxBytes: 5 * 1024 * 1024,
} as const;

export const COMMENT_SORTS = ['latest', 'oldest', 'hot'] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];

export const COMMENT_PAGE_TARGETS = ['link', 'about'] as const;
export type CommentPageTarget = (typeof COMMENT_PAGE_TARGETS)[number];
export type CommentTargetKey = `post:${number}` | `page:${CommentPageTarget}`;

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

export interface PublicComment {
  id: number;
  target: CommentTargetKey;
  parentId: number | null;
  rootId: number | null;
  replyToNick: string | null;
  nick: string;
  link: string;
  isAdmin: boolean;
  pinned: boolean;
  content: string;
  likes: number;
  createdAt: string;
  location?: string;
  browser?: string;
  os?: string;
  deleted?: boolean;
  replies?: PublicComment[];
}

export interface PublicCommentConfig {
  pageSize: number;
  maxLength: number;
  allowVisitorImage: boolean;
  requireMail: boolean;
}

export interface PublicCommentPage {
  items: PublicComment[];
  total: number;
  count: number;
  page: number;
  pageSize: number;
  sort: CommentSort;
  config: PublicCommentConfig;
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
  website?: string;
}

export interface CreateCommentResult {
  comment: PublicComment;
  status: 'approved' | 'pending';
}

export interface CommentLikeResult {
  liked: boolean;
  likes: number;
}

export interface CommentImageResult {
  url: string;
  markdown: string;
}

export const DEFAULT_COMMENT_CONFIG: PublicCommentConfig = {
  pageSize: COMMENT_LIMITS.pageSizeDefault,
  maxLength: COMMENT_LIMITS.contentDefaultMaxLength,
  allowVisitorImage: false,
  requireMail: false,
};

/** Image types the server accepts; everything else is rejected before upload. */
export const COMMENT_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export const buildPostCommentTarget = (articleId: number | string): CommentTargetKey | null => {
  const id = Number(articleId);
  return Number.isSafeInteger(id) && id > 0 ? (`post:${id}` as CommentTargetKey) : null;
};

export const isCommentTargetKey = (value: unknown): value is CommentTargetKey => {
  if (typeof value !== 'string') {
    return false;
  }
  if (/^post:[1-9]\d{0,15}$/.test(value)) {
    return true;
  }
  return (COMMENT_PAGE_TARGETS as readonly string[]).some((page) => value === `page:${page}`);
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const COMMENT_ERROR_MESSAGES: Record<CommentErrorCode, string> = {
  COMMENT_DISABLED: '评论功能已关闭',
  COMMENT_TARGET_UNAVAILABLE: '当前页面暂不开放评论',
  COMMENT_INVALID_INPUT: '提交的内容不符合要求，请检查后重试',
  COMMENT_CONTENT_TOO_LONG: '评论内容超出字数限制',
  COMMENT_MAIL_REQUIRED: '请填写邮箱',
  COMMENT_PARENT_UNAVAILABLE: '要回复的评论不存在或已被删除',
  COMMENT_DUPLICATE: '请勿重复提交相同的评论',
  COMMENT_RATE_LIMITED: '操作太频繁，请稍后再试',
  COMMENT_CROSS_SITE: '请求来源校验失败，请刷新页面后重试',
  COMMENT_UNSUPPORTED_MEDIA: '请求格式不受支持，请刷新页面后重试',
  COMMENT_IMAGE_DISABLED: '本站未开放评论图片上传',
  COMMENT_IMAGE_INVALID: '仅支持 PNG、JPEG、WebP、GIF 格式的图片',
  COMMENT_IMAGE_TOO_LARGE: '图片不能超过 5 MB',
  COMMENT_NOT_FOUND: '评论不存在或已被删除',
  COMMENT_NOTIFY_FAILED: '通知发送失败',
};

export const NETWORK_ERROR_MESSAGE = '网络异常，请检查网络后重试';

/** Human readable wait time in seconds, minutes or hours, localized for the UI. */
export const formatRetryAfter = (seconds: number) => {
  const value = Math.max(1, Math.ceil(seconds));
  if (value < 60) {
    return `${value} 秒`;
  }
  if (value < 3600) {
    return `${Math.ceil(value / 60)} 分钟`;
  }
  return `${Math.ceil(value / 3600)} 小时`;
};

const isCommentErrorCode = (value: unknown): value is CommentErrorCode =>
  typeof value === 'string' && (COMMENT_ERROR_CODES as readonly string[]).includes(value);

const fallbackMessageForStatus = (status: number) => {
  if (status === 0) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (status === 404) {
    return '评论区暂不可用';
  }
  if (status === 403) {
    return '没有权限执行此操作';
  }
  if (status === 409) {
    return COMMENT_ERROR_MESSAGES.COMMENT_DUPLICATE;
  }
  if (status === 413) {
    return COMMENT_ERROR_MESSAGES.COMMENT_IMAGE_TOO_LARGE;
  }
  if (status === 415) {
    return COMMENT_ERROR_MESSAGES.COMMENT_UNSUPPORTED_MEDIA;
  }
  if (status === 429) {
    return COMMENT_ERROR_MESSAGES.COMMENT_RATE_LIMITED;
  }
  if (status >= 500) {
    return '服务器开小差了，请稍后再试';
  }
  return `请求失败（${status}）`;
};

export const getCommentErrorMessage = (
  code: CommentErrorCode | null,
  status: number,
  retryAfterSeconds?: number,
) => {
  const rateLimited = code === 'COMMENT_RATE_LIMITED' || (!code && status === 429);
  if (rateLimited) {
    return retryAfterSeconds && retryAfterSeconds > 0
      ? `操作太频繁，请 ${formatRetryAfter(retryAfterSeconds)}后再试`
      : COMMENT_ERROR_MESSAGES.COMMENT_RATE_LIMITED;
  }
  if (code) {
    return COMMENT_ERROR_MESSAGES[code];
  }
  return fallbackMessageForStatus(status);
};

export class CommentApiError extends Error {
  readonly code: CommentErrorCode | null;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(code: CommentErrorCode | null, status: number, retryAfterSeconds?: number) {
    super(getCommentErrorMessage(code, status, retryAfterSeconds));
    this.name = 'CommentApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Localized message for anything thrown by this module (or by fetch itself). */
export const describeCommentError = (error: unknown) => {
  if (error instanceof CommentApiError) {
    return error.message;
  }
  return NETWORK_ERROR_MESSAGE;
};

export const isAbortError = (error: unknown) =>
  Boolean(error) && typeof error === 'object' && (error as { name?: string }).name === 'AbortError';

/** The list endpoint answers 403/404 when comments are off for this page. */
export const isCommentUnavailableError = (error: unknown) =>
  error instanceof CommentApiError &&
  (error.code === 'COMMENT_DISABLED' ||
    error.code === 'COMMENT_TARGET_UNAVAILABLE' ||
    (!error.code && error.status === 404));

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

type Envelope<T> = {
  statusCode?: number;
  data?: T;
  code?: unknown;
  message?: unknown;
  retryAfterSeconds?: unknown;
};

const parseRetryAfterHeader = (response: Response) => {
  const raw = response.headers?.get?.('Retry-After');
  if (!raw) {
    return undefined;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }
  const date = Date.parse(raw);
  if (Number.isFinite(date)) {
    const diff = Math.ceil((date - Date.now()) / 1000);
    return diff > 0 ? diff : undefined;
  }
  return undefined;
};

const readEnvelope = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T> | undefined;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    // Proxies may answer with an empty or HTML body; the status still applies.
  }

  const bodyStatus = typeof body?.statusCode === 'number' ? body.statusCode : undefined;
  const status = !response.ok ? response.status : bodyStatus && bodyStatus >= 400 ? bodyStatus : 0;
  if (!response.ok || status >= 400) {
    const code = isCommentErrorCode(body?.code) ? body.code : null;
    const retryFromBody = Number(body?.retryAfterSeconds);
    const retryAfterSeconds =
      Number.isFinite(retryFromBody) && retryFromBody > 0
        ? retryFromBody
        : parseRetryAfterHeader(response);
    throw new CommentApiError(code, status || response.status, retryAfterSeconds);
  }

  if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'data')) {
    return body.data as T;
  }
  return body as T;
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${COMMENT_API_BASE}${path}`, {
      credentials: 'same-origin',
      ...init,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new CommentApiError(null, 0);
  }
  return readEnvelope<T>(response);
};

const jsonInit = (method: 'POST', body: unknown, signal?: AbortSignal): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(body),
  signal,
});

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const fetchComments = (
  target: CommentTargetKey,
  options: { page?: number; sort?: CommentSort; signal?: AbortSignal } = {},
) => {
  const params = new URLSearchParams({
    target,
    page: String(Math.max(1, Math.floor(options.page || 1))),
    sort: options.sort || 'latest',
  });
  return request<PublicCommentPage>(`?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });
};

export const fetchCommentCounts = async (
  targets: CommentTargetKey[],
  signal?: AbortSignal,
): Promise<PublicCommentCounts> => {
  const unique = Array.from(new Set(targets.filter(isCommentTargetKey))).slice(
    0,
    COMMENT_LIMITS.countMaxTargets,
  );
  if (!unique.length) {
    return {};
  }
  const params = new URLSearchParams({ targets: unique.join(',') });
  return request<PublicCommentCounts>(`/count?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
};

export const fetchCommentIdentity = (signal?: AbortSignal) =>
  request<PublicCommentIdentity>('/identity', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });

export const fetchLikedCommentIds = async (ids: number[], signal?: AbortSignal) => {
  const unique = Array.from(new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))).slice(
    0,
    COMMENT_LIMITS.likedMaxIds,
  );
  if (!unique.length) {
    return [] as number[];
  }
  const params = new URLSearchParams({ ids: unique.join(',') });
  const result = await request<PublicCommentLiked>(`/liked?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  return Array.isArray(result?.ids) ? result.ids.filter((id) => typeof id === 'number') : [];
};

export const createComment = (body: CreateCommentBody, signal?: AbortSignal) =>
  request<CreateCommentResult>('', jsonInit('POST', body, signal));

export const toggleCommentLike = (id: number, signal?: AbortSignal) =>
  request<CommentLikeResult>(
    `/${encodeURIComponent(String(id))}/like`,
    jsonInit('POST', {}, signal),
  );

export const uploadCommentImage = async (
  file: File,
  target: CommentTargetKey,
  signal?: AbortSignal,
) => {
  const form = new FormData();
  form.append('target', target);
  form.append('file', file, file.name || 'image');
  // No explicit Content-Type: the browser adds the multipart boundary.
  const result = await request<CommentImageResult>('/image', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
    signal,
  });
  if (!result || typeof result.markdown !== 'string' || !result.markdown) {
    throw new CommentApiError('COMMENT_IMAGE_INVALID', 500);
  }
  return result;
};
