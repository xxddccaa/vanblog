import { describe, expect, it } from 'vitest';
import {
  buildCommentListParams,
  buildGeneralSettingBody,
  buildNotifySettingBody,
  CommentApiError,
  commentSettingToGeneralValues,
  commentSettingToNotifyValues,
  describeBatchFailures,
  formatCommentError,
  getActionTargetStatus,
  getCommentExcerpt,
  getCommentPublicHref,
  getCommentResponseError,
  getCommentRowActions,
  getCommentStatusCount,
  getCommentStatusMeta,
  getSafeExternalLink,
  getSafeSitePath,
  isSmtpPasswordSet,
  normalizeCommentStatusFilter,
  parseForbiddenWordsInput,
  resolveSmtpPassUpdate,
  unwrapCommentResponse,
  validateEmailOrEmpty,
  validateForbiddenWords,
  validateFromName,
  validateMaxLength,
  validatePageSize,
  validateSmtpHost,
  validateSmtpPort,
  validateSmtpRequirements,
  validateWebhook,
} from './comment';
import type { AdminCommentSetting } from './comment';

const setting: AdminCommentSetting = {
  moderation: 'all',
  forbiddenWords: ['spam', 'casino'],
  pageSize: 20,
  maxLength: 3000,
  allowVisitorImage: false,
  requireMail: true,
  showLocation: false,
  showBrowser: true,
  showOs: false,
  notify: {
    ownerEmail: 'owner@example.com',
    notifyOwner: true,
    notifyReply: false,
    webhook: 'https://hooks.example.com/x',
    smtp: {
      enabled: true,
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'mailer@example.com',
      pass: '',
      passSet: true,
      fromName: 'Blog',
      fromEmail: '',
    },
  },
};

describe('comment status mapping', () => {
  it('maps statuses to labels and normalizes unknown filters to all', () => {
    expect(getCommentStatusMeta('pending')).toEqual({ text: '待审核', color: 'processing' });
    expect(getCommentStatusMeta('spam').text).toBe('垃圾');
    expect(getCommentStatusMeta('weird').color).toBe('default');
    expect(normalizeCommentStatusFilter('deleted')).toBe('deleted');
    expect(normalizeCommentStatusFilter('all')).toBe('all');
    expect(normalizeCommentStatusFilter('bogus')).toBe('all');
    expect(normalizeCommentStatusFilter(undefined)).toBe('all');
  });

  it('reads tab counts from stats', () => {
    const stats = { pending: 3, approved: 10, spam: 1, deleted: 0, total: 14, recent: [] };
    expect(getCommentStatusCount(stats, 'all')).toBe(14);
    expect(getCommentStatusCount(stats, 'pending')).toBe(3);
    expect(getCommentStatusCount(stats, 'deleted')).toBe(0);
    expect(getCommentStatusCount(null, 'pending')).toBeUndefined();
    expect(getCommentStatusCount({ pending: -1 }, 'pending')).toBeUndefined();
  });

  it('offers row actions that fit the comment state', () => {
    expect(getCommentRowActions({ status: 'pending', parentId: null, pinned: false })).toEqual([
      'approve',
      'spam',
      'pin',
      'edit',
      'reply',
      'delete',
      'purge',
    ]);
    expect(getCommentRowActions({ status: 'approved', parentId: null, pinned: true })).toEqual([
      'spam',
      'pending',
      'unpin',
      'edit',
      'reply',
      'delete',
      'purge',
    ]);
    // Replies cannot be pinned and spam is not replied to.
    expect(getCommentRowActions({ status: 'spam', parentId: 4, pinned: false })).toEqual([
      'approve',
      'pending',
      'edit',
      'delete',
      'purge',
    ]);
    expect(getCommentRowActions({ status: 'deleted', parentId: null, pinned: false })).toEqual([
      'restore',
      'purge',
    ]);
  });

  it('maps status actions to the PATCH status', () => {
    expect(getActionTargetStatus('approve')).toBe('approved');
    expect(getActionTargetStatus('spam')).toBe('spam');
    expect(getActionTargetStatus('pending')).toBe('pending');
    expect(getActionTargetStatus('restore')).toBe('pending');
    expect(getActionTargetStatus('delete')).toBeUndefined();
  });
});

