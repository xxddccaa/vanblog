import { isValidFontBuffer } from './font.controller';

describe('isValidFontBuffer', () => {
  it('accepts woff2 (wOF2)', () => {
    expect(isValidFontBuffer(Buffer.from('wOF2....', 'latin1'))).toBe(true);
  });
  it('accepts woff (wOFF)', () => {
    expect(isValidFontBuffer(Buffer.from('wOFF....', 'latin1'))).toBe(true);
  });
  it('accepts otf (OTTO)', () => {
    expect(isValidFontBuffer(Buffer.from('OTTO....', 'latin1'))).toBe(true);
  });
  it('accepts ttf (0x00010000)', () => {
    expect(isValidFontBuffer(Buffer.from([0x00, 0x01, 0x00, 0x00, 0x11]))).toBe(true);
  });
  it('accepts ttf collection (ttcf) and true', () => {
    expect(isValidFontBuffer(Buffer.from('ttcf....', 'latin1'))).toBe(true);
    expect(isValidFontBuffer(Buffer.from('true....', 'latin1'))).toBe(true);
  });
  it('rejects a png disguised as font', () => {
    expect(isValidFontBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
  it('rejects plain text', () => {
    expect(isValidFontBuffer(Buffer.from('notafont', 'utf8'))).toBe(false);
  });
  it('rejects too-short buffers', () => {
    expect(isValidFontBuffer(Buffer.from([0x00]))).toBe(false);
    expect(isValidFontBuffer(Buffer.alloc(0))).toBe(false);
  });
});
