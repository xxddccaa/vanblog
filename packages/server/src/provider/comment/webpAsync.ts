import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export const WEBP_DEFAULT_QUALITY = 80;
export const WEBP_DEFAULT_TIMEOUT_MS = 20_000;

/** How long to wait for a killed encoder to exit before giving up on it. */
const KILL_GRACE_MS = 1_000;
const STDERR_MAX_LENGTH = 2_048;

export interface WebpEncodeOptions {
  /** cwebp -q, 0 to 100. */
  quality?: number;
  /** The encoder is killed with SIGKILL when it runs longer than this. */
  timeoutMs?: number;
  /** cwebp -resize; 0 for one side keeps the aspect ratio. */
  resize?: { width: number; height: number };
  /** Executable to run; tests point this at a stub. */
  binary?: string;
  /** Parent of the per-call scratch directory; defaults to the OS temp dir. */
  tmpRoot?: string;
}

export type WebpEncodeFailure = 'timeout' | 'failed' | 'unavailable';

export class WebpEncodeError extends Error {
  constructor(
    message: string,
    readonly reason: WebpEncodeFailure,
  ) {
    super(message);
    this.name = 'WebpEncodeError';
  }
}

/** Re-encodes an image buffer (PNG, JPEG, WebP or PAM) to WebP. */
export type WebpEncoder = (input: Buffer, options?: WebpEncodeOptions) => Promise<Buffer>;

function runEncoder(binary: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let stderr = '';
    let killTimer: NodeJS.Timeout | undefined;
    let graceTimer: NodeJS.Timeout | undefined;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      clearTimeout(graceTimer);
      if (error) reject(error);
      else resolve();
    };

    const child = spawn(binary, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    killTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      // Normally `close` follows the kill at once; never hang if it does not.
      graceTimer = setTimeout(
        () => finish(new WebpEncodeError(`cwebp timed out after ${timeoutMs} ms`, 'timeout')),
        KILL_GRACE_MS,
      );
    }, timeoutMs);

    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < STDERR_MAX_LENGTH) stderr += chunk.toString('utf8');
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      const message =
        error?.code === 'ENOENT'
          ? 'cwebp is not installed'
          : `cwebp could not be started: ${error?.message}`;
      finish(new WebpEncodeError(message, 'unavailable'));
    });
    child.on('close', (code, signal) => {
      if (timedOut) {
        finish(new WebpEncodeError(`cwebp timed out after ${timeoutMs} ms`, 'timeout'));
        return;
      }
      if (code === 0) {
        finish();
        return;
      }
      const detail = stderr.replace(/\s+/gu, ' ').trim().slice(0, 300);
      finish(
        new WebpEncodeError(
          `cwebp exited with ${code ?? signal}${detail ? `: ${detail}` : ''}`,
          'failed',
        ),
      );
    });
  });
}

/**
 * Non-blocking cwebp runner. Unlike utils/webp.ts it never blocks the event
 * loop: the encoder runs as a child process without a shell, metadata (EXIF,
 * XMP, ICC) is dropped, the process is killed on timeout and the scratch
 * directory is always removed.
 */
export const encodeWebpAsync: WebpEncoder = async (input, options = {}) => {
  const quality = Math.min(100, Math.max(0, Math.round(options.quality ?? WEBP_DEFAULT_QUALITY)));
  const timeoutMs = Math.max(1, options.timeoutMs ?? WEBP_DEFAULT_TIMEOUT_MS);
  const workDir = await fs.mkdtemp(path.join(options.tmpRoot || os.tmpdir(), 'vanblog-cwebp-'));
  try {
    const inputPath = path.join(workDir, 'input');
    const outputPath = path.join(workDir, 'output.webp');
    await fs.writeFile(inputPath, input, { mode: 0o600 });
    const args = ['-quiet', '-metadata', 'none', '-q', String(quality)];
    if (options.resize) {
      args.push(
        '-resize',
        String(Math.max(0, Math.floor(options.resize.width))),
        String(Math.max(0, Math.floor(options.resize.height))),
      );
    }
    args.push(inputPath, '-o', outputPath);
    await runEncoder(options.binary || 'cwebp', args, timeoutMs);
    try {
      return await fs.readFile(outputPath);
    } catch {
      throw new WebpEncodeError('cwebp produced no output', 'failed');
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
};
