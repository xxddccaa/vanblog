const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const secretFile = process.env.VANBLOG_WALINE_JWT_FILE || '/var/log/waline.jwt';
const secretDir = path.dirname(secretFile);
const secretBasename = path.basename(secretFile);
const tempFile = path.join(secretDir, `.${secretBasename}.tmp`);
const lockDir = `${secretFile}.lock`;
const envKeys = process.argv.slice(2);
const weakValues = new Set([
  '',
  'vanblog-change-me',
  'replace-with-a-strong-random-string',
  'replace-with-a-long-random-string',
]);
const concurrentWaitMs = parseInt(process.env.VANBLOG_WALINE_JWT_WAIT_MS || '10000', 10);
const pollIntervalMs = parseInt(process.env.VANBLOG_WALINE_JWT_POLL_MS || '200', 10);

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const writeSecretFile = async (secret, overwrite = false) => {
  await fs.mkdir(secretDir, { recursive: true });
  const targetFile = overwrite ? tempFile : secretFile;
  await fs.writeFile(targetFile, `${secret}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: overwrite ? 'w' : 'wx',
  });
  if (overwrite) {
    await fs.rename(tempFile, secretFile);
  }
  try {
    await fs.chmod(secretFile, 0o600);
  } catch (_error) {}
};

const generateSecret = () => crypto.randomBytes(32).toString('hex');

const waitForConcurrentSecret = async () => {
  const deadline = Date.now() + concurrentWaitMs;
  while (Date.now() < deadline) {
    const secret = await readSecretFile();
    if (secret) {
      return secret;
    }
    await sleep(pollIntervalMs);
  }
  return '';
};

const withSecretLock = async (fn) => {
  for (;;) {
    try {
      await fs.mkdir(lockDir, { recursive: false });
      break;
    } catch (error) {
      if (error && error.code === 'EEXIST') {
        const concurrentSecret = await waitForConcurrentSecret();
        if (concurrentSecret) {
          return concurrentSecret;
        }

        try {
          await fs.rm(lockDir, { recursive: true, force: true });
        } catch (_error) {}
        continue;
      }
      throw error;
    }
  }

  try {
    return await fn();
  } finally {
    try {
      await fs.rm(lockDir, { recursive: true, force: true });
    } catch (_error) {}
  }
};

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

  return withSecretLock(async () => {
    const lockedSecret = await readSecretFile();
    if (lockedSecret) {
      return lockedSecret;
    }

    const generatedSecret = generateSecret();
    try {
      await writeSecretFile(generatedSecret, false);
      return generatedSecret;
    } catch (error) {
      if (error && error.code === 'EEXIST') {
        const concurrentSecret = await waitForConcurrentSecret();
        if (concurrentSecret) {
          return concurrentSecret;
        }
      }
      throw error;
    }
  });
};

ensureSecret()
  .then((secret) => {
    process.stdout.write(secret);
  })
  .catch((error) => {
    console.error(`[ensure-waline-jwt] ${error.message}`);
    process.exit(1);
  });
