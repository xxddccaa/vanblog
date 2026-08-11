import { detectSafeImageType, safeImageSize } from './safeImageSize';

describe('safeImageSize', () => {
  it('rejects vulnerable container formats before invoking image-size', () => {
    const icns = Buffer.concat([Buffer.from('icns'), Buffer.alloc(64)]);
    const heif = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftypheic'),
      Buffer.alloc(64),
    ]);

    expect(detectSafeImageType(icns)).toBeNull();
    expect(detectSafeImageType(heif)).toBeNull();
    expect(() => safeImageSize(icns)).toThrow('unsupported or unsafe image signature');
    expect(() => safeImageSize(heif)).toThrow('unsupported or unsafe image signature');
  });

  it('recognizes allowlisted image magic without trusting the extension', () => {
    expect(
      detectSafeImageType(Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(16)])),
    ).toBe('png');
    expect(detectSafeImageType(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)]))).toBe('gif');
  });

  it('parses allowlisted dimensions without invoking the vulnerable image-size package', () => {
    const png = Buffer.alloc(24);
    Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
    Buffer.from('IHDR').copy(png, 12);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(360, 20);

    const gif = Buffer.alloc(12);
    Buffer.from('GIF89a').copy(gif);
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(200, 8);

    const webp = Buffer.alloc(30);
    Buffer.from('RIFF').copy(webp);
    Buffer.from('WEBP').copy(webp, 8);
    Buffer.from('VP8X').copy(webp, 12);
    webp[24] = 0xff;
    webp[25] = 0x01;
    webp[27] = 0x67;
    webp[28] = 0x01;

    expect(safeImageSize(png)).toEqual({ width: 640, height: 360, type: 'png' });
    expect(safeImageSize(gif)).toEqual({ width: 320, height: 200, type: 'gif' });
    expect(safeImageSize(webp)).toEqual({ width: 512, height: 360, type: 'webp' });
  });

  it('rejects truncated or zero-sized allowlisted files', () => {
    expect(() =>
      safeImageSize(Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(8)])),
    ).toThrow('invalid png structure');

    const gif = Buffer.alloc(12);
    Buffer.from('GIF89a').copy(gif);
    expect(() => safeImageSize(gif)).toThrow('invalid image dimensions');
  });
});
