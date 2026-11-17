// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { PublicComment } from '../api/comments';
import {
  avatarColor,
  avatarLetter,
  clearCommentProfile,
  COMMENT_PROFILE_STORAGE_KEY,
  displayNick,
  formatRelativeTime,
  insertText,
  loadCommentProfile,
  mergeLocalComments,
  normalizeContent,
  normalizeHomepage,
  parseCommentHash,
  patchCommentTree,
  saveCommentProfile,
  validateCommentDraft,
  wrapBlockSnippet,
} from '../components/Comments/utils';

const comment = (overrides: Partial<PublicComment>): PublicComment => ({
  id: 1,
  target: 'post:1',
  parentId: null,
  rootId: null,
  replyToNick: null,
  nick: 'Alice',
  link: '',
  isAdmin: false,
  pinned: false,
  content: 'hi',
  likes: 0,
  createdAt: '2026-11-17T10:00:00.000Z',
  ...overrides,
});

describe('comment display helpers', () => {
  it('uses a placeholder for anonymous visitors', () => {
    expect(displayNick('')).toBe('匿名');
    expect(displayNick('   ')).toBe('匿名');
    expect(displayNick(' Bob ')).toBe('Bob');
    expect(avatarLetter('')).toBe('匿');
    expect(avatarLetter('alice')).toBe('A');
    expect(avatarLetter('张三')).toBe('张');
    expect(avatarLetter('😀smile')).toBe('😀');
  });

  it('derives a stable avatar colour from the nick', () => {
    expect(avatarColor('Alice')).toBe(avatarColor('Alice'));
    expect(avatarColor('Alice')).not.toBe(avatarColor('Bob'));
    expect(avatarColor('Alice')).toMatch(/^hsl\(\d{1,3}, 55%, 47%\)$/);
    expect(avatarColor('')).toBe(avatarColor('  '));
  });

  it('only links visitor homepages over http(s)', () => {
    expect(normalizeHomepage('https://example.com')).toBe('https://example.com/');
    expect(normalizeHomepage('http://example.com/a')).toBe('http://example.com/a');
    expect(normalizeHomepage('javascript:alert(1)')).toBe('');
    expect(normalizeHomepage('data:text/html,x')).toBe('');
    expect(normalizeHomepage('https://user:pass@example.com')).toBe('');
    expect(normalizeHomepage('example.com')).toBe('');
    expect(normalizeHomepage('')).toBe('');
  });

  it('formats relative times', () => {
    const now = Date.parse('2026-11-17T12:00:00.000Z');
    expect(formatRelativeTime('2026-11-17T11:59:30.000Z', now)).toBe('刚刚');
    expect(formatRelativeTime('2026-11-17T11:55:00.000Z', now)).toBe('5 分钟前');
    expect(formatRelativeTime('2026-11-17T09:00:00.000Z', now)).toBe('3 小时前');
    expect(formatRelativeTime('2026-11-15T12:00:00.000Z', now)).toBe('2 天前');
    expect(formatRelativeTime('2026-01-02T12:00:00.000Z', now)).toBe('2026-01-02');
    expect(formatRelativeTime('not a date', now)).toBe('');
  });

  it('parses comment anchors', () => {
    expect(parseCommentHash('#comment-42')).toBe(42);
    expect(parseCommentHash('#comment-')).toBeNull();
    expect(parseCommentHash('#comments')).toBeNull();
    expect(parseCommentHash('#comment-1x')).toBeNull();
    expect(parseCommentHash('')).toBeNull();
  });
});

