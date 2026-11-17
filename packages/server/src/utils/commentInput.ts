import { commentError } from 'src/provider/comment/comment-request.service';
import {
  COMMENT_IMAGE_DIR,
  COMMENT_LIMITS,
  COMMENT_PAGE_TARGETS,
  CommentModerationMode,
  CommentPageTarget,
  CommentStatus,
  CommentTarget,
  CommentTargetKey,
} from 'src/types/comment.dto';
import { isValidCommentEmail } from 'src/utils/commentSetting';

/** Control characters other than tab and newline (after CR normalization). */
const CONTENT_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f]/u;
const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001f\u007f\u2028\u2029]/u;
/** Invisible formatting characters that make a nickname look like someone else's. */
const NICK_INVISIBLE_CHARACTERS = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/u;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,15}$/u;
const POST_TARGET = /^post:([1-9][0-9]{0,15})$/u;
const PAGE_TARGET = /^page:([a-z]+)$/u;
const TARGET_MAX_LENGTH = 32;

export const invalidCommentInput = (message: string) =>
  commentError(400, 'COMMENT_INVALID_INPUT', message);

export interface ParsedCommentTarget extends CommentTarget {
  key: CommentTargetKey;
}

export const formatCommentTargetKey = (type: string, id: string | number) =>
  `${type}:${id}` as CommentTargetKey;

/**
 * Parses `post:<id>` or `page:<link|about>`. Article ids must be canonical
 * positive integers, so aliases such as `post:02` or `post:+2` never open a
 * second thread for the same article. Returns null for anything else.
 */
export function parseCommentTargetKey(value: unknown): ParsedCommentTarget | null {
  if (typeof value !== 'string' || value.length > TARGET_MAX_LENGTH) return null;
  const post = POST_TARGET.exec(value);
  if (post) {
    const id = Number(post[1]);
    if (!Number.isSafeInteger(id)) return null;
    return { type: 'post', id: post[1], key: formatCommentTargetKey('post', post[1]) };
  }
  const page = PAGE_TARGET.exec(value);
  if (page && (COMMENT_PAGE_TARGETS as readonly string[]).includes(page[1])) {
    const id = page[1] as CommentPageTarget;
    return { type: 'page', id, key: formatCommentTargetKey('page', id) };
  }
  return null;
}

/** Canonical positive safe integer from a number or a decimal string, else null. */
export function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !POSITIVE_INTEGER.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Splits a comma separated query value (or repeated parameters) into trimmed items. */
export function splitCommentListParam(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return items
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : [String(item)]))
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Parses a list of comment ids, rejecting malformed ids and oversized lists. */
export function parseCommentIdList(value: unknown, max: number): number[] {
  const items = splitCommentListParam(value);
  if (items.length > max) throw invalidCommentInput(`At most ${max} ids are allowed`);
  const ids = new Set<number>();
  for (const item of items) {
    const id = parsePositiveInteger(item);
    if (id === null) throw invalidCommentInput('Comment ids must be positive integers');
    ids.add(id);
  }
  return [...ids];
}

export function normalizeCommentNick(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw invalidCommentInput('nick must be a string');
  const nick = value.trim();
  if (nick.length > COMMENT_LIMITS.nickMaxLength) {
    throw invalidCommentInput(`nick must be at most ${COMMENT_LIMITS.nickMaxLength} characters`);
  }
  if (SINGLE_LINE_FORBIDDEN.test(nick) || NICK_INVISIBLE_CHARACTERS.test(nick)) {
    throw invalidCommentInput('nick must be a single line of visible text');
  }
  return nick;
}

export function normalizeCommentMail(value: unknown, required: boolean): string {
  if (value === undefined || value === null || value === '') {
    if (required) throw commentError(400, 'COMMENT_MAIL_REQUIRED', 'An email address is required');
    return '';
  }
  if (typeof value !== 'string') throw invalidCommentInput('mail must be a string');
  const mail = value.trim();
  if (!mail) {
    if (required) throw commentError(400, 'COMMENT_MAIL_REQUIRED', 'An email address is required');
    return '';
  }
  if (!isValidCommentEmail(mail)) throw invalidCommentInput('mail is not a valid email address');
  return mail;
}

