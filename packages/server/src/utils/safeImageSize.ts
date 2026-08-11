export const SAFE_IMAGE_TYPES = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'ico',
]);

interface SafeImageDimensions {
  width: number;
  height: number;
  type: string;
}

const assertDimensions = (
  width: number,
  height: number,
  type: string,
): SafeImageDimensions => {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('invalid image dimensions');
  }
  return { width, height, type };
};

export function detectSafeImageType(buffer: Buffer): string | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  const prefix = buffer.subarray(0, 6).toString('ascii');
  if (prefix === 'GIF87a' || prefix === 'GIF89a') return 'gif';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  if (buffer.subarray(0, 2).toString('ascii') === 'BM') return 'bmp';
  if (buffer.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return 'ico';
  return null;
}

const parseJpegDimensions = (buffer: Buffer) => {
  let offset = 2;
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);

  while (offset < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) {
      offset += 1;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) break;

    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) break;
      return assertDimensions(
        buffer.readUInt16BE(offset + 5),
        buffer.readUInt16BE(offset + 3),
        'jpg',
      );
    }
    offset += segmentLength;
  }
  throw new Error('invalid jpeg structure');
};

const readUInt24LE = (buffer: Buffer, offset: number) =>
  buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);

const parseWebpDimensions = (buffer: Buffer) => {
  if (buffer.length < 16) throw new Error('invalid webp structure');
  const chunkType = buffer.subarray(12, 16).toString('ascii');
  if (chunkType === 'VP8X') {
    if (buffer.length < 30) throw new Error('invalid webp extended structure');
    return assertDimensions(
      readUInt24LE(buffer, 24) + 1,
      readUInt24LE(buffer, 27) + 1,
      'webp',
    );
  }
  if (chunkType === 'VP8L') {
    if (buffer[20] !== 0x2f || buffer.length < 25) {
      throw new Error('invalid webp lossless structure');
    }
    const bits = buffer.readUInt32LE(21);
    return assertDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1, 'webp');
  }
  if (chunkType === 'VP8 ') {
    if (buffer.length < 30) throw new Error('invalid webp lossy structure');
    if (!buffer.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      throw new Error('invalid webp lossy structure');
    }
    return assertDimensions(
      buffer.readUInt16LE(26) & 0x3fff,
      buffer.readUInt16LE(28) & 0x3fff,
      'webp',
    );
  }
  throw new Error('unsupported webp chunk');
};

export function safeImageSize(buffer: Buffer) {
  const magicType = detectSafeImageType(buffer);
  if (!magicType) {
    throw new Error('unsupported or unsafe image signature');
  }

  switch (magicType) {
    case 'png':
      if (
        buffer.length < 24 ||
        buffer.subarray(12, 16).toString('ascii') !== 'IHDR'
      ) {
        throw new Error('invalid png structure');
      }
      return assertDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20), 'png');
    case 'jpg':
      return parseJpegDimensions(buffer);
    case 'gif':
      if (buffer.length < 10) throw new Error('invalid gif structure');
      return assertDimensions(buffer.readUInt16LE(6), buffer.readUInt16LE(8), 'gif');
    case 'webp':
      return parseWebpDimensions(buffer);
    case 'bmp': {
      if (buffer.length < 26) throw new Error('invalid bmp structure');
      const dibHeaderSize = buffer.readUInt32LE(14);
      if (dibHeaderSize === 12) {
        return assertDimensions(buffer.readUInt16LE(18), buffer.readUInt16LE(20), 'bmp');
      }
      const width = buffer.readInt32LE(18);
      const height = Math.abs(buffer.readInt32LE(22));
      return assertDimensions(width, height, 'bmp');
    }
    case 'ico':
      if (buffer.length < 8 || buffer.readUInt16LE(4) < 1) {
        throw new Error('invalid ico structure');
      }
      return assertDimensions(buffer[6] || 256, buffer[7] || 256, 'ico');
    default:
      throw new Error('unsupported image type');
  }
}