describe('comment draft validation', () => {
  const config = { maxLength: 10, requireMail: false };
  const draft = { nick: '', mail: '', link: '', content: 'hello' };

  it('requires content within the configured length', () => {
    expect(validateCommentDraft({ ...draft, content: '   ' }, config, false)).toBe(
      '请填写评论内容',
    );
    expect(validateCommentDraft({ ...draft, content: 'x'.repeat(11) }, config, false)).toBe(
      '评论内容不能超过 10 字',
    );
    expect(validateCommentDraft({ ...draft, content: 'x'.repeat(10) }, config, false)).toBeNull();
  });

  it('enforces mail only when required and validates its format', () => {
    expect(validateCommentDraft(draft, { ...config, requireMail: true }, false)).toBe('请填写邮箱');
    expect(validateCommentDraft({ ...draft, mail: 'nope' }, config, false)).toBe('邮箱格式不正确');
    expect(
      validateCommentDraft({ ...draft, mail: 'a@b.co' }, { ...config, requireMail: true }, false),
    ).toBeNull();
  });

  it('rejects non-http homepages and long nicks', () => {
    expect(validateCommentDraft({ ...draft, link: 'ftp://x.example' }, config, false)).toBe(
      '网址需以 http:// 或 https:// 开头',
    );
    expect(validateCommentDraft({ ...draft, nick: 'n'.repeat(33) }, config, false)).toBe(
      '昵称不能超过 32 个字符',
    );
  });

  it('skips visitor fields for the blog owner', () => {
    expect(
      validateCommentDraft({ ...draft, link: 'nope' }, { ...config, requireMail: true }, true),
    ).toBeNull();
  });

  it('normalizes content without touching indentation', () => {
    expect(normalizeContent('\n\n    code\n\n')).toBe('    code');
    expect(normalizeContent('text  ')).toBe('text');
  });
});

describe('comment profile storage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('round-trips the visitor profile', () => {
    saveCommentProfile({ nick: 'Alice', mail: 'a@b.co', link: 'https://a.example' });
    expect(loadCommentProfile()).toEqual({
      nick: 'Alice',
      mail: 'a@b.co',
      link: 'https://a.example',
    });
    clearCommentProfile();
    expect(loadCommentProfile()).toBeNull();
  });

  it('ignores corrupted entries', () => {
    window.localStorage.setItem(COMMENT_PROFILE_STORAGE_KEY, '{not json');
    expect(loadCommentProfile()).toBeNull();
    window.localStorage.setItem(
      COMMENT_PROFILE_STORAGE_KEY,
      JSON.stringify({ nick: 7, mail: 'a@b.co' }),
    );
    expect(loadCommentProfile()).toEqual({ nick: '', mail: 'a@b.co', link: '' });
  });
});

describe('comment thread helpers', () => {
  const root = comment({ id: 1, replies: [comment({ id: 2, parentId: 1, rootId: 1 })] });

  it('patches roots and replies immutably', () => {
    const items = [root];
    const patched = patchCommentTree(items, 2, { likes: 3 });
    expect(patched).not.toBe(items);
    expect(patched[0].replies?.[0].likes).toBe(3);
    expect(items[0].replies?.[0].likes).toBe(0);
    expect(patchCommentTree(items, 99, { likes: 1 })).toBe(items);
  });

  it('overlays local comments until the server returns them', () => {
    const localRoot = { comment: comment({ id: 10 }), pending: true };
    const localReply = { comment: comment({ id: 11, parentId: 2, rootId: 1 }), pending: false };
    const duplicate = { comment: comment({ id: 2, parentId: 1, rootId: 1 }), pending: false };

    const merged = mergeLocalComments([root], [localRoot], [localReply, duplicate]);
    expect(merged.map((item) => item.id)).toEqual([10, 1]);
    expect(merged[1].replies?.map((item) => item.id)).toEqual([2, 11]);
  });

  it('inserts text at the selection', () => {
    expect(insertText('hello world', 6, 11, 'there')).toEqual({ value: 'hello there', cursor: 11 });
    expect(insertText('abc', 99, 99, '!')).toEqual({ value: 'abc!', cursor: 4 });
    expect(wrapBlockSnippet('text', 4, '![](x)')).toBe('\n![](x)');
    expect(wrapBlockSnippet('a\nb', 2, '![](x)')).toBe('![](x)\n');
    expect(wrapBlockSnippet('', 0, '![](x)')).toBe('![](x)');
  });
});
