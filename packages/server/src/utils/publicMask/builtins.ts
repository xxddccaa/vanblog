import { isIPv6 } from 'node:net';
import { PublicMaskBuiltins, PublicMaskReplacementKind } from './types';

export interface DetectorContext {
  replacement: string;
  isAllowed: (value: string) => boolean;
}

export interface DetectorResult {
  /** Text that replaces the whole regex match. */
  output: string;
  /** The sensitive part of the match, used for hit reports and the allowlist. */
  hit: string;
}

export interface BuiltinDetector {
  id: string;
  group: keyof PublicMaskBuiltins;
  kind: PublicMaskReplacementKind;
  /** Cheap check that skips the regex for texts that cannot match. */
  prefilter: (text: string) => boolean;
  regex: RegExp;
  /** Returns null to keep the original match. */
  apply: (match: string, groups: string[], ctx: DetectorContext) => DetectorResult | null;
}

const maskWhole = (match: string, ctx: DetectorContext): DetectorResult | null =>
  ctx.isAllowed(match) ? null : { output: ctx.replacement, hit: match };

// File extensions that look like TLDs in names such as `logo@2x.png`.
const FILE_LIKE_TLDS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'avif',
  'ico',
  'bmp',
  'tif',
  'tiff',
  'css',
  'js',
  'mjs',
  'ts',
  'tsx',
  'jsx',
  'json',
  'md',
  'txt',
  'htm',
  'html',
  'xml',
  'yaml',
  'yml',
  'zip',
  'gz',
  'tar',
  'mp3',
  'mp4',
  'wav',
  'webm',
  'woff',
  'woff2',
  'ttf',
  'pdf',
]);

export const isPublicIPv4 = (octets: number[]) => {
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF, TEST-NET-1
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
};

/** True for globally routable unicast IPv6 (2000::/3) outside the documentation prefix. */
export const isPublicIPv6 = (value: string) => {
  const address = value.split('%')[0];
  if (!isIPv6(address) || address.startsWith('::')) {
    return false;
  }
  const [first, second] = address.split(':');
  const firstHextet = parseInt(first, 16);
  if (Number.isNaN(firstHextet) || (firstHextet & 0xe000) !== 0x2000) {
    return false;
  }
  if (firstHextet === 0x2001 && parseInt(second || '0', 16) === 0x0db8) {
    return false;
  }
  return true;
};

const API_TOKEN_PREFILTER =
  /sk-|gh[pousr]_|github_pat_|AKIA|ASIA|AIza|xox|hf_|glpat-|k_live_|k_test_/;

