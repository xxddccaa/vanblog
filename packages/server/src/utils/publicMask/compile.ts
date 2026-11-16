import { createHash } from 'node:crypto';
import { BUILTIN_DETECTORS, BuiltinDetector, DetectorContext } from './builtins';
import {
  DEFAULT_PUBLIC_MASK_REPLACEMENTS,
  PublicMaskHit,
  PublicMaskReplacementKind,
  PublicMasker,
  PublicMaskSetting,
} from './types';

/** Bump when detector behavior changes so cached and generated output is rebuilt. */
export const PUBLIC_MASK_ENGINE_VERSION = 1;

export class PublicMaskCompileError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly ruleId?: string,
  ) {
    super(message);
    this.name = 'PublicMaskCompileError';
  }
}

/** Escapes a literal for use inside a RegExp source. */
export const escapeMaskLiteral = (value: string) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TEXT_DATA_URI_MIME =
  /^(?:text\/[a-z0-9.+-]+|image\/svg\+xml|application\/(?:json|xml|javascript|ecmascript|xhtml\+xml))$/i;
const DATA_URI_PATTERN =
  /data:([a-z0-9.+-]+\/[a-z0-9.+-]+)((?:;[a-z0-9.+-]+=[^;,]*)*);base64,([A-Za-z0-9+/]+={0,2})/gi;

interface CompiledCustomRule {
  id: string;
  regex: RegExp;
}

const runReplace = (
  text: string,
  regex: RegExp,
  apply: (match: string, groups: string[]) => string | null,
) => {
  regex.lastIndex = 0;
  return text.replace(regex, (...args: any[]) => {
    const match = args[0] as string;
    // Callback args: match, ...groups, offset, input (no named groups are used).
    const groups = args.slice(1, -2) as string[];
    const output = apply(match, groups);
    return output === null ? match : output;
  });
};

const normalizeForVersion = (setting: PublicMaskSetting) => ({
  engine: PUBLIC_MASK_ENGINE_VERSION,
  enabled: Boolean(setting.enabled),
  replacements: setting.replacements,
  builtins: setting.builtins,
  allowlist: [...(setting.allowlist || [])].map((item) => item.toLowerCase()).sort(),
  rules: (setting.rules || [])
    .filter((rule) => rule.enabled !== false)
    .map((rule) => ({
      type: rule.type,
      pattern: rule.pattern,
      caseSensitive: Boolean(rule.caseSensitive),
    })),
});

const buildKeywordRegex = (keywords: string[], caseSensitive: boolean) => {
  if (!keywords.length) {
    return null;
  }
  const unique = Array.from(new Set(keywords)).sort((a, b) => b.length - a.length);
  return new RegExp(unique.map(escapeMaskLiteral).join('|'), caseSensitive ? 'g' : 'gi');
};

/**
 * Compiles a validated setting into a masker. Throws PublicMaskCompileError when a
 * custom regex does not compile or when a rule would match a replacement text
 * (which would make masking non-idempotent).
 */
