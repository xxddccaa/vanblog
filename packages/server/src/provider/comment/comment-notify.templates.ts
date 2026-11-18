import type { CommentRecord, CommentStatus, ResolvedCommentTarget } from 'src/types/comment.dto';
import { COMMENT_NOTIFY_LIMITS } from 'src/types/comment.dto';

/** Fallback display name used when the site has no name configured. */
export const DEFAULT_SITE_NAME = 'VanBlog';

/** Admin route of the comment moderation page, below the admin base path. */
export const ADMIN_COMMENT_PATH = '/admin/site/comment';

const SUBJECT_PART_MAX_LENGTH = 120;
const NICK_MAX_LENGTH = 64;

/** Everything a notification template needs to know about the site. */
export interface CommentNotifySite {
  name: string;
  /** Normalized absolute base URL without a trailing slash, or ''. */
  baseUrl: string;
}

export interface CommentMailContent {
  subject: string;
  text: string;
  html: string;
}

export type CommentWebhookEvent = 'comment.created' | 'comment.approved';

/**
 * JSON body POSTed to the configured webhook and handed to pipeline scripts.
 * It deliberately carries no email address, IP address or user agent.
 */
export interface CommentWebhookPayload {
  event: CommentWebhookEvent;
  site: { name: string; url: string };
  target: { key: string; type: string; id: string; title: string; url: string };
  comment: {
    id: number;
    parentId: number | null;
    rootId: number | null;
    nick: string;
    link: string;
    isAdmin: boolean;
    status: CommentStatus;
    excerpt: string;
    createdAt: string;
  };
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/gu, (character) => HTML_ESCAPES[character]);
}

/** Single-line text safe for headers and short labels. */
export function cleanLine(value: unknown, maxLength = SUBJECT_PART_MAX_LENGTH): string {
  const characters = Array.from(
    String(value ?? '')
      .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim(),
  );
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('')}…`
    : characters.join('');
}

/** Multi-line excerpt of raw Markdown, measured in code points. */
export function buildExcerpt(
  content: unknown,
  maxLength: number = COMMENT_NOTIFY_LIMITS.excerptLength,
): string {
  const normalized = String(content ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  const characters = Array.from(normalized);
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('').trimEnd()}…`
    : normalized;
}

/**
 * Accepts only absolute http(s) URLs without credentials. The path is kept so
 * sub-path deployments work; query, hash and trailing slashes are dropped.
 */