// Values that are references or placeholders rather than literal secrets.
const isPlaceholderSecretValue = (value: string) => {
  if (/^[$%{<@&*/~.]/.test(value)) {
    return true;
  }
  if (/^(.)\1*$/.test(value)) {
    return true;
  }
  // Identifier-like values without digits are almost always code references,
  // e.g. `token = tokenizer.decode` or `api_key=args.api_key`.
  return !/\d/.test(value) && !/[^A-Za-z0-9._-]/.test(value);
};

/**
 * Built-in detectors, applied in this order before custom rules. Order matters:
 * whole secrets (keys, tokens) go first so later detectors do not split them, and
 * URL credentials go before emails so `user:pass@host` is not half-masked.
 */
export const BUILTIN_DETECTORS: BuiltinDetector[] = [
  {
    id: 'privateKey',
    group: 'privateKey',
    kind: 'secret',
    prefilter: (text) => text.includes('PRIVATE KEY'),
    // A BEGIN without a matching END masks to the end of the text (fail closed),
    // which covers truncated previews.
    regex:
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
    apply: (match, _groups, ctx) => ({ output: ctx.replacement, hit: match }),
  },
  {
    id: 'jwt',
    group: 'jwt',
    kind: 'secret',
    prefilter: (text) => text.includes('eyJ'),
    regex: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{6,}\.eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]*/g,
    apply: (match, _groups, ctx) => maskWhole(match, ctx),
  },
  {
    id: 'apiToken',
    group: 'apiToken',
    kind: 'secret',
    prefilter: (text) => API_TOKEN_PREFILTER.test(text),
    regex: new RegExp(
      '(?<![A-Za-z0-9_-])(?:' +
        [
          'sk-[A-Za-z0-9_-]{16,}',
          'gh[pousr]_[A-Za-z0-9]{30,}',
          'github_pat_[A-Za-z0-9_]{30,}',
          '(?:AKIA|ASIA)[0-9A-Z]{16}(?![0-9A-Z])',
          'AIza[0-9A-Za-z_-]{35}',
          'xox[abposr]-[A-Za-z0-9-]{10,}',
          'hf_[A-Za-z0-9]{30,}',
          'glpat-[A-Za-z0-9_-]{20,}',
          '[rs]k_(?:live|test)_[A-Za-z0-9]{16,}',
        ].join('|') +
        ')',
      'g',
    ),
    apply: (match, _groups, ctx) => maskWhole(match, ctx),
  },
  {
    id: 'bearer',
    group: 'bearer',
    kind: 'secret',
    prefilter: (text) => /bearer/i.test(text),
    // Requires a digit so prose such as "Bearer authentication" is left alone.
    regex: /\b([Bb]earer\s+)(?=[A-Za-z0-9._~+/=-]*\d)([A-Za-z0-9._~+/=-]{16,})/g,
    apply: (_match, groups, ctx) =>
      ctx.isAllowed(groups[1])
        ? null
        : { output: `${groups[0]}${ctx.replacement}`, hit: groups[1] },
  },
  {
    id: 'basicAuth',
    group: 'bearer',
    kind: 'secret',
    prefilter: (text) => /basic/i.test(text),
    regex: /\b(Authorization:\s*Basic\s+)([A-Za-z0-9+/=]{8,})/gi,
    apply: (_match, groups, ctx) =>
      ctx.isAllowed(groups[1])
        ? null
        : { output: `${groups[0]}${ctx.replacement}`, hit: groups[1] },
  },
  {
    id: 'urlCredential',
    group: 'urlCredential',
    kind: 'secret',
    prefilter: (text) => text.includes('://') && text.includes('@'),
    regex: /\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s:/?#@'"<>()[\]]+):([^\s/?#@'"<>()[\]]*)@/g,
    apply: (_match, groups, ctx) => {
      const credential = `${groups[1]}:${groups[2]}`;
      return ctx.isAllowed(credential)
        ? null
        : { output: `${groups[0]}${ctx.replacement}@`, hit: credential };
    },
  },
  {
    id: 'secretAssignment',
    group: 'secretAssignment',
    kind: 'secret',
    prefilter: (text) =>
      /password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?key|private[_-]?key|token|\u5bc6\u7801|\u53e3\u4ee4|\u5bc6\u94a5/i.test(
        text,
      ),
    // Keys must end with a secret-like word (DB_PASSWORD, OPENAI_API_KEY, HF_TOKEN,
    // or the Chinese words for password/passphrase/key); only the value is masked.
    regex:
      /(?<![A-Za-z0-9_.-])((?:[A-Za-z0-9_.-]*?(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?key|secret[_-]?key|private[_-]?key|client[_-]?secret|token)(?![A-Za-z0-9_]))|\u5bc6\u7801|\u53e3\u4ee4|\u5bc6\u94a5)(["'`]?\s*[:=\uff1a]\s*)(["'`]?)([^\s"'`<>,;(){}[\]\u0080-\uffff]{6,})/gi,
    apply: (_match, groups, ctx) => {
      const [key, separator, quote, value] = groups;
      if (isPlaceholderSecretValue(value) || ctx.isAllowed(value)) {
        return null;
      }
      return { output: `${key}${separator}${quote}${ctx.replacement}`, hit: value };
    },
  },
  {
    id: 'email',
    group: 'email',
    kind: 'email',
    prefilter: (text) => text.includes('@'),
    // A local part right after `//` is URL userinfo (https://user@host), not an email.
    regex:
      /(?<![A-Za-z0-9._%+\-/])[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,24}(?![A-Za-z0-9-])/g,
    apply: (match, _groups, ctx) => {
      const tld = match.slice(match.lastIndexOf('.') + 1).toLowerCase();
      if (FILE_LIKE_TLDS.has(tld)) {
        return null;
      }
      return maskWhole(match, ctx);
    },
  },
  {
    id: 'publicIpv4',
    group: 'publicIp',
    kind: 'ip',
    prefilter: (text) => text.includes('.'),
    regex:
      /(?<![A-Za-z0-9._~^])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?!\.?\d)/g,
    apply: (match, _groups, ctx) => {
      const octets = match.split('.').map((part) => Number(part));
      if (!isPublicIPv4(octets)) {
        return null;
      }
      return maskWhole(match, ctx);
    },
  },
  {
    id: 'publicIpv6',
    group: 'publicIp',
    kind: 'ip',
    prefilter: (text) => text.includes(':'),
    regex: /(?<![0-9A-Za-z:.])[0-9A-Fa-f]{0,4}(?::{1,2}[0-9A-Fa-f]{0,4}){2,8}(?![0-9A-Za-z:])/g,
    apply: (match, _groups, ctx) => (isPublicIPv6(match) ? maskWhole(match, ctx) : null),
  },
];
