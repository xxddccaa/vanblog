import { HttpException } from '@nestjs/common';
import {
  countCommentLinks,
  decideCommentStatus,
  extractCommentImages,
  findForbiddenWord,
  hasRepeatedCharacterRun,
  normalizeCommentContent,
  normalizeCommentLink,
  normalizeCommentMail,
  normalizeCommentNick,
  normalizeCommentParentId,
  parseCommentIdList,
  parseCommentTargetKey,
  parsePositiveInteger,
  splitCommentListParam,
} from './commentInput';

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    const response = (error as HttpException).getResponse() as any;
    return { status: (error as HttpException).getStatus(), code: response.code };
  }
  return null;
};

const hex = 'a'.repeat(64);
const otherHex = '0123456789abcdef'.repeat(4);

describe('comment input helpers', () => {
  describe('parseCommentTargetKey', () => {
    it('accepts canonical post ids and the known pages', () => {
      expect(parseCommentTargetKey('post:12')).toEqual({ type: 'post', id: '12', key: 'post:12' });
      expect(parseCommentTargetKey('page:link')).toEqual({
        type: 'page',
        id: 'link',
        key: 'page:link',
      });
      expect(parseCommentTargetKey('page:about')?.key).toBe('page:about');
    });

    it('rejects aliases, unknown pages and malformed keys', () => {
      for (const value of [
        'post:02',
        'post:0',
        'post:+2',
        'post:-1',
        'post:1.0',
        'post:1e3',
        'post: 1',
        'post:12 ',
        'POST:12',
        'post:99999999999999999',
        'post:hello',
        'page:moment',
        'page:About',
        'page:',
        'link',
        '',
        12,
        null,
        undefined,
        ['post:1'],
      ]) {
        expect(parseCommentTargetKey(value)).toBeNull();
      }
    });
  });

  it('parses canonical positive integers only', () => {
    expect(parsePositiveInteger(5)).toBe(5);
    expect(parsePositiveInteger('42')).toBe(42);
    for (const value of [0, -1, 1.5, '007', '1e2', ' 3', '', null, undefined, NaN, {}]) {
      expect(parsePositiveInteger(value)).toBeNull();
    }
  });

  it('splits list params and validates id lists', () => {
    expect(splitCommentListParam('post:1, post:2,,page:link')).toEqual([
      'post:1',
      'post:2',
      'page:link',
    ]);
    expect(splitCommentListParam(['1,2', '3'])).toEqual(['1', '2', '3']);
    expect(splitCommentListParam(undefined)).toEqual([]);
    expect(parseCommentIdList('3,1,3', 10)).toEqual([3, 1]);
    expect(errorOf(() => parseCommentIdList('1,x', 10))?.code).toBe('COMMENT_INVALID_INPUT');
    expect(errorOf(() => parseCommentIdList('1,2,3', 2))?.code).toBe('COMMENT_INVALID_INPUT');
  });

  describe('nick', () => {
    it('trims and allows empty for anonymous', () => {
      expect(normalizeCommentNick('  Alice ')).toBe('Alice');
      expect(normalizeCommentNick(undefined)).toBe('');
      expect(normalizeCommentNick('')).toBe('');
      expect(normalizeCommentNick('   ')).toBe('');
    });

    it('enforces the length limit and a single visible line', () => {
      expect(normalizeCommentNick('x'.repeat(32))).toHaveLength(32);
      for (const value of [
        'x'.repeat(33),
        'a\nb',
        'a\tb',
        'a\u2028b',
        'admin\u202e',
        'ad\u200bmin',
        42,
      ]) {
        expect(errorOf(() => normalizeCommentNick(value))?.code).toBe('COMMENT_INVALID_INPUT');
      }
    });
  });

  describe('mail', () => {
    it('is optional unless required', () => {
      expect(normalizeCommentMail('', false)).toBe('');
      expect(normalizeCommentMail(undefined, false)).toBe('');
      expect(normalizeCommentMail(' a@example.com ', true)).toBe('a@example.com');
      expect(errorOf(() => normalizeCommentMail('', true))).toEqual({
        status: 400,
        code: 'COMMENT_MAIL_REQUIRED',
      });
      expect(errorOf(() => normalizeCommentMail('   ', true))?.code).toBe('COMMENT_MAIL_REQUIRED');
    });

    it('rejects invalid addresses', () => {
      for (const value of ['nope', 'a@b', 'a b@example.com', `${'x'.repeat(130)}@example.com`, 5]) {
        expect(errorOf(() => normalizeCommentMail(value, false))?.code).toBe(
          'COMMENT_INVALID_INPUT',
        );
      }
    });
  });

  describe('link', () => {
    it('accepts http(s) URLs and normalizes them', () => {
      expect(normalizeCommentLink('https://example.com')).toBe('https://example.com/');
      expect(normalizeCommentLink(' http://example.com/a?b=1 ')).toBe('http://example.com/a?b=1');
      expect(normalizeCommentLink('')).toBe('');
      expect(normalizeCommentLink(undefined)).toBe('');
    });

    it('rejects other schemes, credentials, whitespace and long URLs', () => {
      for (const value of [
        'javascript:alert(1)',
        'data:text/html,hi',
        'ftp://example.com',
        '//example.com',
        'example.com',
        'https://user:pass@example.com',
        'https://user@example.com',
        'https://exa mple.com',
        `https://example.com/${'a'.repeat(200)}`,
        123,
      ]) {
        expect(errorOf(() => normalizeCommentLink(value))?.code).toBe('COMMENT_INVALID_INPUT');
      }
    });
  });

  describe('content', () => {
    it('trims, normalizes line endings and keeps tabs and newlines', () => {
      expect(normalizeCommentContent('  a\r\nb\rc\td  ', 100)).toBe('a\nb\nc\td');
    });

    it('rejects empty, too long and control characters', () => {
      expect(errorOf(() => normalizeCommentContent('   ', 100))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
      expect(errorOf(() => normalizeCommentContent(undefined, 100))?.code).toBe(
        'COMMENT_INVALID_INPUT',
      );
      expect(normalizeCommentContent('x'.repeat(100), 100)).toHaveLength(100);
      expect(errorOf(() => normalizeCommentContent('x'.repeat(101), 100))).toEqual({
        status: 400,
        code: 'COMMENT_CONTENT_TOO_LONG',
      });
      expect(errorOf(() => normalizeCommentContent('x'.repeat(20_001), 50_000))?.code).toBe(
        'COMMENT_CONTENT_TOO_LONG',
      );
      for (const value of ['a\u0000b', 'a\u0007b', 'a\u001bb', 'a\u007fb', 'a\u000bb']) {
        expect(errorOf(() => normalizeCommentContent(value, 100))?.code).toBe(
          'COMMENT_INVALID_INPUT',
        );
      }
    });
  });

  it('parses the parent id', () => {
    expect(normalizeCommentParentId(undefined)).toBeNull();
    expect(normalizeCommentParentId(null)).toBeNull();
    expect(normalizeCommentParentId(7)).toBe(7);
    expect(normalizeCommentParentId('7')).toBe(7);
    for (const value of [0, -2, 1.5, '07', 'x', {}]) {
      expect(errorOf(() => normalizeCommentParentId(value))?.code).toBe('COMMENT_INVALID_INPUT');
    }
  });

  it('extracts visitor upload file names from the content', () => {
    const content = [
      `![a](/static/img/comment/${hex}.webp)`,
      `![b](https://blog.example.com/static/img/comment/${otherHex}.webp "t")`,
      `again /static/img/comment/${hex}.webp`,
      `/static/img/comment/${hex.toUpperCase()}.webp`,
      `/static/img/comment/${hex}.webpx`,
      `/static/img/other/${hex}.webp`,
      `/static/img/comment/${'a'.repeat(63)}.webp`,
    ].join('\n');
    expect(extractCommentImages(content)).toEqual([`${hex}.webp`, `${otherHex}.webp`]);
    expect(extractCommentImages('plain')).toEqual([]);
  });

  it('counts links and detects repeated runs', () => {
    expect(countCommentLinks('see https://a.com and http://b.com/x or www.c.com')).toBe(3);
    expect(countCommentLinks('[x](https://a.com) https://www.b.com')).toBe(2);
    expect(countCommentLinks('no links here')).toBe(0);
    expect(hasRepeatedCharacterRun('a'.repeat(16), 16)).toBe(true);
    expect(hasRepeatedCharacterRun('a'.repeat(15), 16)).toBe(false);
    expect(hasRepeatedCharacterRun('\u54c8'.repeat(16), 16)).toBe(true);
    expect(hasRepeatedCharacterRun('\u{1F600}'.repeat(16), 16)).toBe(true);
    expect(hasRepeatedCharacterRun('ab'.repeat(20), 16)).toBe(false);
  });

  it('matches forbidden words case-insensitively as substrings', () => {
    expect(findForbiddenWord(['Buy CHEAP pills'], ['cheap'])).toBe('cheap');
    expect(findForbiddenWord(['hello', 'spam.example'], ['Spam.Example'])).toBe('Spam.Example');
    expect(findForbiddenWord(['hello'], ['bye', ''])).toBeNull();
    expect(findForbiddenWord([], ['x'])).toBeNull();
  });

  describe('decideCommentStatus', () => {
    const base = {
      isAdmin: false,
      moderation: 'suspicious' as const,
      forbiddenWords: [] as string[],
      nick: 'Alice',
      mail: '',
      link: '',
      content: 'Nice post',
      images: [] as string[],
    };

    it('approves admins unconditionally', () => {
      expect(
        decideCommentStatus({
          ...base,
          isAdmin: true,
          moderation: 'all',
          forbiddenWords: ['nice'],
        }),
      ).toBe('approved');
    });

    it('marks forbidden words as spam in every mode and field', () => {
      for (const moderation of ['all', 'suspicious', 'off'] as const) {
        expect(decideCommentStatus({ ...base, moderation, forbiddenWords: ['NICE'] })).toBe('spam');
      }
      expect(
        decideCommentStatus({ ...base, nick: 'casino king', forbiddenWords: ['casino'] }),
      ).toBe('spam');
      expect(
        decideCommentStatus({
          ...base,
          link: 'https://casino.example/',
          forbiddenWords: ['casino'],
        }),
      ).toBe('spam');
      expect(
        decideCommentStatus({ ...base, mail: 'x@casino.example', forbiddenWords: ['casino'] }),
      ).toBe('spam');
    });

    it('holds any Markdown image for review in suspicious mode', () => {
      for (const content of [
        '![](https://tracker.example/p.gif)',
        'look ![alt text]( https://cdn.example/a.png )',
        'ref ![x][img]\n\n[img]: https://cdn.example/b.png',
      ]) {
        expect(decideCommentStatus({ ...base, content })).toBe('pending');
      }
      expect(
        decideCommentStatus({ ...base, content: 'just text [a link](https://example.com)' }),
      ).toBe('approved');
      expect(
        decideCommentStatus({
          ...base,
          moderation: 'off',
          content: '![](https://x.example/p.gif)',
        }),
      ).toBe('approved');
    });

    it('follows the moderation mode', () => {
      expect(decideCommentStatus({ ...base, moderation: 'all' })).toBe('pending');
      expect(decideCommentStatus({ ...base, moderation: 'off', content: 'a'.repeat(30) })).toBe(
        'approved',
      );
      expect(decideCommentStatus({ ...base, moderation: 'suspicious' })).toBe('approved');
    });

    it('holds suspicious comments for review', () => {
      expect(
        decideCommentStatus({
          ...base,
          content: 'https://a.com https://b.com https://c.com',
        }),
      ).toBe('pending');
      expect(decideCommentStatus({ ...base, content: 'https://a.com https://b.com' })).toBe(
        'approved',
      );
      expect(decideCommentStatus({ ...base, content: `wow${'!'.repeat(16)}` })).toBe('pending');
      expect(decideCommentStatus({ ...base, images: [`${hex}.webp`] })).toBe('pending');
    });
  });
});
