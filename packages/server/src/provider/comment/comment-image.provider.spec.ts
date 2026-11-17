import { HttpException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
} from 'fs';
import { Jimp, JimpMime } from 'jimp';
import os from 'os';
import path from 'path';
import { config } from 'src/config';
import { COMMENT_LIMITS } from 'src/types/comment.dto';
import { WebpEncodeError, WebpEncodeOptions } from 'src/utils/webpAsync';
import {
  COMMENT_IMAGE_MAX_EDGE,
  CommentImageProvider,
  extractCommentImageNames,
} from './comment-image.provider';

/** Builds a structurally valid PNG signature + IHDR with arbitrary dimensions. */
const pngHeader = (width: number, height: number) => {
  const buffer = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 6;
  return buffer;
};

const gifHeader = (width: number, height: number) => {
  const buffer = Buffer.alloc(16);
  buffer.write('GIF89a', 0, 'ascii');
  buffer.writeUInt16LE(width, 6);
  buffer.writeUInt16LE(height, 8);
  return buffer;
};

/**
 * Minimal animated GIF: a 4-colour global palette (red, green, blue, black)
 * and one full-size frame per entry of `frameColors`. The LZW stream resets
 * before every pixel so the code width stays at three bits.
 */
const buildGif = (width: number, height: number, frameColors: number[]) => {
  const parts: Buffer[] = [Buffer.from('GIF89a', 'ascii')];
  const screen = Buffer.alloc(7);
  screen.writeUInt16LE(width, 0);
  screen.writeUInt16LE(height, 2);
  screen[4] = 0x81;
  parts.push(screen, Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]));
  for (const color of frameColors) {
    const descriptor = Buffer.alloc(10);
    descriptor[0] = 0x2c;
    descriptor.writeUInt16LE(width, 5);
    descriptor.writeUInt16LE(height, 7);
    const codes: number[] = [];
    for (let i = 0; i < width * height; i += 1) codes.push(4, color);
    codes.push(5);
    const bytes: number[] = [];
    let accumulator = 0;
    let bits = 0;
    for (const code of codes) {
      accumulator |= code << bits;
      bits += 3;
      while (bits >= 8) {
        bytes.push(accumulator & 0xff);
        accumulator >>= 8;
        bits -= 8;
      }
    }
    if (bits > 0) bytes.push(accumulator & 0xff);
    const blocks: Buffer[] = [];
    for (let i = 0; i < bytes.length; i += 255) {
      const chunk = bytes.slice(i, i + 255);
      blocks.push(Buffer.from([chunk.length]), Buffer.from(chunk));
    }
    parts.push(descriptor, Buffer.from([2]), ...blocks, Buffer.from([0]));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
};

/** Fake encoder output: a valid lossless WebP header followed by a digest of the input. */
const fakeWebp = (input: Buffer) => {
  const digest = createHash('sha256').update(input).digest();
  // VP8L chunk: signature byte 0x2f, then 14-bit width-1 and height-1 (1x1 here).
  const chunk = Buffer.concat([Buffer.from([0x2f, 0, 0, 0, 0]), digest]);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write('VP8L', 0, 'ascii');
  chunkHeader.writeUInt32LE(chunk.length, 4);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(4 + chunkHeader.length + chunk.length, 4);
  riff.write('WEBP', 8, 'ascii');
  return Buffer.concat([riff, chunkHeader, chunk]);
};

const responseOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const http = error as HttpException;
    return { status: http.getStatus(), body: http.getResponse() as any };
  }
  throw new Error('expected a rejection');
};

