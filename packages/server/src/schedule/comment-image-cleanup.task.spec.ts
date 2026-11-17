import { Logger } from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';
import { config } from 'src/config';
import { compileStorageQueryPlan } from 'src/storage/postgres-store.service';
import { applyProjection, matchesQuery } from 'src/storage/query-engine';
import { COMMENT_LIMITS } from 'src/types/comment.dto';
import { CommentImageCleanupTask } from './comment-image-cleanup.task';

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 10, 17, 3, 30);
const TTL_MS = COMMENT_LIMITS.imageOrphanTtlSeconds * 1000;
const hashName = (character: string) => `${character.repeat(64)}.webp`;

describe('CommentImageCleanupTask', () => {
  const originalStaticPath = config.staticPath;
  let staticRoot: string;
  let imageDir: string;
  let comments: Array<Record<string, any>>;
  let queries: any[];
  let failQuery: boolean;
  const commentModel = {
    find: jest.fn((query: any, projection: any) => {
      queries.push(query);
      return {
        lean: async () => {
          if (failQuery) throw new Error('database unavailable');
          return comments
            .filter((item) => matchesQuery(item, query))
            .map((item) => applyProjection(item, projection));
        },
      };
    }),
  };
  let task: CommentImageCleanupTask;

  const writeImage = (name: string, ageMs: number) => {
    const file = path.join(imageDir, name);
    writeFileSync(file, 'webp');
    const time = new Date(NOW - ageMs);
    utimesSync(file, time, time);
    return file;
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    config.staticPath = originalStaticPath;
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    staticRoot = mkdtempSync(path.join(os.tmpdir(), 'vanblog-comment-cleanup-spec-'));
    config.staticPath = staticRoot;
    imageDir = path.join(staticRoot, 'img', 'comment');
    mkdirSync(imageDir, { recursive: true });
    comments = [];
    queries = [];
    failQuery = false;
    commentModel.find.mockClear();
    task = new CommentImageCleanupTask(commentModel as any);
  });

  afterEach(() => {
    rmSync(staticRoot, { recursive: true, force: true });
  });

  it('removes old unreferenced images only', async () => {
    writeImage(hashName('a'), TTL_MS + DAY_MS);
    writeImage(hashName('b'), TTL_MS + DAY_MS);
    writeImage(hashName('c'), TTL_MS - 60_000);
    comments.push({ id: 1, status: 'approved', images: [hashName('b')] });

    const result = await task.run(NOW);

    expect(result).toEqual({ scanned: 3, removed: 1, kept: 1 });
    expect(readdirSync(imageDir).sort()).toEqual([hashName('b'), hashName('c')]);
  });

  it('keeps images referenced by soft-deleted, pending and spam comments', async () => {
    for (const [character, status] of [
      ['a', 'deleted'],
      ['b', 'pending'],
      ['c', 'spam'],
    ]) {
      writeImage(hashName(character), TTL_MS * 3);
      comments.push({ id: character.charCodeAt(0), status, images: [hashName(character)] });
    }
    const result = await task.run(NOW);
    expect(result.removed).toBe(0);
    expect(readdirSync(imageDir)).toHaveLength(3);
  });

  it('respects the TTL boundary', async () => {
    writeImage(hashName('a'), TTL_MS + 1_000);
    writeImage(hashName('b'), TTL_MS - 1_000);
    await task.run(NOW);
    expect(readdirSync(imageDir)).toEqual([hashName('b')]);
  });

  it('ignores files that do not look like stored comment images', async () => {
    const others = [
      'notes.txt',
      `${'a'.repeat(63)}.webp`,
      `${'A'.repeat(64)}.webp`,
      `${'a'.repeat(64)}.png`,
      `${'g'.repeat(64)}.webp`,
      `x${'a'.repeat(64)}.webp`,
    ];
    for (const name of others) writeImage(name, TTL_MS * 10);
    const result = await task.run(NOW);
    expect(result).toEqual({ scanned: 0, removed: 0, kept: 0 });
    expect(readdirSync(imageDir).sort()).toEqual([...others].sort());
    expect(commentModel.find).not.toHaveBeenCalled();
  });

  it('never follows or removes symlinks and never leaves the directory', async () => {
    const outside = mkdtempSync(path.join(os.tmpdir(), 'vanblog-comment-cleanup-outside-'));
    try {
      const victim = path.join(outside, hashName('d'));
      writeFileSync(victim, 'precious');
      const old = new Date(NOW - TTL_MS * 10);
      utimesSync(victim, old, old);
      symlinkSync(victim, path.join(imageDir, hashName('e')));
      mkdirSync(path.join(imageDir, hashName('f')));

      const result = await task.run(NOW);

      expect(result.scanned).toBe(0);
      expect(existsSync(victim)).toBe(true);
      expect(readdirSync(imageDir).sort()).toEqual([hashName('e'), hashName('f')].sort());
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('aborts when the image directory is a symlink', async () => {
    const outside = mkdtempSync(path.join(os.tmpdir(), 'vanblog-comment-cleanup-outside-'));
    try {
      writeFileSync(path.join(outside, hashName('a')), 'precious');
      const old = new Date(NOW - TTL_MS * 10);
      utimesSync(path.join(outside, hashName('a')), old, old);
      rmSync(imageDir, { recursive: true });
      symlinkSync(outside, imageDir);

      const result = await task.run(NOW);

      expect(result).toEqual({ scanned: 0, removed: 0, kept: 0 });
      expect(readdirSync(outside)).toEqual([hashName('a')]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('does nothing when the directory does not exist', async () => {
    rmSync(imageDir, { recursive: true });
    await expect(task.run(NOW)).resolves.toEqual({ scanned: 0, removed: 0, kept: 0 });
  });

  it('removes nothing when the reference query fails', async () => {
    writeImage(hashName('a'), TTL_MS * 2);
    failQuery = true;
    await expect(task.run(NOW)).rejects.toThrow('database unavailable');
    expect(readdirSync(imageDir)).toEqual([hashName('a')]);
    // The cron entry point swallows the failure.
    await expect(task.handleCron()).resolves.toBeUndefined();
  });

  it('keeps a file whose age is refreshed by a re-upload during the run', async () => {
    const file = writeImage(hashName('a'), TTL_MS * 2);
    commentModel.find.mockImplementationOnce((query: any) => {
      queries.push(query);
      return {
        lean: async () => {
          const fresh = new Date(NOW);
          utimesSync(file, fresh, fresh);
          return [];
        },
      };
    });
    const result = await task.run(NOW);
    expect(result.removed).toBe(0);
    expect(existsSync(file)).toBe(true);
  });

  it('queries references in batches with an exact SQL plan', async () => {
    const names = Array.from(
      { length: 150 },
      (_, index) => `${index.toString(16).padStart(64, '0')}.webp`,
    );
    for (const name of names) writeImage(name, TTL_MS * 2);
    comments.push({ id: 1, images: [names[3], names[140], 'unrelated.webp'] });

    const result = await task.run(NOW);

    expect(result).toEqual({ scanned: 150, removed: 148, kept: 2 });
    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(Object.keys(query)).toEqual(['images']);
      expect(query.images.$in.length).toBeLessThanOrEqual(100);
      expect(compileStorageQueryPlan(query).exact).toBe(true);
    }
    expect(readdirSync(imageDir).sort()).toEqual([names[3], names[140]].sort());
  });

  it('removes stale scratch files from interrupted writes', async () => {
    const scratch = `.${'a'.repeat(64)}.${'0'.repeat(16)}.tmp`;
    const fresh = `.${'b'.repeat(64)}.${'1'.repeat(16)}.tmp`;
    writeImage(scratch, TTL_MS * 2);
    writeImage(fresh, 1_000);
    const result = await task.run(NOW);
    expect(result.removed).toBe(1);
    expect(readdirSync(imageDir)).toEqual([fresh]);
    expect(commentModel.find).not.toHaveBeenCalled();
  });

  it('does not run twice at the same time', async () => {
    writeImage(hashName('a'), TTL_MS * 2);
    let release: () => void;
    commentModel.find.mockImplementationOnce(() => ({
      lean: () => new Promise((resolve) => (release = () => resolve([]))),
    }));
    const first = task.run(NOW);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(task.run(NOW)).resolves.toEqual({ scanned: 0, removed: 0, kept: 0 });
    release();
    await expect(first).resolves.toEqual({ scanned: 1, removed: 1, kept: 0 });
  });
});
