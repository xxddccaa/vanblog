import { compilePublicMask, PublicMaskCompileError } from './compile';
import { defaultPublicMaskSetting, PublicMaskSetting } from './types';

const REPLACEMENTS = {
  custom: 'X-CUSTOM-X',
  secret: 'X-SECRET-X',
  email: 'X-EMAIL-X',
  ip: 'X-IP-X',
};

const buildSetting = (overrides: Partial<PublicMaskSetting> = {}): PublicMaskSetting => ({
  ...defaultPublicMaskSetting,
  enabled: true,
  replacements: { ...REPLACEMENTS },
  rules: [],
  ...overrides,
});

const keyword = (pattern: string, extra: Record<string, unknown> = {}) => ({
  id: `kw-${pattern}`,
  enabled: true,
  type: 'keyword' as const,
  pattern,
  ...extra,
});

// Token-shaped fixtures are assembled at runtime so repository secret scanners
// never see a literal credential.
const fake = {
  openai: ['s', 'k-', 'proj-', 'Ab1'.repeat(10)].join(''),
  openrouter: ['s', 'k-or-v1-', 'f0e1'.repeat(16)].join(''),
  github: ['gh', 'p_', 'A1b2'.repeat(9)].join(''),
  githubPat: ['github', '_pat_', 'B2c3'.repeat(10)].join(''),
  aws: ['AK', 'IA', 'ABCDEFGHIJ234567'].join(''),
  google: ['AI', 'za', 'Sy', 'x'.repeat(33)].join(''),
  huggingface: ['h', 'f_', 'Q'.repeat(34)].join(''),
  slack: ['xo', 'xb-', '1234567890-abcdefghij'].join(''),
  gitlab: ['gl', 'pat-', 'z9'.repeat(12)].join(''),
  stripe: ['s', 'k_live_', '9'.repeat(24)].join(''),
  jwt: [
    'ey',
    'JhbGciOiJIUzI1NiJ9',
    '.',
    'ey',
    'JzdWIiOiIxMjM0NTY3ODkwIn0',
    '.',
    'sig_value-123',
  ].join(''),
};

