/**
 * Admin-side helpers for the native comment system.
 *
 * The shapes below mirror the binding contract in
 * packages/server/src/types/comment.dto.ts and the validation rules in
 * packages/server/src/utils/commentSetting.ts. Keep them in sync.
 */

export const COMMENT_STATUSES = ['approved', 'pending', 'spam', 'deleted'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
export type ModerationStatus = Exclude<CommentStatus, 'deleted'>;
export type CommentStatusFilter = 'all' | CommentStatus;
export type CommentModerationMode = 'all' | 'suspicious' | 'off';
export type CommentBatchAction = 'approve' | 'spam' | 'pending' | 'delete' | 'purge';

export interface AdminComment {
  id: number;
  target: string;
  targetTitle: string;
  targetUrl: string;
  targetAvailable: boolean;
  parentId: number | null;
  rootId: number | null;
  replyToNick: string | null;
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

export interface AdminCommentStats {
  pending: number;
  approved: number;
  spam: number;
  deleted: number;
  total: number;
  recent: AdminComment[];
}

export interface BatchCommentResult {
  updated: number;
  failed: Array<{ id: number; reason: string }>;
}

export interface AdminCommentSmtpSetting {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: '';
  passSet: boolean;
  fromName: string;
  fromEmail: string;
}

export interface AdminCommentSetting {
  moderation: CommentModerationMode;
  forbiddenWords: string[];
  pageSize: number;
  maxLength: number;
  allowVisitorImage: boolean;
  requireMail: boolean;
  showLocation: boolean;
  showBrowser: boolean;
  showOs: boolean;
  notify: {
    ownerEmail: string;
    notifyOwner: boolean;
    notifyReply: boolean;
    webhook: string;
    smtp: AdminCommentSmtpSetting;
  };
}

export const COMMENT_LIMITS = {
  pageSizeDefault: 10,
  pageSizeMin: 5,
  pageSizeMax: 50,
  contentDefaultMaxLength: 5_000,
  contentMinMaxLength: 50,
  contentHardMaxLength: 20_000,
  adminPageSizeDefault: 20,
  adminPageSizeMax: 100,
  adminSearchMaxLength: 100,
  batchMaxIds: 200,
  forbiddenWordsMax: 500,
  forbiddenWordMaxLength: 64,
  mailMaxLength: 128,
  smtpHostMaxLength: 253,
  smtpUserMaxLength: 254,
  smtpPassMaxLength: 512,
  smtpFromNameMaxLength: 64,
  webhookMaxLength: 500,
} as const;

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

export const COMMENT_STATUS_META: Record<CommentStatus, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'processing' },
  approved: { text: '已通过', color: 'success' },
  spam: { text: '垃圾', color: 'error' },
  deleted: { text: '已删除', color: 'default' },
};

export const COMMENT_STATUS_TABS: Array<{ key: CommentStatusFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'spam', label: '垃圾' },
  { key: 'deleted', label: '已删除' },
];

export const COMMENT_STATUS_FILTERS = COMMENT_STATUS_TABS.map((item) => item.key);

export function isCommentStatus(value: unknown): value is CommentStatus {
  return typeof value === 'string' && (COMMENT_STATUSES as readonly string[]).includes(value);
}

export function normalizeCommentStatusFilter(value: unknown): CommentStatusFilter {
  return isCommentStatus(value) ? value : 'all';
}

export function getCommentStatusMeta(status: unknown) {
  return isCommentStatus(status)
    ? COMMENT_STATUS_META[status]
    : { text: String(status || '未知'), color: 'default' };
}

const toCount = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

/** Count shown on a status tab; undefined while stats are unavailable. */
export function getCommentStatusCount(
  stats: Partial<AdminCommentStats> | null | undefined,
  filter: CommentStatusFilter,
): number | undefined {
  if (!stats) return undefined;
  if (filter === 'all') return toCount(stats.total);
  return toCount(stats[filter]);
}

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