export const compilePublicMask = (setting: PublicMaskSetting): PublicMasker => {
  const replacements = { ...DEFAULT_PUBLIC_MASK_REPLACEMENTS, ...(setting.replacements || {}) };
  const version = createHash('sha256')
    .update(JSON.stringify(normalizeForVersion({ ...setting, replacements })))
    .digest('hex')
    .slice(0, 32);

  const enabledRules = (setting.rules || []).filter(
    (rule) => rule.enabled !== false && String(rule.pattern || '').length > 0,
  );
  const detectors = BUILTIN_DETECTORS.filter((detector) => setting.builtins?.[detector.group]);
  const active = Boolean(setting.enabled) && (detectors.length > 0 || enabledRules.length > 0);

  const allowlist = new Set((setting.allowlist || []).map((item) => item.trim().toLowerCase()));
  const contextFor = (kind: PublicMaskReplacementKind): DetectorContext => ({
    replacement: replacements[kind],
    isAllowed: (value: string) => allowlist.has(String(value || '').toLowerCase()),
  });
  const detectorContexts = new Map<BuiltinDetector, DetectorContext>(
    detectors.map((detector) => [detector, contextFor(detector.kind)]),
  );

  const insensitiveKeywords: string[] = [];
  const sensitiveKeywords: string[] = [];
  const keywordOwners = new Map<string, string>();
  const customRegexes: CompiledCustomRule[] = [];
  for (const rule of enabledRules) {
    if (rule.type === 'regex') {
      try {
        customRegexes.push({
          id: rule.id,
          regex: new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi'),
        });
      } catch (error) {
        throw new PublicMaskCompileError(
          `Invalid regex rule: ${(error as Error).message}`,
          'REGEX_INVALID',
          rule.id,
        );
      }
      continue;
    }
    const target = rule.caseSensitive ? sensitiveKeywords : insensitiveKeywords;
    target.push(rule.pattern);
    keywordOwners.set(rule.pattern.toLowerCase(), rule.id);
    // Non-ASCII keywords also appear percent-encoded inside URLs.
    if (/[^\x00-\x7f]/.test(rule.pattern)) {
      const encoded = encodeURIComponent(rule.pattern);
      insensitiveKeywords.push(encoded);
      keywordOwners.set(encoded.toLowerCase(), rule.id);
    }
  }
  const insensitiveKeywordRegex = buildKeywordRegex(insensitiveKeywords, false);
  const sensitiveKeywordRegex = buildKeywordRegex(sensitiveKeywords, true);
  const customReplacement = replacements.custom;

  const maskPlain = (text: string) => {
    let output = text;
    for (const detector of detectors) {
      if (!detector.prefilter(output)) {
        continue;
      }
      const ctx = detectorContexts.get(detector)!;
      output = runReplace(output, detector.regex, (match, groups) => {
        const result = detector.apply(match, groups, ctx);
        return result ? result.output : null;
      });
    }
    if (insensitiveKeywordRegex) {
      insensitiveKeywordRegex.lastIndex = 0;
      output = output.replace(insensitiveKeywordRegex, customReplacement);
    }
    if (sensitiveKeywordRegex) {
      sensitiveKeywordRegex.lastIndex = 0;
      output = output.replace(sensitiveKeywordRegex, customReplacement);
    }
    for (const rule of customRegexes) {
      rule.regex.lastIndex = 0;
      output = output.replace(rule.regex, (match) => (match ? customReplacement : match));
    }
    return output;
  };

  /**
   * Masks text while keeping base64 data URIs intact: textual payloads (SVG, JSON,
   * plain text) are decoded, masked, and re-encoded; binary payloads are left as-is
   * so images are never corrupted by a coincidental match inside base64.
   */
  const mask = (text: string) => {
    if (!active || typeof text !== 'string' || !text) {
      return text;
    }
    if (!text.includes('data:')) {
      return maskPlain(text);
    }
    let result = '';
    let cursor = 0;
    DATA_URI_PATTERN.lastIndex = 0;
    let found: RegExpExecArray | null;
    while ((found = DATA_URI_PATTERN.exec(text))) {
      result += maskPlain(text.slice(cursor, found.index));
      const [whole, mime, params, payload] = found;
      if (TEXT_DATA_URI_MIME.test(mime)) {
        const decoded = Buffer.from(payload, 'base64').toString('utf8');
        const masked = maskPlain(decoded);
        result +=
          masked === decoded
            ? whole
            : `data:${mime}${params};base64,${Buffer.from(masked, 'utf8').toString('base64')}`;
      } else {
        result += whole;
      }
      cursor = found.index + whole.length;
    }
    result += maskPlain(text.slice(cursor));
    return result;
  };

  const findHits = (text: string, limit = 50): PublicMaskHit[] => {
    if (!active || typeof text !== 'string' || !text) {
      return [];
    }
    const hits: PublicMaskHit[] = [];
    const push = (hit: PublicMaskHit) => {
      if (hits.length < limit) {
        hits.push(hit);
      }
    };
    for (const detector of detectors) {
      if (hits.length >= limit) break;
      if (!detector.prefilter(text)) continue;
      const ctx = detectorContexts.get(detector)!;
      detector.regex.lastIndex = 0;
      for (const found of text.matchAll(detector.regex)) {
        const result = detector.apply(found[0], found.slice(1) as string[], ctx);
        if (result) {
          push({
            kind: detector.kind,
            source: detector.id,
            match: result.hit,
            index: found.index ?? 0,
          });
        }
        if (hits.length >= limit) break;
      }
    }
    for (const regex of [insensitiveKeywordRegex, sensitiveKeywordRegex]) {
      if (!regex || hits.length >= limit) continue;
      regex.lastIndex = 0;
      for (const found of text.matchAll(regex)) {
        push({
          kind: 'custom',
          source: keywordOwners.get(found[0].toLowerCase()) || 'keyword',
          match: found[0],
          index: found.index ?? 0,
        });
        if (hits.length >= limit) break;
      }
    }
    for (const rule of customRegexes) {
      if (hits.length >= limit) break;
      rule.regex.lastIndex = 0;
      for (const found of text.matchAll(rule.regex)) {
        if (found[0]) {
          push({ kind: 'custom', source: rule.id, match: found[0], index: found.index ?? 0 });
        }
        if (hits.length >= limit) break;
      }
    }
    return hits.sort((a, b) => a.index - b.index);
  };

  const masker: PublicMasker = {
    version,
    active,
    updatedAt: setting.updatedAt,
    mask,
    hasHit: (text: string) =>
      active && typeof text === 'string' && text ? mask(text) !== text : false,
    findHits,
  };

  if (active) {
    // Use findHits rather than comparing mask output: a replacement that contains a
    // masked term (e.g. keyword "hidden" with replacement "HIDDEN") masks to itself
    // but would still put the term into public output.
    for (const [kind, replacement] of Object.entries(replacements)) {
      if (masker.mask(replacement) !== replacement || findHits(replacement, 1).length > 0) {
        throw new PublicMaskCompileError(
          `A rule matches the "${kind}" replacement text`,
          'REPLACEMENT_MATCHED',
        );
      }
    }
  }

  return masker;
};

/** A masker that never changes anything; used when masking is disabled. */
export const INACTIVE_PUBLIC_MASKER: PublicMasker = {
  version: 'inactive',
  active: false,
  mask: (text: string) => text,
  hasHit: () => false,
  findHits: () => [],
};
