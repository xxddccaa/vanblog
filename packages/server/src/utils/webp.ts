import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export const compressImgToWebp = async (srcImage: Buffer) => {
  const workDir = mkdtempSync(join(tmpdir(), 'vanblog-webp-'));
  const srcPath = join(workDir, 'input');
  const outPath = join(workDir, 'output.webp');

  try {
    writeFileSync(srcPath, srcImage);
    const result = spawnSync('cwebp', ['-q', '80', srcPath, '-o', outPath], {
      stdio: 'pipe',
    });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString?.().trim();
      throw new Error(stderr || 'cwebp 压缩失败');
    }

    return readFileSync(outPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};