/** Accepts only absolute http(s) URLs without credentials; returns the normalized href. */
export function normalizeCommentLink(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw invalidCommentInput('link must be a string');
  const link = value.trim();
  if (!link) return '';
  const invalid = () => invalidCommentInput('link must be an http(s) URL without credentials');
  if (link.length > COMMENT_LIMITS.linkMaxLength || /[\s\u0000-\u001f\u007f]/u.test(link)) {
    throw invalid();
  }
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw invalid();
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw invalid();
  }
  if (url.href.length > COMMENT_LIMITS.linkMaxLength) throw invalid();
  return url.href;
}

/**
 * Normalizes line endings, trims, and enforces the length and character rules.
 * `maxLength` is the configured limit for visitors, the hard ceiling for admins.
 */
export function normalizeCommentContent(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw invalidCommentInput('content must be a string');
  const content = value.replace(/\r\n?/gu, '\n').trim();
  if (!content) throw invalidCommentInput('content must not be empty');
  const limit = Math.min(Math.max(1, Math.trunc(maxLength)), COMMENT_LIMITS.contentHardMaxLength);
  if (content.length > limit) {
    throw commentError(
      400,
      'COMMENT_CONTENT_TOO_LONG',
      `content must be at most ${limit} characters`,
    );
  }
  if (CONTENT_CONTROL_CHARACTERS.test(content)) {
    throw invalidCommentInput('content contains control characters');
  }
  return content;
}

/** null for a root comment, otherwise the parent id. */
export function normalizeCommentParentId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const id = parsePositiveInteger(value);
  if (id === null) throw invalidCommentInput('parentId must be a positive integer');
  return id;
}

const COMMENT_IMAGE_PATTERN = new RegExp(
  `/static/${COMMENT_IMAGE_DIR.replace(/[/]/gu, '\\/')}/([0-9a-f]{64}\\.webp)(?![A-Za-z0-9_])`,
  'gu',
);

/** File names of visitor uploads (`/static/img/comment/<sha256>.webp`) referenced by the content. */
export function extractCommentImages(content: string): string[] {
  const names = new Set<string>();
  for (const match of String(content || '').matchAll(COMMENT_IMAGE_PATTERN)) {
    names.add(match[1]);
  }
  return [...names];
}

export function countCommentLinks(content: string): number {
  return (String(content || '').match(/(?:https?:\/\/|\bwww\.)[^\s<>()[\]]+/giu) || []).length;
}

export function hasRepeatedCharacterRun(content: string, runLength: number): boolean {
  if (runLength < 2) return Boolean(content);
  return new RegExp(`(.)\\1{${runLength - 1},}`, 'su').test(String(content || ''));
}

/** First configured word contained (case-insensitively) in any of the texts, else null. */
export function findForbiddenWord(texts: string[], words: string[]): string | null {
  const haystack = texts
    .filter(Boolean)
    .map((text) => text.toLowerCase())
    .join('\n');
  if (!haystack) return null;
  for (const word of words || []) {
    const needle = String(word || '')
      .trim()
      .toLowerCase();
    if (needle && haystack.includes(needle)) return word;
  }
  return null;
}

export interface CommentModerationInput {
  isAdmin: boolean;
  moderation: CommentModerationMode;
  forbiddenWords: string[];
  nick: string;
  mail: string;
  link: string;
  content: string;
  images: string[];
}

/** Initial status of a new comment. */
export function decideCommentStatus(input: CommentModerationInput): CommentStatus {
  if (input.isAdmin) return 'approved';
  if (
    findForbiddenWord([input.content, input.nick, input.mail, input.link], input.forbiddenWords)
  ) {
    return 'spam';
  }
  if (input.moderation === 'all') return 'pending';
  if (input.moderation === 'off') return 'approved';
  const suspicious =
    countCommentLinks(input.content) >= COMMENT_LIMITS.suspiciousLinkCount ||
    hasRepeatedCharacterRun(input.content, COMMENT_LIMITS.suspiciousRepeatedRun) ||
    input.images.length > 0;
  return suspicious ? 'pending' : 'approved';
}
