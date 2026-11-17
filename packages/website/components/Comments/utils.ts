import {
  COMMENT_IMAGE_MIME_TYPES,
  COMMENT_LIMITS,
  type PublicComment,
  type PublicCommentConfig,
} from '../../api/comments';

export const ANONYMOUS_NICK = '匿名';

export const displayNick = (nick: string | null | undefined) =>
  (typeof nick === 'string' && nick.trim()) || ANONYMOUS_NICK;

/** First visible character of the nick; anonymous visitors get the first character of the placeholder. */
export const avatarLetter = (nick: string | null | undefined) => {
  const first = Array.from(displayNick(nick))[0] || '?';
  return first.toUpperCase();
};

/** FNV-1a over UTF-16 code units; stable across sessions and browsers. */
export const hashString = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const avatarColor = (nick: string | null | undefined) => {
  const key = (typeof nick === 'string' && nick.trim()) || '';
  if (!key) {
    return 'hsl(215, 14%, 55%)';
  }
  return `hsl(${hashString(key) % 360}, 55%, 47%)`;
};

/** Visitor homepages are rendered only when they are plain http(s) URLs. */
export const normalizeHomepage = (link: string | null | undefined) => {
  if (typeof link !== 'string' || !link.trim()) {
    return '';
  }
  try {
    const url = new URL(link.trim());
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
      return '';
    }
    return url.href;
  } catch {
    return '';
  }
};

const pad = (value: number) => String(value).padStart(2, '0');

export const formatFullTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

export const formatRelativeTime = (iso: string, now: number = Date.now()) => {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return '';
  }
  const seconds = Math.floor((now - time) / 1000);
  if (seconds < 60) {
    return '刚刚';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} 天前`;
  }
  return formatFullTime(iso).slice(0, 10);
};

// ---------------------------------------------------------------------------
// Visitor profile (remember me)
// ---------------------------------------------------------------------------

export interface CommentProfile {
  nick: string;
  mail: string;
  link: string;
}

export const COMMENT_PROFILE_STORAGE_KEY = 'vanblog-comment-profile';

export const EMPTY_PROFILE: CommentProfile = { nick: '', mail: '', link: '' };

const readString = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.slice(0, maxLength) : '';

export const loadCommentProfile = (): CommentProfile | null => {
  try {
    const raw = window.localStorage.getItem(COMMENT_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      nick: readString(parsed.nick, COMMENT_LIMITS.nickMaxLength),
      mail: readString(parsed.mail, COMMENT_LIMITS.mailMaxLength),
      link: readString(parsed.link, COMMENT_LIMITS.linkMaxLength),
    };
  } catch {
    return null;
  }
};

export const saveCommentProfile = (profile: CommentProfile) => {
  try {
    window.localStorage.setItem(
      COMMENT_PROFILE_STORAGE_KEY,
      JSON.stringify({ nick: profile.nick, mail: profile.mail, link: profile.link }),
    );
  } catch {
    // Storage can be full or blocked; commenting must keep working.
  }
};

export const clearCommentProfile = () => {
  try {
    window.localStorage.removeItem(COMMENT_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CommentDraft extends CommentProfile {
  content: string;
}

/** Returns a localized error, or null when the draft may be submitted. */
export const validateCommentDraft = (
  draft: CommentDraft,
  config: Pick<PublicCommentConfig, 'maxLength' | 'requireMail'>,
  isAdmin: boolean,
) => {
  if (!draft.content.trim()) {
    return '请填写评论内容';
  }
  if (draft.content.length > config.maxLength) {
    return `评论内容不能超过 ${config.maxLength} 字`;
  }
  if (isAdmin) {
    return null;
  }
  const nick = draft.nick.trim();
  const mail = draft.mail.trim();
  const link = draft.link.trim();
  if (nick.length > COMMENT_LIMITS.nickMaxLength) {
    return `昵称不能超过 ${COMMENT_LIMITS.nickMaxLength} 个字符`;
  }
  if (config.requireMail && !mail) {
    return '请填写邮箱';
  }
  if (mail && (mail.length > COMMENT_LIMITS.mailMaxLength || !MAIL_PATTERN.test(mail))) {
    return '邮箱格式不正确';
  }
  if (link && (link.length > COMMENT_LIMITS.linkMaxLength || !normalizeHomepage(link))) {
    return '网址需以 http:// 或 https:// 开头';
  }
  return null;
};

/** Drops leading blank lines and trailing whitespace but keeps indentation. */
export const normalizeContent = (content: string) =>
  content.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd();

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export const collectCommentIds = (items: PublicComment[]) => {
  const ids: number[] = [];
  for (const root of items) {
    ids.push(root.id);
    for (const reply of root.replies || []) {
      ids.push(reply.id);
    }
  }
  return ids;
};

export const patchCommentTree = (
  items: PublicComment[],
  id: number,
  patch: Partial<PublicComment>,
): PublicComment[] => {
  let changed = false;
  const next = items.map((root) => {
    if (root.id === id) {
      changed = true;
      return { ...root, ...patch };
    }
    if (!root.replies?.some((reply) => reply.id === id)) {
      return root;
    }
    changed = true;
    return {
      ...root,
      replies: root.replies.map((reply) => (reply.id === id ? { ...reply, ...patch } : reply)),
    };
  });
  return changed ? next : items;
};

export interface LocalComment {
  comment: PublicComment;
  pending: boolean;
}

/**
 * Overlays comments posted in this session on top of the server page so the
 * author sees them immediately, before the public cache expires. Server copies
 * win once they show up.
 */
export const mergeLocalComments = (
  items: PublicComment[],
  localRoots: LocalComment[],
  localReplies: LocalComment[],
): PublicComment[] => {
  const known = new Set(collectCommentIds(items));
  const roots = [
    ...localRoots.filter((entry) => !known.has(entry.comment.id)).map((entry) => entry.comment),
    ...items,
  ];
  const repliesByRoot = new Map<number, PublicComment[]>();
  for (const entry of localReplies) {
    const rootId = entry.comment.rootId;
    if (rootId === null || known.has(entry.comment.id)) {
      continue;
    }
    const list = repliesByRoot.get(rootId) || [];
    list.push(entry.comment);
    repliesByRoot.set(rootId, list);
  }
  if (!repliesByRoot.size) {
    return roots;
  }
  return roots.map((root) => {
    const extra = repliesByRoot.get(root.id);
    return extra ? { ...root, replies: [...(root.replies || []), ...extra] } : root;
  });
};

export const parseCommentHash = (hash: string | null | undefined) => {
  const match = /^#comment-(\d{1,15})$/.exec(hash || '');
  return match ? Number(match[1]) : null;
};

// ---------------------------------------------------------------------------
// Editor helpers
// ---------------------------------------------------------------------------

export const insertText = (value: string, start: number, end: number, text: string) => {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  return {
    value: `${value.slice(0, safeStart)}${text}${value.slice(safeEnd)}`,
    cursor: safeStart + text.length,
  };
};

/** Puts an uploaded image on its own line so Markdown renders it as a block. */
export const wrapBlockSnippet = (value: string, start: number, snippet: string) => {
  const before = value.slice(0, start);
  const after = value.slice(start);
  const prefix = before && !before.endsWith('\n') ? '\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n' : '';
  return `${prefix}${snippet}${suffix}`;
};

export const isAcceptedImage = (file: Pick<File, 'type'>) =>
  COMMENT_IMAGE_MIME_TYPES.includes(String(file.type || '').toLowerCase());
