import { isGifFrameInsideCanvas, readFirstGifFrame } from './gifFrame';

const screen = (width: number, height: number, packed = 0) => {
  const buffer = Buffer.alloc(7);
  buffer.writeUInt16LE(width, 0);
  buffer.writeUInt16LE(height, 2);
  buffer[4] = packed;
  return buffer;
};

const descriptor = (left: number, top: number, width: number, height: number) => {
  const buffer = Buffer.alloc(10);
  buffer[0] = 0x2c;
  buffer.writeUInt16LE(left, 1);
  buffer.writeUInt16LE(top, 3);
  buffer.writeUInt16LE(width, 5);
  buffer.writeUInt16LE(height, 7);
  return buffer;
};

describe('readFirstGifFrame', () => {
  it('reads the frame after a global color table and extension blocks', () => {
    const gif = Buffer.concat([
      Buffer.from('GIF89a', 'ascii'),
      screen(20, 10, 0x81),
      Buffer.alloc(12),
      // Graphic control extension with one 4-byte sub-block.
      Buffer.from([0x21, 0xf9, 4, 0, 0, 0, 0, 0]),
      descriptor(1, 2, 5, 6),
    ]);
    expect(readFirstGifFrame(gif)).toEqual({
      canvasWidth: 20,
      canvasHeight: 10,
      left: 1,
      top: 2,
      width: 5,
      height: 6,
    });
  });

  it('returns null for non-GIF, truncated or frameless input', () => {
    expect(readFirstGifFrame(Buffer.from('not a gif at all'))).toBeNull();
    expect(readFirstGifFrame(Buffer.concat([Buffer.from('GIF89a'), screen(1, 1)]))).toBeNull();
    expect(
      readFirstGifFrame(Buffer.concat([Buffer.from('GIF89a'), screen(1, 1), Buffer.from([0x3b])])),
    ).toBeNull();
    expect(
      readFirstGifFrame(
        Buffer.concat([Buffer.from('GIF89a'), screen(1, 1), Buffer.from([0x21, 0xf9, 200])]),
      ),
    ).toBeNull();
  });

  it('accepts only frames that lie inside the canvas', () => {
    const base = { canvasWidth: 10, canvasHeight: 10 };
    expect(isGifFrameInsideCanvas({ ...base, left: 0, top: 0, width: 10, height: 10 })).toBe(true);
    expect(isGifFrameInsideCanvas({ ...base, left: 1, top: 0, width: 10, height: 10 })).toBe(false);
    expect(isGifFrameInsideCanvas({ ...base, left: 0, top: 0, width: 65535, height: 1 })).toBe(
      false,
    );
    expect(isGifFrameInsideCanvas({ ...base, left: 0, top: 0, width: 0, height: 5 })).toBe(false);
  });
});
