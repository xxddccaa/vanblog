jest.mock('fs', () => ({
  mkdtempSync: jest.fn(() => '/tmp/vanblog-webp-test'),
  readFileSync: jest.fn(() => Buffer.from('webp-data')),
  rmSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => ({
    status: 0,
    stderr: Buffer.from(''),
  })),
}));

import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { compressImgToWebp } from './webp';

describe('compressImgToWebp', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('invokes cwebp without using a shell and cleans up temp files', async () => {
    const result = await compressImgToWebp(Buffer.from('image-data'));

    expect(mkdtempSync).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith('/tmp/vanblog-webp-test/input', Buffer.from('image-data'));
    expect(spawnSync).toHaveBeenCalledWith(
      'cwebp',
      ['-q', '80', '/tmp/vanblog-webp-test/input', '-o', '/tmp/vanblog-webp-test/output.webp'],
      {
        stdio: 'pipe',
      },
    );
    expect(readFileSync).toHaveBeenCalledWith('/tmp/vanblog-webp-test/output.webp');
    expect(rmSync).toHaveBeenCalledWith('/tmp/vanblog-webp-test', {
      recursive: true,
      force: true,
    });
    expect(result).toEqual(Buffer.from('webp-data'));
  });

  it('still cleans up the temp directory when cwebp fails', async () => {
    (spawnSync as jest.Mock).mockReturnValueOnce({
      status: 1,
      stderr: Buffer.from('conversion failed'),
    });

    await expect(compressImgToWebp(Buffer.from('image-data'))).rejects.toThrow(
      'conversion failed',
    );
    expect(rmSync).toHaveBeenCalledWith('/tmp/vanblog-webp-test', {
      recursive: true,
      force: true,
    });
  });
});