export function normalizeBaseUrl(value: unknown): string {
  try {
    const url = new URL(String(value ?? '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (url.username || url.password) return '';
    return `${url.origin}${url.pathname.replace(/\/+$/u, '')}`;
  } catch {
    return '';
  }
}

/** Joins the base URL and a site-relative path; '' when either is unusable. */
export function absoluteUrl(baseUrl: string, relativePath: string, hash = ''): string {
  if (!baseUrl) return '';
  const pathPart = String(relativePath ?? '');
  if (!pathPart.startsWith('/') || pathPart.startsWith('//')) return '';
  try {
    const url = new URL(`${baseUrl}${pathPart}${hash}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function commentAnchorUrl(
  site: CommentNotifySite,
  target: ResolvedCommentTarget,
  comment: CommentRecord,
): string {
  return absoluteUrl(site.baseUrl, target?.url, `#comment-${Number(comment?.id) || ''}`);
}

function toIsoString(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function displayNick(nick: unknown): string {
  return cleanLine(nick, NICK_MAX_LENGTH) || '匿名';
}

function targetTitle(target: ResolvedCommentTarget): string {
  return cleanLine(target?.title) || cleanLine(target?.key) || '未命名页面';
}

export function buildWebhookPayload(
  event: CommentWebhookEvent,
  site: CommentNotifySite,
  comment: CommentRecord,
  target: ResolvedCommentTarget,
): CommentWebhookPayload {
  return {
    event,
    site: { name: site.name, url: site.baseUrl },
    target: {
      key: String(target?.key ?? ''),
      type: String(target?.type ?? ''),
      id: String(target?.id ?? ''),
      title: String(target?.title ?? ''),
      url: String(target?.url ?? ''),
    },
    comment: {
      id: comment.id,
      parentId: comment.parentId ?? null,
      rootId: comment.rootId ?? null,
      nick: String(comment.nick ?? ''),
      link: String(comment.link ?? ''),
      isAdmin: Boolean(comment.isAdmin),
      status: comment.status,
      excerpt: buildExcerpt(comment.content),
      createdAt: toIsoString(comment.createdAt),
    },
  };
}

const MAIL_STYLE = {
  body: 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f2328;',
  quote:
    'margin:12px 0;padding:8px 12px;border-left:3px solid #d0d7de;background:#f6f8fa;white-space:pre-wrap;word-break:break-word;',
  footer: 'margin-top:24px;color:#8c959f;font-size:12px;',
};

function htmlLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
    label,
  )}</a>`;
}

function htmlDocument(paragraphs: string[], siteName: string): string {
  return [
    `<div style="${MAIL_STYLE.body}">`,
    ...paragraphs,
    `<p style="${MAIL_STYLE.footer}">此邮件由「${escapeHtml(
      siteName,
    )}」自动发送，请勿直接回复。</p>`,
    '</div>',
  ].join('\n');
}

function htmlQuote(text: string): string {
  return `<div style="${MAIL_STYLE.quote}">${escapeHtml(text)}</div>`;
}

function textFooter(siteName: string): string {
  return `此邮件由「${siteName}」自动发送，请勿直接回复。`;
}

const OWNER_SUBJECT_SUFFIX: Record<CommentStatus, string> = {
  approved: '有新评论',
  pending: '有新评论待审核',
  spam: '有疑似垃圾评论',
  deleted: '有新评论',
};

const OWNER_STATUS_NOTE: Record<CommentStatus, string> = {
  approved: '',
  pending: '（待审核）',
  spam: '（已被标记为疑似垃圾评论，暂不公开）',
  deleted: '',
};

/** Notice to the site owner about a comment written by a visitor. */
export function buildOwnerMail(
  site: CommentNotifySite,
  target: ResolvedCommentTarget,
  comment: CommentRecord,
): CommentMailContent {
  const title = targetTitle(target);
  const nick = displayNick(comment.nick);
  const status: CommentStatus = OWNER_SUBJECT_SUFFIX[comment.status] ? comment.status : 'pending';
  const excerpt = buildExcerpt(comment.content);
  const commentUrl = commentAnchorUrl(site, target, comment);
  // The admin list opens on the moderation queue for anything not yet public.
  const adminPath =
    status === 'approved' ? ADMIN_COMMENT_PATH : `${ADMIN_COMMENT_PATH}?status=pending`;
  const adminUrl = absoluteUrl(site.baseUrl, adminPath);
  const replyTo = comment.parentId ? cleanLine(comment.replyToNick, NICK_MAX_LENGTH) : '';
  const action = replyTo ? `回复了 ${replyTo}` : '发表了评论';
  const intro = `${nick} 在《${title}》${action}${OWNER_STATUS_NOTE[status]}：`;

  const subject = `[${cleanLine(site.name)}] 《${title}》${OWNER_SUBJECT_SUFFIX[status]}`;
  const text = [
    intro,
    '',
    excerpt,
    '',
    ...(commentUrl ? [`查看评论：${commentUrl}`] : []),
    ...(adminUrl ? [`管理评论：${adminUrl}`] : []),
    '',
    textFooter(site.name),
  ].join('\n');
  const links = [
    ...(commentUrl ? [htmlLink(commentUrl, '查看评论')] : []),
    ...(adminUrl ? [htmlLink(adminUrl, '前往后台管理评论')] : []),
  ];
  const html = htmlDocument(
    [
      `<p>${escapeHtml(intro)}</p>`,
      htmlQuote(excerpt),
      ...(links.length ? [`<p>${links.join(' · ')}</p>`] : []),
    ],
    site.name,
  );
  return { subject, text, html };
}

/**
 * Notice to the author of `parent` that `comment` replied to them.
 *
 * The recipient address is whatever the parent's author typed, which nobody
 * verified. So a visitor's reply is never quoted: the mail only points to the
 * thread, and the site cannot be used to deliver attacker-written text to an
 * arbitrary inbox. Only the site owner's replies are quoted.
 */
export function buildReplyMail(
  site: CommentNotifySite,
  target: ResolvedCommentTarget,
  comment: CommentRecord,
  parent: CommentRecord,
): CommentMailContent {
  const title = targetTitle(target);
  const commentUrl = commentAnchorUrl(site, target, comment);
  const fromOwner = Boolean(comment.isAdmin);
  const intro = fromOwner
    ? `你在《${title}》的评论收到了博主的回复：`
    : `你在《${title}》的评论收到了新回复。`;
  const replyExcerpt = fromOwner ? buildExcerpt(comment.content) : '';

  const subject = `[${cleanLine(site.name)}] 你在《${title}》的评论有了新回复`;
  const text = [
    '你好：',
    '',
    intro,
    ...(replyExcerpt ? ['', replyExcerpt] : []),
    '',
    ...(commentUrl ? [`查看回复：${commentUrl}`, ''] : []),
    '如果你没有在该网站发表过评论，请忽略这封邮件。',
    '',
    textFooter(site.name),
  ].join('\n');
  const html = htmlDocument(
    [
      '<p>你好：</p>',
      `<p>${escapeHtml(intro)}</p>`,
      ...(replyExcerpt ? [htmlQuote(replyExcerpt)] : []),
      ...(commentUrl ? [`<p>${htmlLink(commentUrl, '查看回复')}</p>`] : []),
      '<p>如果你没有在该网站发表过评论，请忽略这封邮件。</p>',
    ],
    site.name,
  );
  return { subject, text, html };
}

export function buildTestMail(site: CommentNotifySite): CommentMailContent {
  const subject = `[${cleanLine(site.name)}] 评论通知测试邮件`;
  const body = '这是一封测试邮件。收到它说明评论邮件通知的 SMTP 配置可以正常发信。';
  return {
    subject,
    text: [body, '', textFooter(site.name)].join('\n'),
    html: htmlDocument([`<p>${escapeHtml(body)}</p>`], site.name),
  };
}
