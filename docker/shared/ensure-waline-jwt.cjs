const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const secretFile = process.env.VANBLOG_WALINE_JWT_FILE || '/var/log/waline.jwt';
const envKeys = process.argv.slice(2);
const weakValues = new Set([
  '',
  'vanblog-change-me',
  'replace-with-a-strong-random-string',
  'replace-with-a-long-random-string',
]);

const normalizeSecret = (value) => String(value || '').trim();

const isUsableSecret = (value) => {
  const normalized = normalizeSecret(value);
  return normalized.length >= 16 && !weakValues.has(normalized);
};

const readSecretFile = async () => {
  try {
    const data = await fs.readFile(secretFile, 'utf8');
    const secret = normalizeSecret(data);
    return isUsableSecret(secret) ? secret : '';
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
};

const writeSecretFile = async (secret, overwrite = false) => {
  await fs.mkdir(path.dirname(secretFile), { recursive: true });
  const flag = overwrite ? 'w' : 'wx';
  await fs.writeFile(secretFile, `${secret}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag,
  });
  try {
    await fs.chmod(secretFile, 0o600);
  } catch (_error) {}
};

const generateSecret = () => crypto.randomBytes(32).toString('hex');

const ensureSecret = async () => {
  const explicitSecret = envKeys
    .map((key) => normalizeSecret(process.env[key]))
    .find((value) => isUsableSecret(value));

  if (explicitSecret) {
    await writeSecretFile(explicitSecret, true);
    return explicitSecret;
  }

  const existingSecret = await readSecretFile();
  if (existingSecret) {
    return existingSecret;
  }

  const generatedSecret = generateSecret();
  try {
    await writeSecretFile(generatedSecret, false);
    return generatedSecret;
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      const concurrentSecret = await readSecretFile();
      if (concurrentSecret) {
        return concurrentSecret;
      }
    }
    throw error;
  }
};

ensureSecret()
  .then((secret) => {
    process.stdout.write(secret);
  })
  .catch((error) => {
    console.error(`[ensure-waline-jwt] ${error.message}`);
    process.exit(1);
  });
