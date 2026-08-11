import {
  encryptPassword,
  hashPasswordCredential,
  verifyPasswordCredential,
  verifyProtectedContentPassword,
} from './crypto';

describe('password hashing', () => {
  it('uses Argon2id for newly stored credentials', async () => {
    const hash = await hashPasswordCredential('browser-prehashed-password');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPasswordCredential(hash, 'browser-prehashed-password'),
    ).resolves.toBe(true);
    await expect(verifyPasswordCredential(hash, 'wrong')).resolves.toBe(false);
  });

  it('supports legacy admin and protected-content values for gradual migration', async () => {
    const legacy = encryptPassword('admin', 'submitted', 'salt');

    await expect(
      verifyPasswordCredential(legacy, 'submitted', legacy),
    ).resolves.toBe(true);
    await expect(
      verifyProtectedContentPassword('legacy-article-password', 'legacy-article-password'),
    ).resolves.toBe(true);
  });
});