describe('compilePublicMask', () => {
  it('is a no-op while disabled', () => {
    const masker = compilePublicMask(
      buildSetting({ enabled: false, rules: [keyword('acmecore')] }),
    );
    expect(masker.active).toBe(false);
    expect(masker.mask('acmecore')).toBe('acmecore');
    expect(masker.hasHit('acmecore')).toBe(false);
  });

  describe('custom keywords', () => {
    it('masks case-insensitive substrings and prefers the longest keyword', () => {
      const masker = compilePublicMask(
        buildSetting({ rules: [keyword('acme'), keyword('acmecore')] }),
      );
      expect(masker.mask('ssh ACMECORE-gpu01 then acme')).toBe(
        'ssh X-CUSTOM-X-gpu01 then X-CUSTOM-X',
      );
    });

    it('respects case-sensitive keywords', () => {
      const masker = compilePublicMask(
        buildSetting({ rules: [keyword('Nimbus', { caseSensitive: true })] }),
      );
      expect(masker.mask('Nimbus nimbus')).toBe('X-CUSTOM-X nimbus');
    });

    it('treats regex metacharacters in keywords literally', () => {
      const masker = compilePublicMask(buildSetting({ rules: [keyword('a.b+c')] }));
      expect(masker.mask('a.b+c axbbc')).toBe('X-CUSTOM-X axbbc');
    });

    it('masks non-ASCII keywords and their percent-encoded form', () => {
      const word = '\u667a\u60a6';
      const masker = compilePublicMask(buildSetting({ rules: [keyword(word)] }));
      const encoded = encodeURIComponent(word);
      expect(masker.mask(`host ${word} and /tag/${encoded.toLowerCase()}`)).toBe(
        'host X-CUSTOM-X and /tag/X-CUSTOM-X',
      );
    });

    it('applies regex rules', () => {
      const masker = compilePublicMask(
        buildSetting({
          rules: [{ id: 'r1', enabled: true, type: 'regex', pattern: 'node-\\d{2,}' }],
        }),
      );
      expect(masker.mask('node-1 node-42 NODE-77')).toBe('node-1 X-CUSTOM-X X-CUSTOM-X');
    });

    it('ignores disabled rules', () => {
      const masker = compilePublicMask(
        buildSetting({ rules: [keyword('acmecore', { enabled: false })] }),
      );
      expect(masker.mask('acmecore')).toBe('acmecore');
    });
  });

  describe('built-in detectors', () => {
    const masker = compilePublicMask(buildSetting());

    it.each(Object.entries(fake))('masks %s tokens', (_name, token) => {
      expect(masker.mask(`key: "${token}" end`)).not.toContain(token);
    });

    it('does not treat ordinary words as tokens', () => {
      for (const text of [
        'task-management-system-for-teams',
        'pip install sk-learn',
        'ghost_writer_module',
        'Bearer authentication scheme',
      ]) {
        expect(masker.mask(text)).toBe(text);
      }
    });

    it('masks private key blocks, including truncated ones', () => {
      const block = [
        '-----BEGIN OPENSSH PRIVATE KEY-----',
        'b3BlbnNzaC1rZXktdjEAAAAA',
        '-----END OPENSSH PRIVATE KEY-----',
      ].join('\n');
      expect(masker.mask(`before\n${block}\nafter`)).toBe('before\nX-SECRET-X\nafter');
      expect(masker.mask('x -----BEGIN RSA PRIVATE KEY-----\nMIIEow\nIBAAKCAQ')).toBe(
        'x X-SECRET-X',
      );
    });

    it('masks bearer and basic credentials but keeps the scheme', () => {
      expect(masker.mask('Authorization: Bearer abcd1234efgh5678ijkl')).toBe(
        'Authorization: Bearer X-SECRET-X',
      );
      expect(masker.mask('Authorization: Basic dXNlcjpwYXNz')).toBe(
        'Authorization: Basic X-SECRET-X',
      );
    });

    it('masks credentials embedded in URLs', () => {
      expect(masker.mask('postgres://admin:hunter2@db.internal:5432/app')).toBe(
        'postgres://X-SECRET-X@db.internal:5432/app',
      );
    });

    it('masks secret assignments but not code references or placeholders', () => {
      expect(masker.mask('DB_PASSWORD=hunter22')).toBe('DB_PASSWORD=X-SECRET-X');
      expect(masker.mask('{"api_key": "abc123xyz"}')).toBe('{"api_key": "X-SECRET-X"}');
      expect(masker.mask('\u5bc6\u7801\uff1aadmin123')).toBe('\u5bc6\u7801\uff1aX-SECRET-X');
      for (const text of [
        'token = tokenizer.decode(ids)',
        'max_tokens = 512',
        'password: ${DB_PASSWORD}',
        'pwd: /home/user',
        'password=xxxxxxxx',
        'api_key=args.api_key',
      ]) {
        expect(masker.mask(text)).toBe(text);
      }
    });

    it('masks emails, honoring the allowlist and URL userinfo', () => {
      expect(masker.mask('mail ops@example.org now')).toBe('mail X-EMAIL-X now');
      expect(masker.mask('git clone git@github.com:org/repo.git')).toBe(
        'git clone git@github.com:org/repo.git',
      );
      expect(masker.mask('https://alice@github.com/repo')).toBe('https://alice@github.com/repo');
      expect(masker.mask('![logo](logo@2x.png)')).toBe('![logo](logo@2x.png)');
    });

    it('masks public IPv4 addresses only', () => {
      expect(masker.mask('ssh root@47.100.1.2 -p 22')).toBe('ssh root@X-IP-X -p 22');
      expect(masker.mask('curl http://47.100.1.2:8080/x')).toBe('curl http://X-IP-X:8080/x');
      for (const text of [
        '192.168.1.1',
        '10.0.0.1',
        '127.0.0.1',
        '172.20.0.5',
        '203.0.113.5',
        '255.255.255.0',
        '8.8.8.8',
        'v1.2.3.4',
        'release 1.2.3.4.5',
        'build 10.0.19041.1',
      ]) {
        expect(masker.mask(text)).toBe(text);
      }
    });

    it('masks public IPv6 addresses only', () => {
      expect(masker.mask('dns 2400:3200::1 ok')).toBe('dns X-IP-X ok');
      for (const text of ['::1', 'fe80::1', '2001:db8::1', 'std::vector<int>', '12:30:45']) {
        expect(masker.mask(text)).toBe(text);
      }
    });

    it('exempts allowlisted built-in hits but still applies custom keywords inside them', () => {
      const withKeyword = compilePublicMask(
        buildSetting({ rules: [keyword('acmecore')], allowlist: ['ops@acmecore.io'] }),
      );
      expect(withKeyword.mask('ops@acmecore.io')).toBe('ops@X-CUSTOM-X.io');
    });

    it('only runs enabled detectors', () => {
      const emailOnly = compilePublicMask(
        buildSetting({
          builtins: {
            apiToken: false,
            privateKey: false,
            jwt: false,
            urlCredential: false,
            bearer: false,
            secretAssignment: false,
            email: true,
            publicIp: false,
          },
        }),
      );
      expect(emailOnly.mask(`a@example.org ${fake.github} 47.100.1.2`)).toBe(
        `X-EMAIL-X ${fake.github} 47.100.1.2`,
      );
    });
  });

  it('is idempotent', () => {
    const masker = compilePublicMask(buildSetting({ rules: [keyword('acmecore')] }));
    const sample = [
      `OPENAI_API_KEY=${fake.openai}`,
      'postgres://admin:hunter2@acmecore.internal/app',
      'mail ops@example.org from 47.100.1.2',
      `Authorization: Bearer ${fake.jwt}`,
    ].join('\n');
    const once = masker.mask(sample);
    expect(masker.mask(once)).toBe(once);
    expect(once).not.toMatch(/acmecore|hunter2|ops@example|47\.100/);
  });

  it('masks text inside base64 data URIs without corrupting binary ones', () => {
    const masker = compilePublicMask(buildSetting({ rules: [keyword('acmecore')] }));
    const svg = Buffer.from('<svg><text>acmecore</text></svg>').toString('base64');
    const png = 'QUFBacmecoreQUFB';
    const output = masker.mask(
      `![a](data:image/svg+xml;base64,${svg}) ![b](data:image/png;base64,${png}) acmecore`,
    );
    const svgPayload = /data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/.exec(output)![1];
    expect(Buffer.from(svgPayload, 'base64').toString('utf8')).toBe(
      '<svg><text>X-CUSTOM-X</text></svg>',
    );
    expect(output).toContain(`data:image/png;base64,${png}`);
    expect(output.endsWith(' X-CUSTOM-X')).toBe(true);
  });

  it('rejects rules that would match a replacement text', () => {
    expect(() => compilePublicMask(buildSetting({ rules: [keyword('secret')] }))).toThrow(
      PublicMaskCompileError,
    );
  });

  it('reports hits with their kind and source', () => {
    const masker = compilePublicMask(buildSetting({ rules: [keyword('acmecore')] }));
    const hits = masker.findHits('acmecore ops@example.org');
    expect(hits.map((hit) => [hit.kind, hit.match])).toEqual([
      ['custom', 'acmecore'],
      ['email', 'ops@example.org'],
    ]);
    expect(hits[0].source).toBe('kw-acmecore');
  });

  it('derives a stable version from the effective setting', () => {
    const a = compilePublicMask(buildSetting({ rules: [keyword('acmecore')] }));
    const b = compilePublicMask(buildSetting({ rules: [keyword('acmecore')] }));
    const c = compilePublicMask(buildSetting({ rules: [keyword('blueyard')] }));
    expect(a.version).toBe(b.version);
    expect(a.version).not.toBe(c.version);
  });

  it('masks a large mixed document quickly', () => {
    const rules = Array.from({ length: 50 }, (_, index) => keyword(`internalhost${index}`));
    const masker = compilePublicMask(buildSetting({ rules }));
    const chunk = [
      'Deploy internalhost7 with config at /etc/app.conf on 10.0.0.5.',
      'Contact ops@example.org; version 1.2.3; std::vector<int> v;',
      '\u4e2d\u6587\u5185\u5bb9\u6df7\u5408 English text with numbers 12345 and symbols.',
    ].join('\n');
    const text = chunk.repeat(Math.ceil((1024 * 1024) / chunk.length));
    const started = Date.now();
    const output = masker.mask(text);
    const elapsed = Date.now() - started;
    expect(output).not.toContain('internalhost7');
    expect(elapsed).toBeLessThan(1500);
  });
});
