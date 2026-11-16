import { randomUUID } from 'node:crypto';
import { compilePublicMask, PublicMaskCompileError } from './compile';
import {
  DEFAULT_PUBLIC_MASK_REPLACEMENTS,
  defaultPublicMaskSetting,
  PUBLIC_MASK_LIMITS,
  PublicMaskBuiltins,
  PublicMaskReplacementKind,
  PublicMaskRule,
  PublicMaskSetting,
} from './types';

export type PublicMaskValidationCode =
  | 'TOO_MANY_RULES'
  | 'KEYWORD_TOO_SHORT'
  | 'KEYWORD_TOO_LONG'
  | 'KEYWORD_DUPLICATE'
  | 'REGEX_TOO_LONG'
  | 'REGEX_INVALID'
  | 'REGEX_MATCHES_EMPTY'
  | 'REGEX_NESTED_QUANTIFIER'
  | 'REGEX_TOO_SLOW'
  | 'REPLACEMENT_INVALID'
  | 'REPLACEMENT_MATCHED'
  | 'TOO_MANY_ALLOWLIST_ITEMS'
  | 'ALLOWLIST_ITEM_TOO_LONG';

export interface PublicMaskValidationError {
  code: PublicMaskValidationCode;
  ruleId?: string;
  field?: string;
  detail?: string;
}

