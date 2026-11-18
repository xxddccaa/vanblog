import { BadRequestException } from '@nestjs/common';
import {
  AdminCommentSetting,
  COMMENT_LIMITS,
  COMMENT_MODERATION_MODES,
  CommentModerationMode,
  CommentSetting,
  defaultCommentSetting,
} from 'src/types/comment.dto';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/u;
const HOSTNAME_PATTERN = /^[A-Za-z0-9.-]+$|^\[[0-9A-Fa-f:.]+\]$/u;

export const COMMENT_CONTENT_MIN_MAX_LENGTH = 50;
const SMTP_HOST_MAX_LENGTH = 253;
const SMTP_USER_MAX_LENGTH = 254;
const SMTP_PASS_MAX_LENGTH = 512;
const SMTP_FROM_NAME_MAX_LENGTH = 64;
const WEBHOOK_MAX_LENGTH = 500;

const invalid = (field: string, message: string) =>
  new BadRequestException({
    statusCode: 400,
    message: `Invalid comment setting "${field}": ${message}`,
    code: 'COMMENT_INVALID_INPUT',
    field,
  });

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cloneDefault = (): CommentSetting => JSON.parse(JSON.stringify(defaultCommentSetting));

export function isValidCommentEmail(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= COMMENT_LIMITS.mailMaxLength &&
    !CONTROL_CHARACTERS.test(value) &&
    EMAIL_PATTERN.test(value)
  );
}

/** Accepts only absolute http(s) URLs without embedded credentials. */
export function isValidCommentWebhook(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > WEBHOOK_MAX_LENGTH) return false;
  if (CONTROL_CHARACTERS.test(value) || /\s/u.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw invalid(field, 'expected a boolean');
}

function parseInteger(value: unknown, field: string, min: number, max: number): number {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) {
    throw invalid(field, `expected an integer between ${min} and ${max}`);
  }
  return number;
}

function parseString(
  value: unknown,
  field: string,
  maxLength: number,
  options: { singleLine?: boolean } = {},
): string {
  if (typeof value !== 'string') throw invalid(field, 'expected a string');
  const normalized = value.trim();
  if (normalized.length > maxLength) throw invalid(field, `longer than ${maxLength} characters`);
  if (options.singleLine !== false && CONTROL_CHARACTERS.test(normalized)) {
    throw invalid(field, 'contains control characters');
  }
  return normalized;
}

function parseEmailOrEmpty(value: unknown, field: string): string {
  const normalized = parseString(value, field, COMMENT_LIMITS.mailMaxLength);
  if (normalized && !isValidCommentEmail(normalized)) throw invalid(field, 'not a valid email');
  return normalized;
}

/**
 * Accepts an array of words or a newline/comma separated string. Words are
 * trimmed, de-duplicated case-insensitively and capped in count and length.
 */
