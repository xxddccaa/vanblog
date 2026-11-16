export type PublicMaskRuleType = 'keyword' | 'regex';

export interface PublicMaskRule {
  id: string;
  enabled: boolean;
  type: PublicMaskRuleType;
  pattern: string;
  caseSensitive?: boolean;
  note?: string;
}

/** Which replacement text a hit uses. */
export type PublicMaskReplacementKind = 'custom' | 'secret' | 'email' | 'ip';

export type PublicMaskReplacements = Record<PublicMaskReplacementKind, string>;

export interface PublicMaskBuiltins {
  /** Vendor API keys: sk-..., ghp_..., AKIA..., AIza..., hf_..., xox..., glpat-..., Stripe keys. */
  apiToken: boolean;
  /** PEM / OpenSSH / PGP private key blocks. */
  privateKey: boolean;
  /** JSON Web Tokens. */
  jwt: boolean;
  /** user:password@ inside URLs. */
  urlCredential: boolean;
  /** Bearer tokens and Basic authorization headers. */
  bearer: boolean;
  /** Values of password=..., api_key: ..., TOKEN=... style assignments. */
  secretAssignment: boolean;
  email: boolean;
  /** Globally routable IPv4/IPv6 addresses (private, loopback, and reserved ranges are kept). */
  publicIp: boolean;
}

export interface PublicMaskSetting {
  enabled: boolean;
  replacements: PublicMaskReplacements;
  rules: PublicMaskRule[];
  builtins: PublicMaskBuiltins;
  /** Exact strings that built-in detectors leave alone. Custom rules still apply. */
  allowlist: string[];
  updatedAt?: string;
}

export interface PublicMaskHit {
  kind: PublicMaskReplacementKind;
  /** Built-in detector id or custom rule id. */
  source: string;
  match: string;
  index: number;
}

export interface PublicMasker {
  /** Stable hash of the normalized setting; changes whenever masking output may change. */
  readonly version: string;
  /** False when masking is disabled or has nothing to mask. */
  readonly active: boolean;
  readonly updatedAt?: string;
  mask(text: string): string;
  hasHit(text: string): boolean;
  findHits(text: string, limit?: number): PublicMaskHit[];
}

/**
 * Masks one piece of text for public output. `cacheKey` identifies the source text
 * (e.g. article id + updatedAt) so repeated masking can be served from a cache.
 */
export type PublicTextMasker = (text: string, cacheKey?: string) => string;

/**
 * Default replacement texts. They are product copy shown to readers, so they follow
 * the site's interface language. Full-width brackets keep them inert in Markdown.
 */
export const DEFAULT_PUBLIC_MASK_REPLACEMENTS: PublicMaskReplacements = {
  custom: '【已屏蔽】',
  secret: '【已屏蔽的密钥】',
  email: '【已屏蔽的邮箱】',
  ip: '【已屏蔽的IP】',
};

export const DEFAULT_PUBLIC_MASK_ALLOWLIST = [
  'git@github.com',
  'git@gitlab.com',
  'git@gitee.com',
  'git@bitbucket.org',
  'noreply@github.com',
  // Well-known public DNS resolvers appear in tutorials and are not sensitive.
  '1.1.1.1',
  '1.0.0.1',
  '8.8.8.8',
  '8.8.4.4',
  '114.114.114.114',
  '119.29.29.29',
  '223.5.5.5',
  '223.6.6.6',
];

export const defaultPublicMaskSetting: PublicMaskSetting = {
  enabled: false,
  replacements: { ...DEFAULT_PUBLIC_MASK_REPLACEMENTS },
  rules: [],
  builtins: {
    apiToken: true,
    privateKey: true,
    jwt: true,
    urlCredential: true,
    bearer: true,
    secretAssignment: true,
    email: true,
    publicIp: true,
  },
  allowlist: [...DEFAULT_PUBLIC_MASK_ALLOWLIST],
};

export const PUBLIC_MASK_LIMITS = {
  maxRules: 500,
  keywordMinLength: 2,
  keywordMaxLength: 128,
  regexMaxLength: 512,
  replacementMaxLength: 16,
  maxAllowlist: 500,
  allowlistItemMaxLength: 200,
  noteMaxLength: 200,
};