// Characters that would turn the replacement into Markdown or HTML syntax.
const UNSAFE_REPLACEMENT_CHARS = /[*_[\]()<>#~|\\!&"'`\r\n]/;

// A quantified group that itself contains a quantifier, e.g. (a+)+ or (\w*)*.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[*+](?:[^()\\]|\\.)*\)(?:[*+]|\{\d+,\d*\})/;

const SLOW_REGEX_BUDGET_MS = 25;

/**
 * Runs the regex against inputs that commonly trigger catastrophic backtracking and
 * rejects it when matching time grows past the budget. Inputs grow gradually so a
 * pathological pattern is caught before it can stall the process for long.
 */
const isRegexTooSlow = (regex: RegExp) => {
  const probes = ['a', '0', ' ', 'aa', 'a0', '-a', '.a', 'a@'];
  for (const length of [8, 12, 16, 20, 24]) {
    for (const probe of probes) {
      const input = `${probe.repeat(length)}!`;
      const started = process.hrtime.bigint();
      regex.lastIndex = 0;
      regex.test(input);
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      if (elapsedMs > SLOW_REGEX_BUDGET_MS) {
        return true;
      }
    }
  }
  return false;
};

const toBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean'
    ? value
    : value === 'true'
      ? true
      : value === 'false'
        ? false
        : fallback;

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeRule = (input: any): PublicMaskRule => ({
  id: toTrimmedString(input?.id).slice(0, 64) || randomUUID(),
  enabled: toBoolean(input?.enabled, true),
  type: input?.type === 'regex' ? 'regex' : 'keyword',
  pattern: toTrimmedString(input?.pattern),
  caseSensitive: toBoolean(input?.caseSensitive, false),
  note: toTrimmedString(input?.note).slice(0, PUBLIC_MASK_LIMITS.noteMaxLength) || undefined,
});

/** Normalizes untrusted input into a setting without validating rule contents. */
export const normalizePublicMaskSetting = (input: any): PublicMaskSetting => {
  const builtins = {} as PublicMaskBuiltins;
  for (const key of Object.keys(defaultPublicMaskSetting.builtins) as Array<
    keyof PublicMaskBuiltins
  >) {
    builtins[key] = toBoolean(input?.builtins?.[key], defaultPublicMaskSetting.builtins[key]);
  }
  const replacements = { ...DEFAULT_PUBLIC_MASK_REPLACEMENTS };
  for (const key of Object.keys(DEFAULT_PUBLIC_MASK_REPLACEMENTS) as PublicMaskReplacementKind[]) {
    const value = toTrimmedString(input?.replacements?.[key]);
    if (value) {
      replacements[key] = value;
    }
  }
  const allowlistSource = Array.isArray(input?.allowlist)
    ? input.allowlist
    : defaultPublicMaskSetting.allowlist;
  const allowlist = Array.from(
    new Set<string>(allowlistSource.map(toTrimmedString).filter(Boolean)),
  );
  const rules = (Array.isArray(input?.rules) ? input.rules : [])
    .map(normalizeRule)
    .filter((rule) => rule.pattern.length > 0);
  return {
    enabled: toBoolean(input?.enabled, defaultPublicMaskSetting.enabled),
    replacements,
    rules,
    builtins,
    allowlist,
    updatedAt: toTrimmedString(input?.updatedAt) || undefined,
  };
};

/**
 * Normalizes and validates a setting. The returned value is only safe to persist
 * when `errors` is empty.
 */
export const validatePublicMaskSetting = (
  input: any,
): { value: PublicMaskSetting; errors: PublicMaskValidationError[] } => {
  const value = normalizePublicMaskSetting(input);
  const errors: PublicMaskValidationError[] = [];

  if (value.rules.length > PUBLIC_MASK_LIMITS.maxRules) {
    errors.push({ code: 'TOO_MANY_RULES' });
  }

  const seenKeywords = new Set<string>();
  for (const rule of value.rules) {
    if (rule.type === 'keyword') {
      const length = Array.from(rule.pattern).length;
      if (length < PUBLIC_MASK_LIMITS.keywordMinLength) {
        errors.push({ code: 'KEYWORD_TOO_SHORT', ruleId: rule.id });
      } else if (length > PUBLIC_MASK_LIMITS.keywordMaxLength) {
        errors.push({ code: 'KEYWORD_TOO_LONG', ruleId: rule.id });
      }
      const key = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
      if (seenKeywords.has(key)) {
        errors.push({ code: 'KEYWORD_DUPLICATE', ruleId: rule.id });
      }
      seenKeywords.add(key);
      continue;
    }
    if (rule.pattern.length > PUBLIC_MASK_LIMITS.regexMaxLength) {
      errors.push({ code: 'REGEX_TOO_LONG', ruleId: rule.id });
      continue;
    }
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi');
    } catch (error) {
      errors.push({ code: 'REGEX_INVALID', ruleId: rule.id, detail: (error as Error).message });
      continue;
    }
    if (new RegExp(rule.pattern, rule.caseSensitive ? '' : 'i').test('')) {
      errors.push({ code: 'REGEX_MATCHES_EMPTY', ruleId: rule.id });
      continue;
    }
    if (NESTED_QUANTIFIER.test(rule.pattern)) {
      errors.push({ code: 'REGEX_NESTED_QUANTIFIER', ruleId: rule.id });
      continue;
    }
    if (isRegexTooSlow(regex)) {
      errors.push({ code: 'REGEX_TOO_SLOW', ruleId: rule.id });
    }
  }

  for (const [kind, replacement] of Object.entries(value.replacements)) {
    const length = Array.from(replacement).length;
    if (
      length < 1 ||
      length > PUBLIC_MASK_LIMITS.replacementMaxLength ||
      UNSAFE_REPLACEMENT_CHARS.test(replacement)
    ) {
      errors.push({ code: 'REPLACEMENT_INVALID', field: `replacements.${kind}` });
    }
  }

  if (value.allowlist.length > PUBLIC_MASK_LIMITS.maxAllowlist) {
    errors.push({ code: 'TOO_MANY_ALLOWLIST_ITEMS' });
  }
  if (value.allowlist.some((item) => item.length > PUBLIC_MASK_LIMITS.allowlistItemMaxLength)) {
    errors.push({ code: 'ALLOWLIST_ITEM_TOO_LONG' });
  }

  if (!errors.length) {
    try {
      // Compile with masking forced on so replacement collisions are caught even
      // while the feature is still disabled.
      compilePublicMask({ ...value, enabled: true });
    } catch (error) {
      if (error instanceof PublicMaskCompileError) {
        errors.push({
          code: error.code as PublicMaskValidationCode,
          ruleId: error.ruleId,
          detail: error.message,
        });
      } else {
        throw error;
      }
    }
  }

  return { value, errors };
};
