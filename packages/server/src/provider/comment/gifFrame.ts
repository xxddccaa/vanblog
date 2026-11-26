/**
 * Reads the image descriptor of the first frame of a GIF without decoding any
 * pixel data. Decoders loop over the frame's own width x height, which the
 * logical screen (canvas) size in the header does not bound, so callers must
 * check this before handing an untrusted GIF to a decoder.
 */

export interface GifFrameDescriptor {
  canvasWidth: number;
  canvasHeight: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const EXTENSION_INTRODUCER = 0x21;
const IMAGE_SEPARATOR = 0x2c;

/** Returns the first frame's descriptor, or null when the GIF is malformed or has no frame. */
export function readFirstGifFrame(buffer: Buffer): GifFrameDescriptor | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 13) return null;
  const signature = buffer.toString('latin1', 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;

  const canvasWidth = buffer.readUInt16LE(6);
  const canvasHeight = buffer.readUInt16LE(8);
  const packed = buffer[10];
  let offset = 13;
  if (packed & 0x80) {
    offset += 3 * 2 ** ((packed & 0x07) + 1);
  }

  while (offset < buffer.length) {
    const marker = buffer[offset];
    if (marker === IMAGE_SEPARATOR) {
      if (offset + 10 > buffer.length) return null;
      return {
        canvasWidth,
        canvasHeight,
        left: buffer.readUInt16LE(offset + 1),
        top: buffer.readUInt16LE(offset + 3),
        width: buffer.readUInt16LE(offset + 5),
        height: buffer.readUInt16LE(offset + 7),
      };
    }
    if (marker !== EXTENSION_INTRODUCER) {
      // The trailer before any frame, or an unknown block: no usable frame.
      return null;
    }
    // Skip the introducer and label, then the data sub-blocks up to the terminator.
    offset += 2;
    for (;;) {
      if (offset >= buffer.length) return null;
      const size = buffer[offset];
      offset += 1;
      if (size === 0) break;
      offset += size;
    }
  }
  return null;
}

/** True when the first frame lies inside the canvas and has a non-zero size. */
export function isGifFrameInsideCanvas(frame: GifFrameDescriptor): boolean {
  return (
    frame.width > 0 &&
    frame.height > 0 &&
    frame.left + frame.width <= frame.canvasWidth &&
    frame.top + frame.height <= frame.canvasHeight
  );
}
