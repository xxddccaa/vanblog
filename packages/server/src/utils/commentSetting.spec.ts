import { BadRequestException } from '@nestjs/common';
import { defaultCommentSetting } from 'src/types/comment.dto';
import {
  applyCommentSettingUpdate,
  maskCommentSetting,
  normalizeStoredCommentSetting,
  parseForbiddenWords,
} from './commentSetting';

const base = () => normalizeStoredCommentSetting(undefined);

describe('comment setting', () => {
  it('returns a copy of the defaults when nothing is stored', () => {
    const value = base();
    expect(value).toEqual(defaultCommentSetting);
    value.forbiddenWords.push('x');
    expect(defaultCommentSetting.forbiddenWords).toEqual([]);
  });

  it('falls back per field when a stored value is invalid', () => {
    const value = normalizeStoredCommentSetting({
      moderation: 'everything',
      pageSize: 999,
      maxLength: 8000,
      showOs: false,
      notify: { ownerEmail: 'not-an-email', notifyReply: false, smtp: { enabled: true } },
    });
    expect(value.moderation).toBe('suspicious');
    expect(value.pageSize).toBe(10);
    expect(value.maxLength).toBe(8000);
    expect(value.showOs).toBe(false);
    expect(value.notify.ownerEmail).toBe('');
    expect(value.notify.notifyReply).toBe(false);
    // Enabling SMTP without a host is rejected, so it stays disabled.
    expect(value.notify.smtp.enabled).toBe(false);
  });

  it('keeps a stored SMTP configuration including the password', () => {
    const value = normalizeStoredCommentSetting({
      notify: {
        smtp: {
          enabled: true,
          host: 'smtp.example.com',
          port: 465,
          user: 'blog@example.com',
          pass: 'secret',
        },
      },
    });
    expect(value.notify.smtp).toMatchObject({
      enabled: true,
      host: 'smtp.example.com',
      pass: 'secret',
    });
  });

  it('rejects invalid updates with a coded 400', () => {
    for (const input of [
      null,
      { moderation: 'later' },
      { pageSize: 4 },
      { pageSize: 1.5 },
      { maxLength: 20_001 },
      { requireMail: 'yes' },
      { notify: { ownerEmail: 'a@b' } },
      { notify: { webhook: 'ftp://example.com/hook' } },
      { notify: { webhook: 'https://user:pw@example.com/hook' } },
      { notify: { smtp: { port: 0 } } },
      { notify: { smtp: { host: 'smtp.example.com\r\nX: y' } } },
      { notify: { smtp: { fromName: 'Blog <evil@example.com>' } } },
      { notify: { smtp: { enabled: true } } },
    ]) {
      let error: unknown;
      try {
        applyCommentSettingUpdate(base(), input);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'COMMENT_INVALID_INPUT',
      });
    }
  });

  it('merges partial updates without touching other fields', () => {
    const next = applyCommentSettingUpdate(base(), {
      moderation: 'all',
      notify: { webhook: 'https://hooks.example.com/comment' },
    });
    expect(next.moderation).toBe('all');
    expect(next.notify.webhook).toBe('https://hooks.example.com/comment');
    expect(next.pageSize).toBe(defaultCommentSetting.pageSize);
    expect(next.notify.smtp).toEqual(defaultCommentSetting.notify.smtp);
  });

  it('keeps, replaces and clears the SMTP password', () => {
    const withPass = applyCommentSettingUpdate(base(), {
      notify: { smtp: { host: 'smtp.example.com', pass: 'one' } },
    });
    expect(withPass.notify.smtp.pass).toBe('one');
    expect(
      applyCommentSettingUpdate(withPass, { notify: { smtp: { pass: '' } } }).notify.smtp.pass,
    ).toBe('one');
    expect(applyCommentSettingUpdate(withPass, { notify: { smtp: {} } }).notify.smtp.pass).toBe(
      'one',
    );
    expect(
      applyCommentSettingUpdate(withPass, { notify: { smtp: { pass: 'two' } } }).notify.smtp.pass,
    ).toBe('two');
    expect(
      applyCommentSettingUpdate(withPass, { notify: { smtp: { pass: null } } }).notify.smtp.pass,
    ).toBe('');
  });

  it('requires a sender address when the SMTP user is not an email', () => {
    expect(() =>
      applyCommentSettingUpdate(base(), {
        notify: { smtp: { enabled: true, host: 'smtp.example.com', user: 'apikey' } },
      }),
    ).toThrow(BadRequestException);
    const ok = applyCommentSettingUpdate(base(), {
      notify: {
        smtp: {
          enabled: true,
          host: 'smtp.example.com',
          user: 'apikey',
          fromEmail: 'blog@example.com',
        },
      },
    });
    expect(ok.notify.smtp.enabled).toBe(true);
  });

  it('never echoes the SMTP password', () => {
    const value = applyCommentSettingUpdate(base(), {
      notify: { smtp: { host: 'smtp.example.com', pass: 'secret' } },
    });
    const masked = maskCommentSetting(value);
    expect(masked.notify.smtp.pass).toBe('');
    expect(masked.notify.smtp.passSet).toBe(true);
    expect(JSON.stringify(masked)).not.toContain('secret');
    expect(maskCommentSetting(base()).notify.smtp.passSet).toBe(false);
  });

  it('parses forbidden words from lists and text', () => {
    expect(parseForbiddenWords(' spam ,Spam\nads，casino\n\n')).toEqual(['spam', 'ads', 'casino']);
    expect(parseForbiddenWords(['a', ' b '])).toEqual(['a', 'b']);
    expect(() => parseForbiddenWords([1])).toThrow(BadRequestException);
    expect(() => parseForbiddenWords(['x'.repeat(65)])).toThrow(BadRequestException);
    expect(() => parseForbiddenWords(Array.from({ length: 501 }, (_, i) => `w${i}`))).toThrow(
      BadRequestException,
    );
  });
});