export interface CommentListQueryInput {
  current?: number;
  pageSize?: number;
  status?: CommentStatusFilter | string;
  search?: string;
  target?: string;
}

/** Builds the GET /api/admin/comment query; empty filters are omitted. */
export function buildCommentListParams(input: CommentListQueryInput) {
  const page = Math.max(1, Math.floor(Number(input.current) || 1));
  const rawPageSize = Math.floor(Number(input.pageSize) || COMMENT_LIMITS.adminPageSizeDefault);
  const pageSize = Math.min(Math.max(rawPageSize, 1), COMMENT_LIMITS.adminPageSizeMax);
  const params: Record<string, string | number> = { page, pageSize };
  if (isCommentStatus(input.status)) params.status = input.status;
  const search =
    typeof input.search === 'string'
      ? input.search.trim().slice(0, COMMENT_LIMITS.adminSearchMaxLength)
      : '';
  if (search) params.search = search;
  const target = typeof input.target === 'string' ? input.target.trim() : '';
  if (target) params.target = target;
  return params;
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

export type CommentRowAction =
  | 'approve'
  | 'spam'
  | 'pending'
  | 'pin'
  | 'unpin'
  | 'edit'
  | 'reply'
  | 'delete'
  | 'restore'
  | 'purge';

export const isRootComment = (comment: Pick<AdminComment, 'parentId'>) =>
  comment.parentId === null || comment.parentId === undefined;

/** Actions offered for one row, in display order. */
export function getCommentRowActions(
  comment: Pick<AdminComment, 'status' | 'parentId' | 'pinned'>,
): CommentRowAction[] {
  if (comment.status === 'deleted') return ['restore', 'purge'];
  const actions: CommentRowAction[] = [];
  if (comment.status !== 'approved') actions.push('approve');
  if (comment.status !== 'spam') actions.push('spam');
  if (comment.status !== 'pending') actions.push('pending');
  if (isRootComment(comment)) actions.push(comment.pinned ? 'unpin' : 'pin');
  actions.push('edit');
  if (comment.status !== 'spam') actions.push('reply');
  actions.push('delete', 'purge');
  return actions;
}

/** Status a row action moves the comment to, when it is a status change. */
export function getActionTargetStatus(action: CommentRowAction): ModerationStatus | undefined {
  switch (action) {
    case 'approve':
      return 'approved';
    case 'spam':
      return 'spam';
    case 'pending':
    case 'restore':
      // Restored comments go back to review instead of being published blindly.
      return 'pending';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Untrusted visitor data
// ---------------------------------------------------------------------------

/** Returns the visitor link only when it is an absolute http(s) URL. */
export function getSafeExternalLink(link: unknown): string {
  if (typeof link !== 'string') return '';
  const value = link.trim();
  if (!value || /[\u0000-\u001f\u007f\s]/.test(value)) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

/** Accepts only site-relative paths such as `/post/hello`. */
export function getSafeSitePath(path: unknown): string {
  if (typeof path !== 'string') return '';
  const value = path.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '';
  if (/[\\\u0000-\u001f\u007f\s]/.test(value)) return '';
  return value;
}

/** Link to the comment on the public site, or '' when the target is gone. */
export function getCommentPublicHref(
  comment: Pick<AdminComment, 'id' | 'targetUrl' | 'targetAvailable'>,
): string {
  if (!comment.targetAvailable) return '';
  const path = getSafeSitePath(comment.targetUrl);
  if (!path) return '';
  const base = path.split('#')[0];
  return `${base}#comment-${Number(comment.id)}`;
}

export function getCommentExcerpt(content: unknown, maxLength = 80): string {
  if (typeof content !== 'string') return '';
  const compact = content.replace(/\s+/g, ' ').trim();
  const chars = Array.from(compact);
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join('')}…` : compact;
}

export function getCommentNick(comment: Pick<AdminComment, 'nick'>): string {
  return comment.nick?.trim() || '匿名';
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const COMMENT_ERROR_MESSAGES: Record<string, string> = {
  COMMENT_DISABLED: '评论功能已关闭',
  COMMENT_TARGET_UNAVAILABLE: '评论所在的页面不可用',
  COMMENT_INVALID_INPUT: '输入内容不合法',
  COMMENT_CONTENT_TOO_LONG: '内容超出字数上限',
  COMMENT_MAIL_REQUIRED: '需要填写邮箱',
  COMMENT_PARENT_UNAVAILABLE: '被回复的评论不可用',
  COMMENT_DUPLICATE: '请勿重复提交',
  COMMENT_RATE_LIMITED: '操作过于频繁，请稍后再试',
  COMMENT_CROSS_SITE: '跨站请求被拒绝',
  COMMENT_UNSUPPORTED_MEDIA: '不支持的请求格式',
  COMMENT_IMAGE_DISABLED: '图片上传已关闭',
  COMMENT_IMAGE_INVALID: '图片格式不支持',
  COMMENT_IMAGE_TOO_LARGE: '图片过大',
  COMMENT_NOT_FOUND: '评论不存在或已被彻底删除',
  COMMENT_NOTIFY_FAILED: '通知发送失败',
};

export const COMMENT_SETTING_FIELD_LABELS: Record<string, string> = {
  body: '设置内容',
  moderation: '审核策略',
  forbiddenWords: '违禁词',
  pageSize: '每页条数',
  maxLength: '字数上限',
  allowVisitorImage: '访客图片上传',
  requireMail: '邮箱必填',
  showLocation: '显示归属地',
  showBrowser: '显示浏览器',
  showOs: '显示操作系统',
  notify: '通知设置',
  'notify.ownerEmail': '博主邮箱',
  'notify.notifyOwner': '新评论通知博主',
  'notify.notifyReply': '回复通知被回复者',
  'notify.webhook': 'Webhook 地址',
  'notify.smtp': 'SMTP 设置',
  'notify.smtp.enabled': '启用 SMTP',
  'notify.smtp.host': 'SMTP 主机',
  'notify.smtp.port': 'SMTP 端口',
  'notify.smtp.secure': 'SSL/TLS',
  'notify.smtp.user': 'SMTP 用户名',
  'notify.smtp.pass': 'SMTP 密码',
  'notify.smtp.fromName': '发件人名称',
  'notify.smtp.fromEmail': '发件人邮箱',
  to: '收件地址',
};

export class CommentApiError extends Error {
  code?: string;
  field?: string;
  statusCode?: number;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    details: { code?: string; field?: string; statusCode?: number; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = 'CommentApiError';
    this.code = details.code;
    this.field = details.field;
    this.statusCode = details.statusCode;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Returns null for a successful envelope, otherwise the error it carries. */
export function getCommentResponseError(response: unknown): CommentApiError | null {
  if (isRecord(response) && Number(response.statusCode) === 200) return null;
  if (!isRecord(response)) {
    return new CommentApiError('服务器返回了无法识别的响应', {});
  }
  const rawMessage = Array.isArray(response.message)
    ? response.message.join('; ')
    : typeof response.message === 'string'
      ? response.message
      : '';
  return new CommentApiError(rawMessage, {
    code: typeof response.code === 'string' ? response.code : undefined,
    field: typeof response.field === 'string' ? response.field : undefined,
    statusCode: Number(response.statusCode) || undefined,
    retryAfterSeconds:
      typeof response.retryAfterSeconds === 'number' ? response.retryAfterSeconds : undefined,
  });
}

/** Extracts `data` from a `{ statusCode: 200, data }` envelope or throws. */
export function unwrapCommentResponse<T = any>(response: unknown): T {
  const error = getCommentResponseError(response);
  if (error) throw error;
  return (response as { data: T }).data;
}

/** Localized, human readable description of a failed comment request. */
export function formatCommentError(error: unknown, fallback = '操作失败'): string {
  if (!(error instanceof CommentApiError)) {
    return error instanceof Error && error.message ? `${fallback}：${error.message}` : fallback;
  }
  const parts: string[] = [];
  if (error.code && COMMENT_ERROR_MESSAGES[error.code]) {
    parts.push(COMMENT_ERROR_MESSAGES[error.code]);
  } else if (error.statusCode === 401) {
    parts.push('登录已失效');
  } else if (error.statusCode === 403) {
    parts.push('权限不足');
  } else if (error.statusCode === 404) {
    parts.push('接口不存在或评论已不存在');
  } else {
    parts.push(fallback);
  }
  if (error.field) {
    parts[0] += `（${COMMENT_SETTING_FIELD_LABELS[error.field] || error.field}）`;
  }
  if (error.retryAfterSeconds) {
    parts.push(`请 ${error.retryAfterSeconds} 秒后重试`);
  }
  const detail = error.message && error.message !== 'Forbidden resource' ? error.message : '';
  if (detail) parts.push(detail);
  return parts.join('：');
}

/** Turns the failed entries of a batch result into displayable lines. */
export function describeBatchFailures(result: Partial<BatchCommentResult> | null | undefined) {
  const failed = Array.isArray(result?.failed) ? result!.failed : [];
  return failed.map((item) => ({
    id: item.id,
    reason: COMMENT_ERROR_MESSAGES[item.reason] || item.reason || '未知原因',
  }));
}

// ---------------------------------------------------------------------------
// Settings form
// ---------------------------------------------------------------------------

export const COMMENT_MODERATION_OPTIONS: Array<{ label: string; value: CommentModerationMode }> = [
  { label: '全部先审', value: 'all' },
  { label: '只审可疑', value: 'suspicious' },
  { label: '不审', value: 'off' },
];

export interface CommentGeneralFormValues {
  moderation: CommentModerationMode;
  forbiddenWords: string;
  pageSize: number;
  maxLength: number;
  allowVisitorImage: boolean;
  requireMail: boolean;
  showLocation: boolean;
  showBrowser: boolean;
  showOs: boolean;
}

export interface CommentNotifyFormValues {
  ownerEmail: string;
  notifyOwner: boolean;
  notifyReply: boolean;
  webhook: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  /** Always starts empty: the stored password is never sent to the browser. */
  smtpPass: string;
  smtpFromName: string;
  smtpFromEmail: string;
}

export function commentSettingToGeneralValues(
  setting: Partial<AdminCommentSetting> | null | undefined,
): CommentGeneralFormValues {
  const value = setting || {};
  return {
    moderation: value.moderation || 'suspicious',
    forbiddenWords: Array.isArray(value.forbiddenWords) ? value.forbiddenWords.join('\n') : '',
    pageSize: value.pageSize ?? COMMENT_LIMITS.pageSizeDefault,
    maxLength: value.maxLength ?? COMMENT_LIMITS.contentDefaultMaxLength,
    allowVisitorImage: value.allowVisitorImage ?? true,
    requireMail: value.requireMail ?? false,
    showLocation: value.showLocation ?? true,
    showBrowser: value.showBrowser ?? true,
    showOs: value.showOs ?? true,
  };
}

export function commentSettingToNotifyValues(
  setting: Partial<AdminCommentSetting> | null | undefined,
): CommentNotifyFormValues {
  const notify: Partial<AdminCommentSetting['notify']> = setting?.notify || {};
  const smtp: Partial<AdminCommentSmtpSetting> = notify.smtp || {};
  return {
    ownerEmail: notify.ownerEmail || '',
    notifyOwner: notify.notifyOwner ?? true,
    notifyReply: notify.notifyReply ?? true,
    webhook: notify.webhook || '',
    smtpEnabled: smtp.enabled ?? false,
    smtpHost: smtp.host || '',
    smtpPort: smtp.port ?? 465,
    smtpSecure: smtp.secure ?? true,
    smtpUser: smtp.user || '',
    smtpPass: '',
    smtpFromName: smtp.fromName || '',
    smtpFromEmail: smtp.fromEmail || '',
  };
}

export function isSmtpPasswordSet(setting: Partial<AdminCommentSetting> | null | undefined) {
  return Boolean(setting?.notify?.smtp?.passSet);
}

/** Splits the textarea input into trimmed, de-duplicated, non-empty words. */
export function parseForbiddenWordsInput(input: unknown): string[] {
  if (typeof input !== 'string') return [];
  const seen = new Set<string>();
  const words: string[] = [];
  for (const raw of input.split(/[\n,\uFF0C]/)) {
    const word = raw.trim();
    if (!word) continue;
    const key = word.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}

/**
 * Write-only SMTP password semantics of the PUT body:
 * undefined keeps the stored value, null clears it, a string replaces it.
 */
export function resolveSmtpPassUpdate(options: {
  typed: unknown;
  clear: boolean;
}): string | null | undefined {
  if (options.clear) return null;
  if (typeof options.typed === 'string' && options.typed !== '') return options.typed;
  return undefined;
}

const toInteger = (value: unknown) =>
  typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;

const trimText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Drops keys whose form value is missing so the PUT merge keeps them. */
function pickDefined<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  mapping: { [K in keyof T]: [string, (value: unknown) => T[K]] },
): Partial<T> {
  const result: Partial<T> = {};
  (Object.keys(mapping) as Array<keyof T>).forEach((key) => {
    const [formKey, convert] = mapping[key];
    if (source[formKey] !== undefined) result[key] = convert(source[formKey]);
  });
  return result;
}

export function buildGeneralSettingBody(values: Partial<CommentGeneralFormValues>) {
  return pickDefined(values as Record<string, unknown>, {
    moderation: ['moderation', (value) => value as CommentModerationMode],
    forbiddenWords: ['forbiddenWords', parseForbiddenWordsInput],
    pageSize: ['pageSize', toInteger],
    maxLength: ['maxLength', toInteger],
    allowVisitorImage: ['allowVisitorImage', Boolean],
    requireMail: ['requireMail', Boolean],
    showLocation: ['showLocation', Boolean],
    showBrowser: ['showBrowser', Boolean],
    showOs: ['showOs', Boolean],
  });
}

export function buildNotifySettingBody(
  values: Partial<CommentNotifyFormValues>,
  options: { clearPassword: boolean },
) {
  const source = values as Record<string, unknown>;
  const smtp: Record<string, unknown> = pickDefined(source, {
    enabled: ['smtpEnabled', Boolean],
    host: ['smtpHost', trimText],
    port: ['smtpPort', toInteger],
    secure: ['smtpSecure', Boolean],
    user: ['smtpUser', trimText],
    fromName: ['smtpFromName', trimText],
    fromEmail: ['smtpFromEmail', trimText],
  });
  const pass = resolveSmtpPassUpdate({ typed: values.smtpPass, clear: options.clearPassword });
  if (pass !== undefined) smtp.pass = pass;
  return {
    notify: {
      ...pickDefined(source, {
        ownerEmail: ['ownerEmail', trimText],
        notifyOwner: ['notifyOwner', Boolean],
        notifyReply: ['notifyReply', Boolean],
        webhook: ['webhook', trimText],
      }),
      smtp,
    },
  };
}

// Validators mirror packages/server/src/utils/commentSetting.ts. Each returns
// an error message, or '' when the value is acceptable.

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
const HOSTNAME_PATTERN = /^[A-Za-z0-9.-]+$|^\[[0-9A-Fa-f:.]+\]$/;

export function isValidCommentEmail(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.length <= COMMENT_LIMITS.mailMaxLength &&
    !CONTROL_CHARACTERS.test(value) &&
    EMAIL_PATTERN.test(value)
  );
}

function validateIntegerRange(value: unknown, min: number, max: number): string {
  const number = toInteger(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    return `请输入 ${min} 到 ${max} 之间的整数`;
  }
  return '';
}

export const validatePageSize = (value: unknown) =>
  validateIntegerRange(value, COMMENT_LIMITS.pageSizeMin, COMMENT_LIMITS.pageSizeMax);

export const validateMaxLength = (value: unknown) =>
  validateIntegerRange(
    value,
    COMMENT_LIMITS.contentMinMaxLength,
    COMMENT_LIMITS.contentHardMaxLength,
  );

export const validateSmtpPort = (value: unknown) => validateIntegerRange(value, 1, 65_535);

export function validateForbiddenWords(value: unknown): string {
  if (value !== undefined && value !== null && typeof value !== 'string') return '格式不正确';
  for (const word of parseForbiddenWordsInput(value)) {
    if (word.length > COMMENT_LIMITS.forbiddenWordMaxLength) {
      return `单个违禁词不能超过 ${COMMENT_LIMITS.forbiddenWordMaxLength} 个字符`;
    }
    if (CONTROL_CHARACTERS.test(word)) return '违禁词不能包含控制字符';
  }
  if (parseForbiddenWordsInput(value).length > COMMENT_LIMITS.forbiddenWordsMax) {
    return `违禁词最多 ${COMMENT_LIMITS.forbiddenWordsMax} 个`;
  }
  return '';
}

export function validateEmailOrEmpty(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return isValidCommentEmail(text) ? '' : '邮箱格式不正确';
}

export function validateWebhook(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (text.length > COMMENT_LIMITS.webhookMaxLength) {
    return `不能超过 ${COMMENT_LIMITS.webhookMaxLength} 个字符`;
  }
  if (CONTROL_CHARACTERS.test(text) || /\s/.test(text)) return '地址不能包含空白或控制字符';
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '只支持 http 或 https 地址';
    if (url.username || url.password) return '地址中不能包含用户名或密码';
  } catch {
    return '请输入完整的 http(s) 地址';
  }
  return '';
}

export function validateSmtpHost(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (text.length > COMMENT_LIMITS.smtpHostMaxLength) {
    return `不能超过 ${COMMENT_LIMITS.smtpHostMaxLength} 个字符`;
  }
  return HOSTNAME_PATTERN.test(text) ? '' : '请输入主机名或 IP，不要带协议和端口';
}

export function validateSmtpUser(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > COMMENT_LIMITS.smtpUserMaxLength) {
    return `不能超过 ${COMMENT_LIMITS.smtpUserMaxLength} 个字符`;
  }
  return CONTROL_CHARACTERS.test(text) ? '不能包含控制字符' : '';
}

export function validateSmtpPass(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  if (value.length > COMMENT_LIMITS.smtpPassMaxLength) {
    return `不能超过 ${COMMENT_LIMITS.smtpPassMaxLength} 个字符`;
  }
  return CONTROL_CHARACTERS.test(value) ? '不能包含控制字符' : '';
}

export function validateFromName(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > COMMENT_LIMITS.smtpFromNameMaxLength) {
    return `不能超过 ${COMMENT_LIMITS.smtpFromNameMaxLength} 个字符`;
  }
  if (CONTROL_CHARACTERS.test(text)) return '不能包含控制字符';
  return /[<>"]/.test(text) ? '不能包含 <、> 或 "' : '';
}

/** Cross-field rules the server applies when SMTP is enabled. */
export function validateSmtpRequirements(values: Partial<CommentNotifyFormValues>) {
  const errors: Partial<Record<keyof CommentNotifyFormValues, string>> = {};
  if (!values.smtpEnabled) return errors;
  if (!(values.smtpHost || '').trim()) errors.smtpHost = '启用 SMTP 时必须填写主机';
  if (
    !(values.smtpFromEmail || '').trim() &&
    !isValidCommentEmail((values.smtpUser || '').trim())
  ) {
    errors.smtpFromEmail = '用户名不是邮箱时必须填写发件人邮箱';
  }
  return errors;
}
