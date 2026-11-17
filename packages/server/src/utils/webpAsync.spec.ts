import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';
import { WebpEncodeError, encodeWebpAsync } from './webpAsync';

const writeStub = (dir: string, name: string, body: string) => {
  const file = path.join(dir, name);
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('encodeWebpAsync', () => {
  let root: string;
  let tmpRoot: string;
  let stubs: string;
  let copyStub: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'vanblog-webp-async-spec-'));
    stubs = path.join(root, 'bin');
    tmpRoot = path.join(root, 'tmp');
    mkdirSync(stubs);
    mkdirSync(tmpRoot);
    // Writes its arguments and the input into the -o target, like a fake cwebp.
    copyStub = writeStub(
      stubs,
      'cwebp-copy',
      [
        'prev=""; input=""; output=""',
        'for arg in "$@"; do',
        '  if [ "$prev" = "-o" ]; then output="$arg"; fi',
        '  if [ "$arg" = "-o" ]; then input="$prev"; fi',
        '  prev="$arg"',
        'done',
        'printf "ARGS:%s\\n" "$*" > "$output"',
        'cat "$input" >> "$output"',
      ].join('\n'),
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  afterEach(() => {
    // Every call must remove its scratch directory, whatever the outcome.
    expect(readdirSync(tmpRoot)).toEqual([]);
  });

  it('runs the encoder without a shell and returns its output', async () => {
    const output = await encodeWebpAsync(Buffer.from('image-bytes'), {
      binary: copyStub,
      tmpRoot,
    });
    const [argsLine, ...rest] = output.toString('utf8').split('\n');
    expect(rest.join('\n')).toBe('image-bytes');
    const args = argsLine.replace(/^ARGS:/u, '').split(' ');
    expect(args.slice(0, 5)).toEqual(['-quiet', '-metadata', 'none', '-q', '80']);
    expect(args[5]).toMatch(/vanblog-cwebp-[^/]+\/input$/u);
    expect(args[6]).toBe('-o');
    expect(args[7]).toMatch(/vanblog-cwebp-[^/]+\/output\.webp$/u);
  });

  it('passes quality and resize options', async () => {
    const output = await encodeWebpAsync(Buffer.from('x'), {
      binary: copyStub,
      tmpRoot,
      quality: 55.4,
      resize: { width: 4096, height: 0 },
    });
    expect(output.toString('utf8')).toContain('-q 55 -resize 4096 0 ');
  });

  it('rejects with the exit status and stderr when the encoder fails', async () => {
    const failing = writeStub(stubs, 'cwebp-fail', 'echo "Could not process file" >&2\nexit 2');
    const error = await encodeWebpAsync(Buffer.from('x'), { binary: failing, tmpRoot }).catch(
      (err) => err,
    );
    expect(error).toBeInstanceOf(WebpEncodeError);
    expect(error.reason).toBe('failed');
    expect(error.message).toContain('exited with 2');
    expect(error.message).toContain('Could not process file');
  });

  it('rejects when the encoder succeeds without writing output', async () => {
    const silent = writeStub(stubs, 'cwebp-silent', 'exit 0');
    const error = await encodeWebpAsync(Buffer.from('x'), { binary: silent, tmpRoot }).catch(
      (err) => err,
    );
    expect(error).toBeInstanceOf(WebpEncodeError);
    expect(error.reason).toBe('failed');
  });

  it('reports a missing encoder as unavailable', async () => {
    const error = await encodeWebpAsync(Buffer.from('x'), {
      binary: path.join(stubs, 'does-not-exist'),
      tmpRoot,
    }).catch((err) => err);
    expect(error).toBeInstanceOf(WebpEncodeError);
    expect(error.reason).toBe('unavailable');
  });

  it('kills an encoder that runs past the timeout', async () => {
    const pidFile = path.join(root, 'slow.pid');
    const slow = writeStub(stubs, 'cwebp-slow', `echo $$ > "${pidFile}"\nexec sleep 30`);
    const started = Date.now();
    const error = await encodeWebpAsync(Buffer.from('x'), {
      binary: slow,
      tmpRoot,
      timeoutMs: 300,
    }).catch((err) => err);
    expect(error).toBeInstanceOf(WebpEncodeError);
    expect(error.reason).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(5_000);
    const pid = Number(readFileSync(pidFile, 'utf8'));
    expect(pid).toBeGreaterThan(0);
    expect(isAlive(pid)).toBe(false);
  });

  it('does not block the event loop while the encoder runs', async () => {
    const sleeper = writeStub(stubs, 'cwebp-sleep', `sleep 0.3\n"${copyStub}" "$@"`);
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
    }, 20);
    try {
      await encodeWebpAsync(Buffer.from('x'), { binary: sleeper, tmpRoot });
    } finally {
      clearInterval(interval);
    }
    expect(ticks).toBeGreaterThanOrEqual(5);
  });
});