export function parseForbiddenWords(value: unknown, field = 'forbiddenWords'): string[] {
  let words: unknown[];
  if (Array.isArray(value)) {
    words = value;
  } else if (typeof value === 'string') {
    words = value.split(/[\n,，]/u);
  } else {
    throw invalid(field, 'expected a list of words');
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const word of words) {
    if (typeof word !== 'string') throw invalid(field, 'every word must be a string');
    const normalized = word.trim();
    if (!normalized) continue;
    if (normalized.length > COMMENT_LIMITS.forbiddenWordMaxLength) {
      throw invalid(field, `a word is longer than ${COMMENT_LIMITS.forbiddenWordMaxLength}`);
    }
    if (CONTROL_CHARACTERS.test(normalized)) throw invalid(field, 'contains control characters');
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  if (result.length > COMMENT_LIMITS.forbiddenWordsMax) {
    throw invalid(field, `more than ${COMMENT_LIMITS.forbiddenWordsMax} words`);
  }
  return result;
}

/**
 * Applies a partial update on top of `current` and validates every provided
 * field strictly. Unknown keys are ignored. Throws BadRequestException.
 *
 * SMTP password semantics: omitted or '' keeps the stored value, null clears
 * it, any other string replaces it.
 */
export function applyCommentSettingUpdate(current: CommentSetting, input: unknown): CommentSetting {
  if (!isRecord(input)) throw invalid('body', 'expected an object');
  const next: CommentSetting = JSON.parse(JSON.stringify(current));

  if (input.moderation !== undefined) {
    if (!COMMENT_MODERATION_MODES.includes(input.moderation)) {
      throw invalid('moderation', `expected one of ${COMMENT_MODERATION_MODES.join(', ')}`);
    }
    next.moderation = input.moderation as CommentModerationMode;
  }
  if (input.forbiddenWords !== undefined) {
    next.forbiddenWords = parseForbiddenWords(input.forbiddenWords);
  }
  if (input.pageSize !== undefined) {
    next.pageSize = parseInteger(
      input.pageSize,
      'pageSize',
      COMMENT_LIMITS.pageSizeMin,
      COMMENT_LIMITS.pageSizeMax,
    );
  }
  if (input.maxLength !== undefined) {
    next.maxLength = parseInteger(
      input.maxLength,
      'maxLength',
      COMMENT_CONTENT_MIN_MAX_LENGTH,
      COMMENT_LIMITS.contentHardMaxLength,
    );
  }
  for (const key of [
    'allowVisitorImage',
    'requireMail',
    'showLocation',
    'showBrowser',
    'showOs',
  ] as const) {
    if (input[key] !== undefined) next[key] = parseBoolean(input[key], key);
  }

  if (input.notify !== undefined) {
    if (!isRecord(input.notify)) throw invalid('notify', 'expected an object');
    const notify = input.notify;
    if (notify.ownerEmail !== undefined) {
      next.notify.ownerEmail = parseEmailOrEmpty(notify.ownerEmail, 'notify.ownerEmail');
    }
    for (const key of ['notifyOwner', 'notifyReply'] as const) {
      if (notify[key] !== undefined) next.notify[key] = parseBoolean(notify[key], `notify.${key}`);
    }
    if (notify.webhook !== undefined) {
      const webhook = parseString(notify.webhook, 'notify.webhook', WEBHOOK_MAX_LENGTH);
      if (webhook && !isValidCommentWebhook(webhook)) {
        throw invalid('notify.webhook', 'expected an http(s) URL without credentials');
      }
      next.notify.webhook = webhook;
    }
    if (notify.smtp !== undefined) {
      if (!isRecord(notify.smtp)) throw invalid('notify.smtp', 'expected an object');
      const smtp = notify.smtp;
      const target = next.notify.smtp;
      if (smtp.enabled !== undefined)
        target.enabled = parseBoolean(smtp.enabled, 'notify.smtp.enabled');
      if (smtp.host !== undefined) {
        const host = parseString(smtp.host, 'notify.smtp.host', SMTP_HOST_MAX_LENGTH);
        if (host && !HOSTNAME_PATTERN.test(host))
          throw invalid('notify.smtp.host', 'not a hostname');
        target.host = host;
      }
      if (smtp.port !== undefined)
        target.port = parseInteger(smtp.port, 'notify.smtp.port', 1, 65_535);
      if (smtp.secure !== undefined)
        target.secure = parseBoolean(smtp.secure, 'notify.smtp.secure');
      if (smtp.user !== undefined) {
        target.user = parseString(smtp.user, 'notify.smtp.user', SMTP_USER_MAX_LENGTH);
      }
      if (smtp.pass === null) {
        target.pass = '';
      } else if (smtp.pass !== undefined && smtp.pass !== '') {
        if (typeof smtp.pass !== 'string' || smtp.pass.length > SMTP_PASS_MAX_LENGTH) {
          throw invalid(
            'notify.smtp.pass',
            `expected a string up to ${SMTP_PASS_MAX_LENGTH} characters`,
          );
        }
        if (CONTROL_CHARACTERS.test(smtp.pass)) {
          throw invalid('notify.smtp.pass', 'contains control characters');
        }
        target.pass = smtp.pass;
      }
      if (smtp.fromName !== undefined) {
        // Header injection guard: the display name lands in the From header.
        target.fromName = parseString(
          smtp.fromName,
          'notify.smtp.fromName',
          SMTP_FROM_NAME_MAX_LENGTH,
        );
        if (/[<>"]/u.test(target.fromName)) {
          throw invalid('notify.smtp.fromName', 'must not contain <, > or "');
        }
      }
      if (smtp.fromEmail !== undefined) {
        target.fromEmail = parseEmailOrEmpty(smtp.fromEmail, 'notify.smtp.fromEmail');
      }
    }
  }

  if (next.notify.smtp.enabled) {
    if (!next.notify.smtp.host) throw invalid('notify.smtp.host', 'required when SMTP is enabled');
    if (!next.notify.smtp.fromEmail && !isValidCommentEmail(next.notify.smtp.user)) {
      throw invalid('notify.smtp.fromEmail', 'required when the SMTP user is not an email');
    }
  }
  return next;
}

/**
 * Lenient read path: merges a stored (possibly old, partial or hand-edited)
 * value with the defaults. Invalid fields fall back to their default value so
 * a broken record can never take the comment system down.
 */
export function normalizeStoredCommentSetting(value: unknown): CommentSetting {
  const result = cloneDefault();
  if (!isRecord(value)) return result;
  const attempt = (apply: () => void) => {
    try {
      apply();
    } catch {
      // Keep the default for this field.
    }
  };
  const top = value;
  const pick = (key: string) => (top[key] === undefined ? {} : { [key]: top[key] });
  for (const key of [
    'moderation',
    'forbiddenWords',
    'pageSize',
    'maxLength',
    'allowVisitorImage',
    'requireMail',
    'showLocation',
    'showBrowser',
    'showOs',
  ]) {
    attempt(() => Object.assign(result, applyCommentSettingUpdate(result, pick(key))));
  }
  if (isRecord(top.notify)) {
    const notify = top.notify;
    for (const key of ['ownerEmail', 'notifyOwner', 'notifyReply', 'webhook']) {
      if (notify[key] === undefined) continue;
      attempt(() =>
        Object.assign(
          result,
          applyCommentSettingUpdate(result, { notify: { [key]: notify[key] } }),
        ),
      );
    }
    if (isRecord(notify.smtp)) {
      const smtp = notify.smtp;
      // Apply `enabled` last so its cross-field checks see the stored values.
      for (const key of [
        'host',
        'port',
        'secure',
        'user',
        'pass',
        'fromName',
        'fromEmail',
        'enabled',
      ]) {
        if (smtp[key] === undefined) continue;
        attempt(() =>
          Object.assign(
            result,
            applyCommentSettingUpdate(result, { notify: { smtp: { [key]: smtp[key] } } }),
          ),
        );
      }
    }
  }
  return result;
}

/** Strips the SMTP password before the setting leaves the server. */
export function maskCommentSetting(setting: CommentSetting): AdminCommentSetting {
  const { pass, ...smtp } = setting.notify.smtp;
  return {
    ...setting,
    forbiddenWords: [...setting.forbiddenWords],
    notify: {
      ...setting.notify,
      smtp: { ...smtp, pass: '', passSet: Boolean(pass) },
    },
  };
}
