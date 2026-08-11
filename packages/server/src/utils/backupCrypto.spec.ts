import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  decryptBackupBuffer,
  getBackupEncryptionSecret,
  isEncryptedBackup,
  parseBackupBuffer,
  writeEncryptedBackupFile,
} from './backupCrypto';

describe('backup encryption', () => {
  const secret = 'test-backup-encryption-key-32-bytes';
  const target = join(tmpdir(), `vanblog-backup-${process.pid}.vbe`);

  afterEach(async () => {
    await rm(target, { force: true });
  });

  it('streams an authenticated encrypted backup that can be restored', async () => {
    const payload = {
      users: [{ name: 'admin', password: 'sensitive-password-hash' }],
      aiTaggingConfig: { apiKey: 'sensitive-api-key' },
      documents: [{ title: 'secret', content: 'private document' }],
      optional: undefined,
      invalidNumber: Number.NaN,
    };

    await writeEncryptedBackupFile(target, payload, secret);
    const encrypted = await readFile(target);

    expect(isEncryptedBackup(encrypted)).toBe(true);
    expect(encrypted.toString('utf8')).not.toContain('sensitive-password-hash');
    expect(encrypted.toString('utf8')).not.toContain('sensitive-api-key');
    expect(parseBackupBuffer(encrypted, secret)).toEqual({
      users: payload.users,
      aiTaggingConfig: payload.aiTaggingConfig,
      documents: payload.documents,
      invalidNumber: null,
    });
  });

  it('rejects a modified encrypted backup before parsing any plaintext', async () => {
    await writeEncryptedBackupFile(target, { articles: [{ id: 1 }] }, secret);
    const encrypted = await readFile(target);
    encrypted[encrypted.length - 20] ^= 1;

    expect(() => decryptBackupBuffer(encrypted, secret)).toThrow(
      '备份解密失败：密钥错误或文件已损坏',
    );
  });

  it('continues to accept legacy plaintext JSON backups', () => {
    const legacy = Buffer.from(JSON.stringify({ backupInfo: { version: '4.0.0' } }));
    expect(parseBackupBuffer(legacy)).toEqual({
      backupInfo: { version: '4.0.0' },
    });
  });

  it('never derives the backup key from database or Waline secrets', () => {
    const previousBackupKey = process.env.VANBLOG_BACKUP_ENCRYPTION_KEY;
    const previousWalineToken = process.env.WALINE_JWT_TOKEN;
    const previousJwtSecret = (global as any).jwtSecret;
    try {
      delete process.env.VANBLOG_BACKUP_ENCRYPTION_KEY;
      process.env.WALINE_JWT_TOKEN = 'waline-secret-that-must-not-encrypt-backups';
      (global as any).jwtSecret = 'database-secret-that-must-not-encrypt-backups';

      expect(() => getBackupEncryptionSecret()).toThrow('备份加密密钥');
    } finally {
      if (previousBackupKey === undefined) {
        delete process.env.VANBLOG_BACKUP_ENCRYPTION_KEY;
      } else {
        process.env.VANBLOG_BACKUP_ENCRYPTION_KEY = previousBackupKey;
      }
      if (previousWalineToken === undefined) {
        delete process.env.WALINE_JWT_TOKEN;
      } else {
        process.env.WALINE_JWT_TOKEN = previousWalineToken;
      }
      if (previousJwtSecret === undefined) {
        delete (global as any).jwtSecret;
      } else {
        (global as any).jwtSecret = previousJwtSecret;
      }
    }
  });

  it('can still decrypt a pre-migration backup made with the Waline secret', async () => {
    const previousBackupKey = process.env.VANBLOG_BACKUP_ENCRYPTION_KEY;
    const previousWalineToken = process.env.WALINE_JWT_TOKEN;
    try {
      process.env.VANBLOG_BACKUP_ENCRYPTION_KEY = 'new-dedicated-backup-key-32-bytes';
      process.env.WALINE_JWT_TOKEN = 'legacy-waline-backup-key-32-bytes';
      await writeEncryptedBackupFile(
        target,
        { backupInfo: { version: 'legacy-key' } },
        process.env.WALINE_JWT_TOKEN,
      );

      expect(parseBackupBuffer(await readFile(target))).toEqual({
        backupInfo: { version: 'legacy-key' },
      });
    } finally {
      if (previousBackupKey === undefined) {
        delete process.env.VANBLOG_BACKUP_ENCRYPTION_KEY;
      } else {
        process.env.VANBLOG_BACKUP_ENCRYPTION_KEY = previousBackupKey;
      }
      if (previousWalineToken === undefined) {
        delete process.env.WALINE_JWT_TOKEN;
      } else {
        process.env.WALINE_JWT_TOKEN = previousWalineToken;
      }
    }
  });
});
