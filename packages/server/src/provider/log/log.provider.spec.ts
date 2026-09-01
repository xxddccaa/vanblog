import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LogProvider } from './log.provider';

describe('LogProvider system log tail', () => {
  let tempDir: string;
  let logPath: string;
  let provider: LogProvider;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanblog-log-tail-'));
    logPath = path.join(tempDir, 'vanblog-stdio.log');
    provider = Object.create(LogProvider.prototype);
    (provider as any).systemLogPath = logPath;
    (provider as any).logPath = path.join(tempDir, 'vanblog-event.log');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads only the requested tail window and returns an append cursor', async () => {
    const lines = Array.from({ length: 12000 }, (_, index) => `line-${index}`);
    fs.writeFileSync(logPath, `${lines.join('\n')}\n`);
    const readSpy = jest.spyOn(provider as any, 'readFileRange');

    const result = await provider.tailSystemLog(undefined, 1000);

    expect(result.reset).toBe(true);
    expect(result.data).toHaveLength(1000);
    expect(result.data[0]).toBe('line-11000');
    expect(result.data.at(-1)).toBe('line-11999');
    expect(result.nextCursor).toEqual(expect.any(String));
    const requestedBytes = readSpy.mock.calls.reduce(
      (total, [, start, end]) => total + Number(end) - Number(start),
      0,
    );
    expect(requestedBytes).toBeLessThan(fs.statSync(logPath).size);
  });

  it('reads only appended UTF-8 lines after the cursor', async () => {
    fs.writeFileSync(logPath, 'first\n第二行\n');
    const initial = await provider.tailSystemLog(undefined, 1000);
    fs.appendFileSync(logPath, '追加一\n追加二\n');

    const appended = await provider.tailSystemLog(initial.nextCursor, 1000);
    const unchanged = await provider.tailSystemLog(appended.nextCursor, 1000);

    expect(appended).toMatchObject({
      data: ['追加一', '追加二'],
      total: 2,
      reset: false,
    });
    expect(unchanged).toMatchObject({
      data: [],
      total: 0,
      reset: false,
    });
  });

  it('keeps an unfinished line and split UTF-8 bytes pending across polls', async () => {
    const prefix = Buffer.from('prefix中');
    fs.writeFileSync(logPath, prefix.subarray(0, prefix.length - 1));
    const initial = await provider.tailSystemLog(undefined, 1000);
    fs.appendFileSync(
      logPath,
      Buffer.concat([prefix.subarray(prefix.length - 1), Buffer.from('文\nnext\n')]),
    );

    const result = await provider.tailSystemLog(initial.nextCursor, 1000);

    expect(result.data).toEqual(['prefix中文', 'next']);
    expect(result.reset).toBe(false);
  });

  it('keeps cursors bounded for an oversized line without a newline', async () => {
    fs.writeFileSync(logPath, Buffer.alloc(5 * 1024 * 1024, 97));

    const initial = await provider.tailSystemLog(undefined, 1000);
    fs.appendFileSync(logPath, '\nnext\n');
    const next = await provider.tailSystemLog(initial.nextCursor, 1000);

    expect(initial.data).toEqual([]);
    expect(initial.nextCursor?.length).toBeLessThan(512);
    expect(next.data).toEqual(['next']);
    expect(next.nextCursor?.length).toBeLessThan(512);
  });

  it('resets safely for invalid cursors', async () => {
    fs.writeFileSync(logPath, 'safe-line\n');

    const result = await provider.tailSystemLog('%%%not-a-cursor%%%', 1000);
    const fractionalCursor = Buffer.from(
      JSON.stringify({
        dev: 1,
        ino: 1,
        offset: 1.5,
        anchor: '',
      }),
    ).toString('base64url');
    const fractionalResult = await provider.tailSystemLog(fractionalCursor, 1000);

    expect(result).toMatchObject({
      data: ['safe-line'],
      reset: true,
    });
    expect(result.nextCursor?.length).toBeLessThan(512);
    expect(fractionalResult).toMatchObject({
      data: ['safe-line'],
      reset: true,
    });
  });

  it('resets to a fresh tail when the file is truncated', async () => {
    fs.writeFileSync(logPath, 'before-1\nbefore-2\nbefore-3\n');
    const initial = await provider.tailSystemLog(undefined, 1000);
    fs.truncateSync(logPath, 0);
    fs.appendFileSync(logPath, 'after-1\nafter-2\n');

    const result = await provider.tailSystemLog(initial.nextCursor, 1000);

    expect(result).toMatchObject({
      data: ['after-1', 'after-2'],
      total: 2,
      reset: true,
    });
  });

  it('resets after copytruncate even when the replacement file grows beyond the old offset', async () => {
    fs.writeFileSync(logPath, 'old-1\nold-2\nold-3\n');
    const initial = await provider.tailSystemLog(undefined, 1000);
    fs.truncateSync(logPath, 0);
    fs.appendFileSync(logPath, 'replacement-1\nreplacement-2\nreplacement-3\nreplacement-4\n');

    const result = await provider.tailSystemLog(initial.nextCursor, 1000);

    expect(result.reset).toBe(true);
    expect(result.data).toEqual([
      'replacement-1',
      'replacement-2',
      'replacement-3',
      'replacement-4',
    ]);
  });

  it('resets when the readable log file rotates to a new inode', async () => {
    fs.writeFileSync(logPath, 'old-line\n');
    const initial = await provider.tailSystemLog(undefined, 1000);
    fs.renameSync(logPath, `${logPath}.1`);
    fs.writeFileSync(logPath, 'new-line\n');

    const result = await provider.tailSystemLog(initial.nextCursor, 1000);

    expect(result).toMatchObject({
      data: ['new-line'],
      total: 1,
      reset: true,
    });
  });

  it('returns an empty reset snapshot when no system log exists', async () => {
    await expect(provider.tailSystemLog(undefined, 1000)).resolves.toEqual({
      data: [],
      total: 0,
      nextCursor: null,
      reset: true,
    });
  });
});
