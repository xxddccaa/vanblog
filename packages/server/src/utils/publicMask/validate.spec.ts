import { normalizePublicMaskSetting, validatePublicMaskSetting } from './validate';
import { DEFAULT_PUBLIC_MASK_REPLACEMENTS, defaultPublicMaskSetting } from './types';

const rule = (pattern: string, type: 'keyword' | 'regex' = 'keyword', id = pattern) => ({
  id,
  enabled: true,
  type,
  pattern,
});

const codesOf = (input: any) => validatePublicMaskSetting(input).errors.map((error) => error.code);

describe('normalizePublicMaskSetting', () => {
  it('fills defaults for missing input', () => {
    const value = normalizePublicMaskSetting(undefined);
    expect(value.enabled).toBe(false);
    expect(value.builtins).toEqual(defaultPublicMaskSetting.builtins);
    expect(value.replacements).toEqual(DEFAULT_PUBLIC_MASK_REPLACEMENTS);
    expect(value.allowlist).toEqual(defaultPublicMaskSetting.allowlist);
  });

  it('trims patterns, drops empty rules, and assigns ids', () => {
    const value = normalizePublicMaskSetting({
      rules: [{ pattern: '  acmecore  ' }, { pattern: '   ' }],
    });
    expect(value.rules).toHaveLength(1);
    expect(value.rules[0].pattern).toBe('acmecore');
    expect(value.rules[0].type).toBe('keyword');
    expect(value.rules[0].id).toEqual(expect.any(String));
  });

  it('accepts string booleans from form posts', () => {
    const value = normalizePublicMaskSetting({ enabled: 'true', builtins: { email: 'false' } });
    expect(value.enabled).toBe(true);
    expect(value.builtins.email).toBe(false);
  });
});

describe('validatePublicMaskSetting', () => {
  it('accepts a typical setting', () => {
    expect(
      codesOf({ enabled: true, rules: [rule('acmecore'), rule('node-\\d+', 'regex')] }),
    ).toEqual([]);
  });

  it('rejects keywords that are too short or duplicated', () => {
    expect(codesOf({ rules: [rule('a')] })).toContain('KEYWORD_TOO_SHORT');
    expect(
      codesOf({ rules: [rule('Acme', 'keyword', '1'), rule('acme', 'keyword', '2')] }),
    ).toContain('KEYWORD_DUPLICATE');
  });

  it('rejects invalid, empty-matching, and backtracking-prone regexes', () => {
    expect(codesOf({ rules: [rule('(unclosed', 'regex')] })).toContain('REGEX_INVALID');
    expect(codesOf({ rules: [rule('x*', 'regex')] })).toContain('REGEX_MATCHES_EMPTY');
    expect(codesOf({ rules: [rule('(a+)+b', 'regex')] })).toContain('REGEX_NESTED_QUANTIFIER');
    expect(codesOf({ rules: [rule('x'.repeat(600), 'regex')] })).toContain('REGEX_TOO_LONG');
  });

  it('rejects replacements that would become Markdown or HTML', () => {
    expect(codesOf({ replacements: { custom: '[hidden]' } })).toContain('REPLACEMENT_INVALID');
    expect(codesOf({ replacements: { custom: '***' } })).toContain('REPLACEMENT_INVALID');
    expect(codesOf({ replacements: { custom: 'x'.repeat(40) } })).toContain('REPLACEMENT_INVALID');
  });

  it('rejects rules that would match a replacement, even while disabled', () => {
    expect(
      codesOf({ enabled: false, replacements: { custom: 'HIDDEN' }, rules: [rule('hidden')] }),
    ).toContain('REPLACEMENT_MATCHED');
  });
});
