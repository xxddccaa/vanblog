import {
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { defaultFormats } from 'jimp';
import path from 'path';
import { config } from 'src/config';
import { COMMENT_IMAGE_DIR, COMMENT_LIMITS, CommentImageResult } from 'src/types/comment.dto';
import { isGifFrameInsideCanvas, readFirstGifFrame } from 'src/utils/gifFrame';
import { detectSafeImageType, safeImageSize } from 'src/utils/safeImageSize';
import { WebpEncodeError, WebpEncoder, encodeWebpAsync } from 'src/utils/webpAsync';
import { commentError } from './comment-request.service';

/** Optional injection token to replace the cwebp runner (tests, other encoders). */
export const COMMENT_IMAGE_WEBP_ENCODER = 'COMMENT_IMAGE_WEBP_ENCODER';

/** Stored comment images are named after the SHA-256 of their WebP bytes. */
export const COMMENT_IMAGE_NAME_PATTERN = /^[a-f0-9]{64}\.webp$/u;

/** Scratch files written next to the final file and renamed into place. */
export const COMMENT_IMAGE_TEMP_PATTERN = /^\.[a-f0-9]{64}\.[a-f0-9]{16}\.tmp$/u;

const ACCEPTED_TYPES = new Set(['png', 'jpg', 'webp', 'gif']);

/** GIF frames are decoded in JavaScript on the main thread, so keep them smaller. */
export const COMMENT_GIF_MAX_PIXELS = 8_000_000;

/** Longer edges are scaled down while encoding; comments never need more. */
export const COMMENT_IMAGE_MAX_EDGE = 4_096;

const WEBP_QUALITY = 80;
const WEBP_TIMEOUT_MS = 20_000;
const BUSY_RETRY_AFTER_SECONDS = 5;

const REFERENCE_PATTERN = new RegExp(
  `/static/${COMMENT_IMAGE_DIR.replace(/\//gu, '\\/')}/([a-f0-9]{64}\\.webp)`,
  'gu',
);

/** Absolute directory holding comment images below the static root. */
export function commentImageDir(): string {
  return path.join(config.staticPath, COMMENT_IMAGE_DIR);
}

export function commentImageUrl(name: string): string {
  return `/static/${COMMENT_IMAGE_DIR}/${name}`;
}

/**
 * File names of uploaded comment images referenced by Markdown content, in
 * order of first appearance. Intended for CommentRecord.images.
 */
export function extractCommentImageNames(content: unknown): string[] {
  const names = new Set<string>();
  for (const match of String(content ?? '').matchAll(REFERENCE_PATTERN)) {
    names.add(match[1]);
  }
  return [...names];
}

interface InspectedImage {
  type: string;
  width: number;
  height: number;
}

const invalidImage = (message: string) => commentError(400, 'COMMENT_IMAGE_INVALID', message);
const imageTooLarge = (message: string) => commentError(413, 'COMMENT_IMAGE_TOO_LARGE', message);

/** Raw RGBA as a PAM file, which cwebp reads directly without a PNG round trip. */
function encodePam(width: number, height: number, rgba: Buffer): Buffer {
  const header = Buffer.from(
    `P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`,
    'ascii',
  );
  return Buffer.concat([header, rgba]);
}

/**
 * Validates and stores visitor images. Every upload is sniffed from its bytes,
 * bounded in size and pixels, and re-encoded to WebP without metadata, so the
 * stored file never contains anything the visitor sent verbatim.
 */
@Injectable()
export class CommentImageProvider {
  private readonly logger = new Logger(CommentImageProvider.name);
  private readonly encoder: WebpEncoder;
  private active = 0;

  constructor(@Optional() @Inject(COMMENT_IMAGE_WEBP_ENCODER) encoder?: WebpEncoder) {
    this.encoder = encoder || encodeWebpAsync;
  }

  /** Number of uploads currently being processed. */
  get activeCount(): number {
    return this.active;
  }

  async store(buffer: Buffer): Promise<CommentImageResult> {
    const image = this.inspect(buffer);
    if (this.active >= COMMENT_LIMITS.imageMaxConcurrent) {
      throw commentError(
        429,
        'COMMENT_RATE_LIMITED',
        'Image processing is busy, try again shortly',
        {
          retryAfterSeconds: BUSY_RETRY_AFTER_SECONDS,
        },
      );
    }
    this.active += 1;
    try {
      const output = await this.encode(buffer, image);
      const name = await this.persist(output);
      const url = commentImageUrl(name);
      return { url, markdown: `![](${url})` };
    } finally {
      this.active -= 1;
    }
  }

  /** Sniffs the real type and dimensions; never trusts the name or MIME type. */
  inspect(buffer: Buffer): InspectedImage {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw invalidImage('An image file is required');
    }
    if (buffer.length > COMMENT_LIMITS.imageMaxBytes) {
      throw imageTooLarge('The image file is too large');
    }
    const type = detectSafeImageType(buffer);
    if (!type || !ACCEPTED_TYPES.has(type)) {
      throw invalidImage('Only PNG, JPEG, WebP and GIF images are accepted');
    }
    let size: { width: number; height: number };
    try {
      size = safeImageSize(buffer);
    } catch {
      throw invalidImage('The image could not be read');
    }
    const maxPixels =
      type === 'gif'
        ? Math.min(COMMENT_GIF_MAX_PIXELS, COMMENT_LIMITS.imageMaxPixels)
        : COMMENT_LIMITS.imageMaxPixels;
    if (size.width * size.height > maxPixels) {
      throw imageTooLarge('The image has too many pixels');
    }
    if (type === 'gif') {
      // The decoder iterates over the first frame's own size, which the canvas
      // size checked above does not bound. A frame outside the canvas is
      // rejected before any decoding so a tiny file cannot stall the server.
      const frame = readFirstGifFrame(buffer);
      if (!frame || !isGifFrameInsideCanvas(frame)) {
        throw invalidImage('The GIF image could not be read');
      }
    }
    return { type, width: size.width, height: size.height };
  }

  private async encode(buffer: Buffer, image: InspectedImage): Promise<Buffer> {
    const input = image.type === 'gif' ? await this.firstGifFrame(buffer) : buffer;
    const longEdge = Math.max(image.width, image.height);
    const resize =
      longEdge > COMMENT_IMAGE_MAX_EDGE
        ? image.width >= image.height
          ? { width: COMMENT_IMAGE_MAX_EDGE, height: 0 }
          : { width: 0, height: COMMENT_IMAGE_MAX_EDGE }
        : undefined;
    let output: Buffer;
    try {
      output = await this.encoder(input, {
        quality: WEBP_QUALITY,
        timeoutMs: WEBP_TIMEOUT_MS,
        resize,
      });
    } catch (error) {
      throw this.mapEncodeError(error);
    }
    if (!Buffer.isBuffer(output) || detectSafeImageType(output) !== 'webp') {
      this.logger.error('The WebP encoder returned something that is not a WebP image');
      throw invalidImage('The image could not be converted');
    }
    if (output.length > COMMENT_LIMITS.imageMaxBytes) {
      throw imageTooLarge('The converted image is too large');
    }
    return output;
  }

  /**
   * Decodes frame 0 with jimp's GIF codec (omggif). The format plugin is used
   * directly because the type is already sniffed and Jimp.read would load an
   * ESM-only detector through a dynamic import.
   */
  private async firstGifFrame(buffer: Buffer): Promise<Buffer> {
    try {
      const codec = defaultFormats.map((format) => format()).find((f) => f.mime === 'image/gif');
      const bitmap: any = await codec.decode(buffer);
      const width = Number(bitmap?.width);
      const height = Number(bitmap?.height);
      const data: Buffer = bitmap?.data;
      if (!width || !height || !Buffer.isBuffer(data) || data.length !== width * height * 4) {
        throw new Error('unexpected bitmap layout');
      }
      return encodePam(width, height, data);
    } catch {
      throw invalidImage('The GIF image could not be decoded');
    }
  }

  private mapEncodeError(error: unknown): HttpException {
    if (error instanceof WebpEncodeError) {
      if (error.reason === 'timeout') {
        this.logger.warn('Comment image conversion timed out');
        return imageTooLarge('The image took too long to process');
      }
      if (error.reason === 'unavailable') {
        this.logger.error(`Comment image conversion is unavailable: ${error.message}`);
        return new InternalServerErrorException('Image processing is unavailable');
      }
      return invalidImage('The image could not be converted');
    }
    this.logger.error(`Comment image conversion failed: ${(error as Error)?.message || error}`);
    return invalidImage('The image could not be converted');
  }

  /**
   * Writes the file under its content hash. An identical upload reuses the
   * stored file and refreshes its age so orphan cleanup does not race it.
   */
  private async persist(output: Buffer): Promise<string> {
    const hash = createHash('sha256').update(output).digest('hex');
    const name = `${hash}.webp`;
    const dir = commentImageDir();
    await fs.mkdir(dir, { recursive: true });
    const dirStat = await fs.lstat(dir);
    if (!dirStat.isDirectory()) {
      this.logger.error(`Comment image directory is not a plain directory: ${dir}`);
      throw new InternalServerErrorException('Image storage is unavailable');
    }
    const finalPath = path.join(dir, name);
    const existing = await fs.lstat(finalPath).catch((error) => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    });
    if (existing) {
      if (!existing.isFile()) {
        this.logger.error(`Refusing to reuse a non-file comment image path: ${name}`);
        throw new InternalServerErrorException('Image storage is unavailable');
      }
      const now = new Date();
      await fs.utimes(finalPath, now, now).catch(() => undefined);
      return name;
    }
    const tempPath = path.join(dir, `.${hash}.${randomBytes(8).toString('hex')}.tmp`);
    try {
      await fs.writeFile(tempPath, output, { flag: 'wx', mode: 0o644 });
      await fs.rename(tempPath, finalPath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
    return name;
  }
}