describe('comment list query', () => {
  it('omits empty filters and the all status', () => {
    expect(
      buildCommentListParams({ current: 2, pageSize: 50, status: 'all', search: '  ' }),
    ).toEqual({ page: 2, pageSize: 50 });
  });

  it('passes status, trimmed search and target', () => {
    expect(
      buildCommentListParams({
        current: 1,
        pageSize: 20,
        status: 'pending',
        search: ' 1.2.3.4 ',
        target: 'post:12',
      }),
    ).toEqual({ page: 1, pageSize: 20, status: 'pending', search: '1.2.3.4', target: 'post:12' });
  });

  it('clamps paging and search length', () => {
    const params = buildCommentListParams({ current: 0, pageSize: 1000, search: 'x'.repeat(300) });
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(100);
    expect(String(params.search)).toHaveLength(100);
  });
});

describe('untrusted visitor data', () => {
  it('accepts only http(s) visitor links', () => {
    expect(getSafeExternalLink('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(getSafeExternalLink('http://example.com')).toBe('http://example.com/');
    expect(getSafeExternalLink('javascript:alert(1)')).toBe('');
    expect(getSafeExternalLink(' JavaScript:alert(1)')).toBe('');
    expect(getSafeExternalLink('data:text/html,<script>')).toBe('');
    expect(getSafeExternalLink('//evil.example.com')).toBe('');
    expect(getSafeExternalLink('https://user:pw@example.com')).toBe('');
    expect(getSafeExternalLink('https://exa mple.com')).toBe('');
    expect(getSafeExternalLink(undefined)).toBe('');
  });

  it('accepts only site-relative target paths', () => {
    expect(getSafeSitePath('/post/hello')).toBe('/post/hello');
    expect(getSafeSitePath('//evil.example.com/x')).toBe('');
    expect(getSafeSitePath('/\\evil.example.com')).toBe('');
    expect(getSafeSitePath('javascript:alert(1)')).toBe('');
    expect(getSafeSitePath('https://example.com/post/1')).toBe('');
  });

  it('builds a deep link to the comment on the public page', () => {
    expect(getCommentPublicHref({ id: 7, targetUrl: '/post/hello', targetAvailable: true })).toBe(
      '/post/hello#comment-7',
    );
    expect(getCommentPublicHref({ id: 7, targetUrl: '/about#x', targetAvailable: true })).toBe(
      '/about#comment-7',
    );
    expect(getCommentPublicHref({ id: 7, targetUrl: '/post/gone', targetAvailable: false })).toBe(
      '',
    );
    expect(getCommentPublicHref({ id: 7, targetUrl: '', targetAvailable: true })).toBe('');
  });

  it('collapses whitespace in excerpts', () => {
    expect(getCommentExcerpt('a\n\n  b\tc')).toBe('a b c');
    expect(getCommentExcerpt('x'.repeat(10), 4)).toBe('xxxx…');
    expect(getCommentExcerpt(null)).toBe('');
  });
});

describe('comment API errors', () => {
  it('unwraps successful envelopes', () => {
    expect(unwrapCommentResponse({ statusCode: 200, data: { ok: 1 } })).toEqual({ ok: 1 });
    expect(getCommentResponseError({ statusCode: 200, data: null })).toBeNull();
  });

  it('throws structured errors with code, field and retry hint', () => {
    const body = {
      statusCode: 400,
      message: 'Invalid comment setting "pageSize": expected an integer between 5 and 50',
      code: 'COMMENT_INVALID_INPUT',
      field: 'pageSize',
    };
    expect(() => unwrapCommentResponse(body)).toThrow(CommentApiError);
    const error = getCommentResponseError(body)!;
    expect(error.code).toBe('COMMENT_INVALID_INPUT');
    expect(formatCommentError(error)).toBe(
      '输入内容不合法（每页条数）：Invalid comment setting "pageSize": expected an integer between 5 and 50',
    );

    const limited = getCommentResponseError({
      statusCode: 429,
      message: 'Too many',
      code: 'COMMENT_RATE_LIMITED',
      retryAfterSeconds: 30,
    });
    expect(formatCommentError(limited)).toBe('操作过于频繁，请稍后再试：请 30 秒后重试：Too many');
  });

  it('describes auth failures and non-API errors', () => {
    const forbidden = getCommentResponseError({ statusCode: 403, message: 'Forbidden resource' });
    expect(formatCommentError(forbidden, '加载失败')).toBe('权限不足');
    expect(formatCommentError(getCommentResponseError('<html>'), '加载失败')).toBe(
      '加载失败：服务器返回了无法识别的响应',
    );
    expect(formatCommentError(new Error('network down'), '加载失败')).toBe(
      '加载失败：network down',
    );
    expect(formatCommentError(undefined, '加载失败')).toBe('加载失败');
  });

  it('localizes batch failures by code', () => {
    expect(
      describeBatchFailures({
        updated: 1,
        failed: [
          { id: 3, reason: 'COMMENT_NOT_FOUND' },
          { id: 4, reason: 'only root comments can be pinned' },
        ],
      }),
    ).toEqual([
      { id: 3, reason: '评论不存在或已被彻底删除' },
      { id: 4, reason: 'only root comments can be pinned' },
    ]);
    expect(describeBatchFailures(null)).toEqual([]);
  });
});

describe('comment setting form transforms', () => {
  it('converts the stored setting to form values', () => {
    expect(commentSettingToGeneralValues(setting)).toEqual({
      moderation: 'all',
      forbiddenWords: 'spam\ncasino',
      pageSize: 20,
      maxLength: 3000,
      allowVisitorImage: false,
      requireMail: true,
      showLocation: false,
      showBrowser: true,
      showOs: false,
    });
    const notify = commentSettingToNotifyValues(setting);
    expect(notify.smtpHost).toBe('smtp.example.com');
    expect(notify.smtpPort).toBe(587);
    expect(notify.smtpPass).toBe('');
    expect(isSmtpPasswordSet(setting)).toBe(true);
  });

  it('falls back to contract defaults when the setting is missing', () => {
    expect(commentSettingToGeneralValues(null).moderation).toBe('suspicious');
    expect(commentSettingToGeneralValues(null).pageSize).toBe(10);
    expect(commentSettingToNotifyValues(undefined).smtpPort).toBe(465);
    expect(isSmtpPasswordSet(null)).toBe(false);
  });

  it('round-trips the general section into a PUT body', () => {
    const body = buildGeneralSettingBody({
      ...commentSettingToGeneralValues(setting),
      forbiddenWords: ' spam \n\nSPAM\ncasino\uFF0Cpoker\n',
      pageSize: '15' as unknown as number,
    });
    expect(body).toEqual({
      moderation: 'all',
      forbiddenWords: ['spam', 'casino', 'poker'],
      pageSize: 15,
      maxLength: 3000,
      allowVisitorImage: false,
      requireMail: true,
      showLocation: false,
      showBrowser: true,
      showOs: false,
    });
  });

  it('never sends fields that are missing from the form', () => {
    expect(buildGeneralSettingBody({ showOs: true })).toEqual({ showOs: true });
    expect(buildNotifySettingBody({ ownerEmail: ' a@b.co ' }, { clearPassword: false })).toEqual({
      notify: { ownerEmail: 'a@b.co', smtp: {} },
    });
  });

  it('parses forbidden words from lines and commas', () => {
    expect(parseForbiddenWordsInput('a\nb, c\n\n A ')).toEqual(['a', 'b', 'c']);
    expect(parseForbiddenWordsInput(undefined)).toEqual([]);
  });
});

describe('write-only SMTP password', () => {
  const values = { ...commentSettingToNotifyValues(setting) };

  it('keeps the stored password when the field is left empty', () => {
    expect(resolveSmtpPassUpdate({ typed: '', clear: false })).toBeUndefined();
    expect(resolveSmtpPassUpdate({ typed: undefined, clear: false })).toBeUndefined();
    const body = buildNotifySettingBody(values, { clearPassword: false });
    expect(body.notify.smtp).not.toHaveProperty('pass');
  });

  it('replaces the password with a typed value without trimming it', () => {
    expect(resolveSmtpPassUpdate({ typed: ' secret ', clear: false })).toBe(' secret ');
    const body = buildNotifySettingBody({ ...values, smtpPass: 'n3w' }, { clearPassword: false });
    expect(body.notify.smtp.pass).toBe('n3w');
  });

  it('sends null when the password is explicitly cleared', () => {
    expect(resolveSmtpPassUpdate({ typed: 'ignored', clear: true })).toBeNull();
    const body = buildNotifySettingBody(values, { clearPassword: true });
    expect(body.notify.smtp.pass).toBeNull();
  });

  it('maps every notify field into the nested body', () => {
    const body = buildNotifySettingBody(values, { clearPassword: false });
    expect(body).toEqual({
      notify: {
        ownerEmail: 'owner@example.com',
        notifyOwner: true,
        notifyReply: false,
        webhook: 'https://hooks.example.com/x',
        smtp: {
          enabled: true,
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          user: 'mailer@example.com',
          fromName: 'Blog',
          fromEmail: '',
        },
      },
    });
  });
});

describe('comment setting validators', () => {
  it('validates numeric ranges like the server', () => {
    expect(validatePageSize(5)).toBe('');
    expect(validatePageSize(50)).toBe('');
    expect(validatePageSize(4)).not.toBe('');
    expect(validatePageSize(10.5)).not.toBe('');
    expect(validateMaxLength(50)).toBe('');
    expect(validateMaxLength(20000)).toBe('');
    expect(validateMaxLength(20001)).not.toBe('');
    expect(validateSmtpPort(465)).toBe('');
    expect(validateSmtpPort(0)).not.toBe('');
    expect(validateSmtpPort(70000)).not.toBe('');
  });

  it('validates forbidden words', () => {
    expect(validateForbiddenWords('a\nb')).toBe('');
    expect(validateForbiddenWords('x'.repeat(65))).not.toBe('');
    expect(
      validateForbiddenWords(Array.from({ length: 501 }, (_, i) => `w${i}`).join('\n')),
    ).not.toBe('');
  });

  it('validates emails, webhooks and hosts', () => {
    expect(validateEmailOrEmpty('')).toBe('');
    expect(validateEmailOrEmpty('a@b.co')).toBe('');
    expect(validateEmailOrEmpty('not-an-email')).not.toBe('');
    expect(validateWebhook('')).toBe('');
    expect(validateWebhook('https://hooks.example.com/a')).toBe('');
    expect(validateWebhook('ftp://example.com')).not.toBe('');
    expect(validateWebhook('https://u:p@example.com')).not.toBe('');
    expect(validateWebhook('javascript:alert(1)')).not.toBe('');
    expect(validateSmtpHost('smtp.example.com')).toBe('');
    expect(validateSmtpHost('[::1]')).toBe('');
    expect(validateSmtpHost('smtp://example.com')).not.toBe('');
    expect(validateFromName('My Blog')).toBe('');
    expect(validateFromName('Evil <x@y.z>')).not.toBe('');
  });

  it('requires host and a sender address only when SMTP is enabled', () => {
    expect(validateSmtpRequirements({ smtpEnabled: false })).toEqual({});
    expect(
      validateSmtpRequirements({ smtpEnabled: true, smtpHost: '', smtpUser: 'login' }),
    ).toEqual({
      smtpHost: expect.any(String),
      smtpFromEmail: expect.any(String),
    });
    expect(
      validateSmtpRequirements({ smtpEnabled: true, smtpHost: 'h', smtpUser: 'a@b.co' }),
    ).toEqual({});
  });
});
