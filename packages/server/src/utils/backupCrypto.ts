import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BACKUP_MAGIC = Buffer.from('VANBLOG-BACKUP-AES256-GCM-V1\0', 'utf8');
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const deriveKey = (secret: string, salt: Buffer) =>
  scryptSync(secret, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });

export const getBackupEncryptionSecret = () => {
  const secret = String(
    process.env.VANBLOG_BACKUP_ENCRYPTION_KEY || '',
  ).trim();

  if (secret.length < 16) {
    throw new Error(
      '未配置可用的备份加密密钥，请设置 VANBLOG_BACKUP_ENCRYPTION_KEY（至少 16 个字符）',
    );
  }
  return secret;
};

const serializeJsonValue = function* (
  input: any,
  ancestors = new Set<any>(),
  arrayItem = false,
): Generator<string> {
  let value = input;
  if (value && typeof value.toJSON === 'function') {
    value = value.toJSON();
  } else if (value && typeof value.toObject === 'function') {
    value = value.toObject();
  }

  if (value === null) {
    yield 'null';
    return;
  }

  const type = typeof value;
  if (type === 'string' || type === 'boolean') {
    yield JSON.stringify(value);
    return;
  }
  if (type === 'number') {
    yield Number.isFinite(value) ? String(value) : 'null';
    return;
  }
  if (type === 'bigint') {
    throw new TypeError('Do not know how to serialize a BigInt');
  }
  if (type === 'undefined' || type === 'function' || type === 'symbol') {
    if (arrayItem) {
      yield 'null';
    }
    return;
  }

  if (ancestors.has(value)) {
    throw new TypeError('Converting circular structure to JSON');
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      yield '[';
      for (let index = 0; index < value.length; index += 1) {
        if (index > 0) {
          yield ',';
        }
        yield* serializeJsonValue(value[index], ancestors, true);
      }
      yield ']';
      return;
    }

    yield '{';
    let emitted = 0;
    for (const [key, child] of Object.entries(value)) {
      if (
        child === undefined ||
        typeof child === 'function' ||
        typeof child === 'symbol'
      ) {
        continue;
      }
      if (emitted > 0) {
        yield ',';
      }
      yield JSON.stringify(key);
      yield ':';
      yield* serializeJsonValue(child, ancestors, false);
      emitted += 1;
    }
    yield '}';
  } finally {
    ancestors.delete(value);
  }
};

const encryptedBackupChunks = function* (payload: any, secret: string): Generator<Buffer> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret, salt), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  yield BACKUP_MAGIC;
  yield salt;
  yield iv;
  for (const chunk of serializeJsonValue(payload)) {
    const encrypted = cipher.update(chunk, 'utf8');
    if (encrypted.length > 0) {
      yield encrypted;
    }
  }
  const final = cipher.final();
  if (final.length > 0) {
    yield final;
  }
  yield cipher.getAuthTag();
};

export const isEncryptedBackup = (buffer: Buffer) =>
  buffer.length >= BACKUP_MAGIC.length &&
  buffer.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC);

export const decryptBackupBuffer = (buffer: Buffer, secret?: string) => {
  if (!isEncryptedBackup(buffer)) {
    return buffer;
  }
  const decryptionSecrets = secret
    ? [secret]
    : [
        process.env.VANBLOG_BACKUP_ENCRYPTION_KEY,
        // Read-only compatibility for backups created before the dedicated
        // key migration. New backups never use either fallback.
        process.env.WALINE_JWT_TOKEN,
        (global as any).jwtSecret,
      ]
        .map((value) => String(value || '').trim())
        .filter((value, index, values) =>
          value.length >= 16 && values.indexOf(value) === index,
        );
  if (!decryptionSecrets.length) {
    getBackupEncryptionSecret();
  }

  const minimumLength =
    BACKUP_MAGIC.length + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  if (buffer.length < minimumLength) {
    throw new Error('加密备份文件格式不完整');
  }

  let offset = BACKUP_MAGIC.length;
  const salt = buffer.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  const iv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(offset, buffer.length - AUTH_TAG_LENGTH);

  for (const decryptionSecret of decryptionSecrets) {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        deriveKey(decryptionSecret, salt),
        iv,
        { authTagLength: AUTH_TAG_LENGTH },
      );
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      // Try the next legacy-compatible decryption key.
    }
  }
  throw new Error('备份解密失败：密钥错误或文件已损坏');
};

export const parseBackupBuffer = (buffer: Buffer, secret?: string) =>
  JSON.parse(decryptBackupBuffer(buffer, secret).toString('utf8'));

export const writeEncryptedBackupFile = async (
  targetPath: string,
  payload: any,
  secret = getBackupEncryptionSecret(),
) => {
  const temporaryPath = `${targetPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await pipeline(
      Readable.from(encryptedBackupChunks(payload, secret)),
      createWriteStream(temporaryPath, {
        flags: 'wx',
        mode: 0o600,
      }),
    );
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, targetPath);
    await chmod(targetPath, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
};
