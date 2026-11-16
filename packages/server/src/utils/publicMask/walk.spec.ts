import { compilePublicMask, INACTIVE_PUBLIC_MASKER } from './compile';
import { defaultPublicMaskSetting } from './types';
import { maskPublicPayload } from './walk';
import { maskTextFileContent } from './textFile';

const masker = compilePublicMask({
  ...defaultPublicMaskSetting,
  enabled: true,
  replacements: { custom: 'X-CUSTOM-X', secret: 'X-SECRET-X', email: 'X-EMAIL-X', ip: 'X-IP-X' },
  rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
});

describe('maskPublicPayload', () => {
  it('returns the payload untouched when masking is inactive', () => {
    const payload = { title: 'acmecore' };
    expect(maskPublicPayload(payload, INACTIVE_PUBLIC_MASKER)).toBe(payload);
  });

  it('masks nested strings without mutating the input', () => {
    const payload = {
      data: {
        title: 'acmecore notes',
        tags: ['acmecore', 'ok'],
        list: [{ author: 'ops@example.org' }],
      },
    };
    const snapshot = JSON.stringify(payload);
    const result = maskPublicPayload(payload, masker);
    expect(result).toEqual({
      data: {
        title: 'X-CUSTOM-X notes',
        tags: ['X-CUSTOM-X', 'ok'],
        list: [{ author: 'X-EMAIL-X' }],
      },
    });
    expect(JSON.stringify(payload)).toBe(snapshot);
  });

  it('masks object keys and merges keys that collide after masking', () => {
    const result: any = maskPublicPayload(
      {
        data: {
          acmecore: [{ id: 1 }],
          ACMECORE: [{ id: 2 }],
          counts: { acmecore: 1, Acmecore: 2 },
        },
      },
      masker,
    );
    expect(result.data['X-CUSTOM-X']).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.data.counts).toEqual({ 'X-CUSTOM-X': 3 });
  });

  it('drops pathnames that contain hits so links fall back to ids', () => {
    const result: any = maskPublicPayload(
      {
        data: [
          { id: 3, pathname: 'acmecore-setup' },
          { id: 4, pathname: 'hello' },
        ],
      },
      masker,
    );
    expect(result.data[0]).toEqual({ id: 3 });
    expect(result.data[1]).toEqual({ id: 4, pathname: 'hello' });
  });

  it('decodes, masks, and re-encodes declared base64 fields', () => {
    const encoded = Buffer.from('<p>acmecore</p>').toString('base64');
    const result: any = maskPublicPayload({ data: { html: encoded } }, masker, {
      base64Paths: ['data.html'],
    });
    expect(Buffer.from(result.data.html, 'base64').toString('utf8')).toBe('<p>X-CUSTOM-X</p>');
  });

  it('serializes values with toJSON such as dates', () => {
    const result: any = maskPublicPayload({ at: new Date('2026-01-01T00:00:00.000Z') }, masker);
    expect(result.at).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('maskTextFileContent', () => {
  it('keeps JSON valid while masking it', () => {
    const output = maskTextFileContent('{"title":"acmecore \\"quoted\\""}', 'index.json', masker);
    expect(JSON.parse(output)).toEqual({ title: 'X-CUSTOM-X "quoted"' });
  });

  it('masks other text formats as plain text', () => {
    expect(maskTextFileContent('<svg><text>acmecore</text></svg>', 'a.svg', masker)).toBe(
      '<svg><text>X-CUSTOM-X</text></svg>',
    );
  });
});
