import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import path from 'path';
import {
  COMMENT_IMAGE_NAME_PATTERN,
  COMMENT_IMAGE_TEMP_PATTERN,
  commentImageDir,
} from 'src/provider/comment/comment-image.provider';
import { InjectModel, Model } from 'src/storage/mongoose-compat';
import { COMMENT_LIMITS } from 'src/types/comment.dto';

/** Names checked against the database per query; keeps the SQL predicate small. */
const REFERENCE_QUERY_BATCH = 100;

export interface CommentImageCleanupResult {
  scanned: number;
  removed: number;
  kept: number;
}

/**
 * Removes visitor images nobody uses: uploads that were never posted, or
 * whose comment was purged. A file is deleted only when its name is a content
 * hash, it is older than imageOrphanTtlSeconds and no stored comment, soft
 * deleted ones included, lists it in `images`.
 *
 * Only regular files directly inside the comment image directory are touched.
 * Symlinks are never followed (a symlinked directory aborts the run) and file
 * names come from a strict pattern, so the task cannot leave the directory.
 */
@Injectable()
export class CommentImageCleanupTask {
  private readonly logger = new Logger(CommentImageCleanupTask.name);
  private running = false;

  constructor(@InjectModel('Comment') private readonly commentModel: Model<any>) {}

  @Cron('0 30 3 * * *')
  async handleCron(): Promise<void> {
    try {
      const result = await this.run();
      if (result.removed) {
        this.logger.log(
          `Removed ${result.removed} orphaned comment image(s), kept ${result.kept} referenced`,
        );
      }
    } catch (error) {
      this.logger.error(`Comment image cleanup failed: ${(error as Error)?.message || error}`);
    }
  }

  async run(now = Date.now()): Promise<CommentImageCleanupResult> {
    const result: CommentImageCleanupResult = { scanned: 0, removed: 0, kept: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      const dir = commentImageDir();
      const dirStat = await fs.lstat(dir).catch((error) => {
        if (error?.code === 'ENOENT') return null;
        throw error;
      });
      if (!dirStat) return result;
      if (!dirStat.isDirectory()) {
        this.logger.warn('Skipped comment image cleanup: the image directory is not a directory');
        return result;
      }

      const cutoff = now - COMMENT_LIMITS.imageOrphanTtlSeconds * 1000;
      const candidates: string[] = [];
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        if (COMMENT_IMAGE_TEMP_PATTERN.test(entry.name)) {
          // Leftover of an interrupted write; never referenced by anything.
          if (await this.isOlderThan(dir, entry.name, cutoff)) {
            result.removed += await this.remove(dir, entry.name, cutoff);
          }
          continue;
        }
        if (!COMMENT_IMAGE_NAME_PATTERN.test(entry.name)) continue;
        result.scanned += 1;
        if (await this.isOlderThan(dir, entry.name, cutoff)) candidates.push(entry.name);
      }
      if (!candidates.length) return result;

      // Any database error aborts the run before a single image is removed.
      const referenced = await this.findReferenced(candidates);
      for (const name of candidates) {
        if (referenced.has(name)) {
          result.kept += 1;
          continue;
        }
        result.removed += await this.remove(dir, name, cutoff);
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  private async findReferenced(names: string[]): Promise<Set<string>> {
    const wanted = new Set(names);
    const referenced = new Set<string>();
    for (let index = 0; index < names.length; index += REFERENCE_QUERY_BATCH) {
      const batch = names.slice(index, index + REFERENCE_QUERY_BATCH);
      const comments: Array<{ images?: unknown }> = await this.commentModel
        .find({ images: { $in: batch } }, { images: 1 })
        .lean();
      for (const comment of comments || []) {
        if (!Array.isArray(comment?.images)) continue;
        for (const image of comment.images) {
          if (typeof image === 'string' && wanted.has(image)) referenced.add(image);
        }
      }
    }
    return referenced;
  }

  /** lstat, so a symlink is judged by itself and never by its target. */
  private async isOlderThan(dir: string, name: string, cutoff: number): Promise<boolean> {
    const stat = await fs.lstat(path.join(dir, name)).catch(() => null);
    return Boolean(stat?.isFile() && stat.mtimeMs < cutoff);
  }

  /**
   * Re-checks right before unlinking: an identical re-upload refreshes the
   * file's mtime, and such a file must survive until its comment is saved.
   * unlink removes a directory entry and never follows a symlink.
   */
  private async remove(dir: string, name: string, cutoff: number): Promise<number> {
    if (!(await this.isOlderThan(dir, name, cutoff))) return 0;
    try {
      await fs.unlink(path.join(dir, name));
      return 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        this.logger.warn(`Could not remove comment image ${name}: ${(error as Error)?.message}`);
      }
      return 0;
    }
  }
}
