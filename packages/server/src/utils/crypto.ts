/**
 * crypto 常用封装方法
 */

import { createHash, randomBytes } from 'node:crypto';
import { sha256 } from 'js-sha256';
import { Algorithm, hash, verify } from '@node-rs/argon2';

// 随机盐
export function makeSalt(): string {
  return randomBytes(32).toString('base64');
}

/**
 * 使用盐加密浏览器端密🐎
 * @param username 用户名
 * @param password 密码
 * @param salt 密码盐
 */
export function encryptPassword(username: string, password: string, salt: string): string {
  if (!username || !password || !salt) {
    return '';
  }
  return sha256(sha256(username + sha256(password + salt)) + salt + sha256(username + salt));
}

export async function hashPasswordCredential(password: string) {
  return await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
    outputLen: 32,
  });
}

export async function verifyPasswordCredential(
  storedPassword: string,
  submittedPassword: string,
  legacyPassword?: string,
) {
  if (storedPassword?.startsWith('$argon2id$')) {
    return await verify(storedPassword, submittedPassword);
  }
  return Boolean(legacyPassword && storedPassword === legacyPassword);
}

export function isArgonPasswordHash(value: string) {
  return typeof value === 'string' && value.startsWith('$argon2id$');
}

export async function verifyProtectedContentPassword(
  storedPassword: string,
  submittedPassword: string,
) {
  if (!storedPassword || !submittedPassword) return false;
  if (isArgonPasswordHash(storedPassword)) {
    return await verify(storedPassword, submittedPassword);
  }
  return storedPassword === submittedPassword;
}
/**
 * 把没加过盐的密码洗成加盐的
 * @param username 用户名
 * @param password 密码
 * @param salt 密码盐
 */
export function washPassword(username: string, password: string, salt: string) {
  username = username.toLowerCase();
  const browserPassword = sha256(
    username + sha256(sha256(sha256(sha256(password))) + sha256(username)),
  );
  return encryptPassword(username, browserPassword, salt);
}

// 计算 流 MD5
export function encryptFileMD5(buffer: Buffer) {
  const md5 = createHash('md5');

  return md5.update(buffer).digest('hex');
}