describe('CommentImageProvider', () => {
  const originalStaticPath = config.staticPath;
  let staticRoot: string;
  let imageDir: string;
  let calls: Array<{ input: Buffer; options: WebpEncodeOptions }>;
  let encoderImpl: (input: Buffer, options: WebpEncodeOptions) => Promise<Buffer>;
  let provider: CommentImageProvider;
  let png: Buffer;
  let jpeg: Buffer;
  let animatedGif: Buffer;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const red = new Jimp({ width: 8, height: 6, color: 0xff0000ff });
    png = await red.getBuffer(JimpMime.png);
    jpeg = await red.getBuffer(JimpMime.jpeg);
    animatedGif = buildGif(4, 3, [0, 1]);
  });

  afterAll(() => {
    config.staticPath = originalStaticPath;
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    staticRoot = mkdtempSync(path.join(os.tmpdir(), 'vanblog-comment-image-spec-'));
    config.staticPath = staticRoot;
    imageDir = path.join(staticRoot, 'img', 'comment');
    calls = [];
    encoderImpl = async (input) => fakeWebp(input);
    provider = new CommentImageProvider(async (input, options) => {
      calls.push({ input, options });
      return encoderImpl(input, options);
    });
  });

  afterEach(() => {
    rmSync(staticRoot, { recursive: true, force: true });
  });

  describe('accepted images', () => {
    it.each([
      ['PNG', () => png],
      ['JPEG', () => jpeg],
      ['WebP', () => fakeWebp(Buffer.from('source'))],
    ])('re-encodes a %s upload and stores it under its hash', async (_, input) => {
      const result = await provider.store(input());
      const output = fakeWebp(input());
      const name = `${createHash('sha256').update(output).digest('hex')}.webp`;
      expect(result).toEqual({
        url: `/static/img/comment/${name}`,
        markdown: `![](/static/img/comment/${name})`,
      });
      expect(readFileSync(path.join(imageDir, name))).toEqual(output);
      expect(calls).toHaveLength(1);
      expect(calls[0].input).toEqual(input());
      expect(calls[0].options).toEqual(
        expect.objectContaining({ quality: 80, timeoutMs: 20_000, resize: undefined }),
      );
      // Only the final file remains; the scratch file was renamed into place.
      expect(readdirSync(imageDir)).toEqual([name]);
    });

    it('decodes only the first frame of an animated GIF', async () => {
      await provider.store(animatedGif);
      expect(calls).toHaveLength(1);
      const pam = calls[0].input;
      const headerEnd = pam.indexOf('ENDHDR\n') + 'ENDHDR\n'.length;
      expect(pam.subarray(0, headerEnd).toString('ascii')).toBe(
        'P7\nWIDTH 4\nHEIGHT 3\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n',
      );
      const pixels = pam.subarray(headerEnd);
      expect(pixels).toHaveLength(4 * 3 * 4);
      // First frame is red, the second (ignored) frame is green.
      expect([...pixels.subarray(0, 4)]).toEqual([0xff, 0x00, 0x00, 0xff]);
    });

    it('scales down very large images while encoding', async () => {
      await provider.store(pngHeader(8000, 2000));
      await provider.store(pngHeader(1000, 6000));
      await provider.store(pngHeader(COMMENT_IMAGE_MAX_EDGE, COMMENT_IMAGE_MAX_EDGE));
      expect(calls.map((call) => call.options.resize)).toEqual([
        { width: COMMENT_IMAGE_MAX_EDGE, height: 0 },
        { width: 0, height: COMMENT_IMAGE_MAX_EDGE },
        undefined,
      ]);
    });

    it('reuses an identical file and refreshes its age', async () => {
      const first = await provider.store(png);
      const file = path.join(staticRoot, first.url.replace('/static/', ''));
      const old = new Date(Date.now() - 3 * 86_400_000);
      utimesSync(file, old, old);
      const second = await provider.store(png);
      expect(second).toEqual(first);
      expect(readdirSync(imageDir)).toHaveLength(1);
      expect(statSync(file).mtimeMs).toBeGreaterThan(Date.now() - 60_000);
    });
  });

  describe('rejected images', () => {
    it.each([
      ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')],
      ['HTML', Buffer.from('<!doctype html><script>alert(1)</script>')],
      ['BMP', Buffer.concat([Buffer.from('BM'), Buffer.alloc(40)])],
      ['ICO', Buffer.concat([Buffer.from([0, 0, 1, 0, 1, 0]), Buffer.alloc(40)])],
      ['random bytes', Buffer.from('this is not an image at all')],
      ['a truncated PNG', Buffer.from('89504e470d0a1a0a0000000d', 'hex')],
    ])('rejects %s with COMMENT_IMAGE_INVALID', async (_, input) => {
      const { status, body } = await responseOf(provider.store(input));
      expect(status).toBe(400);
      expect(body.code).toBe('COMMENT_IMAGE_INVALID');
      expect(calls).toEqual([]);
      expect(existsSync(imageDir)).toBe(false);
    });

    it('rejects an empty upload', async () => {
      const { status } = await responseOf(provider.store(Buffer.alloc(0)));
      expect(status).toBe(400);
      expect((await responseOf(provider.store(undefined as any))).status).toBe(400);
    });

    it('rejects an upload above the byte limit', async () => {
      const big = Buffer.concat([png, Buffer.alloc(COMMENT_LIMITS.imageMaxBytes)]);
      const { status, body } = await responseOf(provider.store(big));
      expect(status).toBe(413);
      expect(body.code).toBe('COMMENT_IMAGE_TOO_LARGE');
      expect(calls).toEqual([]);
    });

    it('rejects a pixel bomb before decoding it', async () => {
      const { status, body } = await responseOf(provider.store(pngHeader(50_000, 50_000)));
      expect(status).toBe(413);
      expect(body.code).toBe('COMMENT_IMAGE_TOO_LARGE');
      expect(calls).toEqual([]);
    });

    it('applies a stricter pixel limit to GIFs', async () => {
      const { status } = await responseOf(provider.store(gifHeader(4_000, 2_001)));
      expect(status).toBe(413);
      expect(calls).toEqual([]);
    });

    it('rejects a GIF that cannot be decoded', async () => {
      const { status, body } = await responseOf(provider.store(gifHeader(10, 10)));
      expect(status).toBe(400);
      expect(body.code).toBe('COMMENT_IMAGE_INVALID');
      expect(calls).toEqual([]);
    });
  });

  describe('encoder failures', () => {
    it.each([
      ['a timeout', new WebpEncodeError('slow', 'timeout'), 413, 'COMMENT_IMAGE_TOO_LARGE'],
      ['a decode failure', new WebpEncodeError('bad', 'failed'), 400, 'COMMENT_IMAGE_INVALID'],
      ['an unexpected error', new Error('boom'), 400, 'COMMENT_IMAGE_INVALID'],
    ])('maps %s', async (_, error, status, code) => {
      encoderImpl = async () => {
        throw error;
      };
      const result = await responseOf(provider.store(png));
      expect(result.status).toBe(status);
      expect(result.body.code).toBe(code);
      expect(provider.activeCount).toBe(0);
    });

    it('reports a missing cwebp as a server error', async () => {
      encoderImpl = async () => {
        throw new WebpEncodeError('cwebp is not installed', 'unavailable');
      };
      const { status } = await responseOf(provider.store(png));
      expect(status).toBe(500);
    });

    it('rejects encoder output that is not WebP', async () => {
      encoderImpl = async () => png;
      const { status } = await responseOf(provider.store(png));
      expect(status).toBe(400);
      expect(existsSync(imageDir)).toBe(false);
    });

    it('rejects encoder output above the byte limit', async () => {
      encoderImpl = async () =>
        Buffer.concat([fakeWebp(png), Buffer.alloc(COMMENT_LIMITS.imageMaxBytes)]);
      const { status, body } = await responseOf(provider.store(png));
      expect(status).toBe(413);
      expect(body.code).toBe('COMMENT_IMAGE_TOO_LARGE');
    });
  });

  describe('concurrency gate', () => {
    it('rejects work beyond imageMaxConcurrent with a coded 429 and releases slots', async () => {
      const releases: Array<() => void> = [];
      encoderImpl = (input) =>
        new Promise((resolve) => releases.push(() => resolve(fakeWebp(input))));
      const running = Array.from({ length: COMMENT_LIMITS.imageMaxConcurrent }, (_, index) =>
        provider.store(pngHeader(10 + index, 10)),
      );
      await new Promise((resolve) => setImmediate(resolve));
      expect(provider.activeCount).toBe(COMMENT_LIMITS.imageMaxConcurrent);

      const { status, body } = await responseOf(provider.store(png));
      expect(status).toBe(429);
      expect(body.code).toBe('COMMENT_RATE_LIMITED');
      expect(body.retryAfterSeconds).toBeGreaterThan(0);

      releases.forEach((release) => release());
      await Promise.all(running);
      expect(provider.activeCount).toBe(0);
      encoderImpl = async (input) => fakeWebp(input);
      await expect(provider.store(png)).resolves.toEqual(
        expect.objectContaining({ url: expect.any(String) }),
      );
    });

    it('does not take a slot for uploads rejected during inspection', async () => {
      await responseOf(provider.store(Buffer.from('<svg/>')));
      expect(provider.activeCount).toBe(0);
    });
  });

  describe('storage safety', () => {
    it('refuses to write through a symlinked image directory', async () => {
      const elsewhere = mkdtempSync(path.join(os.tmpdir(), 'vanblog-comment-image-elsewhere-'));
      try {
        mkdirSync(path.join(staticRoot, 'img'), { recursive: true });
        symlinkSync(elsewhere, imageDir);
        const { status } = await responseOf(provider.store(png));
        expect(status).toBe(500);
        expect(readdirSync(elsewhere)).toEqual([]);
      } finally {
        rmSync(elsewhere, { recursive: true, force: true });
      }
    });

    it('refuses to reuse a symlink that has the target name', async () => {
      const output = fakeWebp(png);
      const name = `${createHash('sha256').update(output).digest('hex')}.webp`;
      mkdirSync(imageDir, { recursive: true });
      symlinkSync('/etc/hostname', path.join(imageDir, name));
      const { status } = await responseOf(provider.store(png));
      expect(status).toBe(500);
    });
  });

  it('extractCommentImageNames finds uploaded images in Markdown', () => {
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(64);
    const content = [
      `![](/static/img/comment/${a}.webp)`,
      `![x](https://blog.example.com/static/img/comment/${b}.webp "t")`,
      `![](/static/img/comment/${a}.webp)`,
      `![](/static/img/comment/${'c'.repeat(63)}.webp)`,
      `![](/static/img/other/${'d'.repeat(64)}.webp)`,
    ].join('\n');
    expect(extractCommentImageNames(content)).toEqual([`${a}.webp`, `${b}.webp`]);
    expect(extractCommentImageNames(undefined)).toEqual([]);
  });
});
