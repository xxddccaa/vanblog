// Resolves a long-lived secret, persists it to a file and prints it on stdout.
//
// Usage: node ensure-shared-secret.cjs [ENV_NAME ...]
//
// The first ENV_NAME holding a usable value wins and is written to the secret
// file. Otherwise the existing file is reused, and only if it is missing a new
// random secret is generated. Concurrent callers (server and website starting
// at the same time on a shared volume) agree on one value through a lock dir.
//
// Target file: VANBLOG_SHARED_SECRET_FILE, then the pre-rename
// VANBLOG_WALINE_JWT_FILE, then DEFAULT_SECRET_FILE. When neither variable is
// set, an existing LEGACY_SECRET_FILE (the pre-rename default) is adopted, so
// an upgraded deployment keeps its secret. The legacy file is never modified.
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const DEFAULT_SECRET_FILE = '/var/log/vanblog-shared.secret';
const LEGACY_SECRET_FILE = '/var/log/waline.jwt';

const explicitSecretFile =
  process.env.VANBLOG_SHARED_SECRET_FILE || process.env.VANBLOG_WALINE_JWT_FILE || '';
const secretFile = explicitSecretFile || DEFAULT_SECRET_FILE;
const legacySecretFile = explicitSecretFile
  ? process.env.VANBLOG_SHARED_SECRET_LEGACY_FILE || ''
  : process.env.VANBLOG_SHARED_SECRET_LEGACY_FILE || LEGACY_SECRET_FILE;
const secretDir = path.dirname(secretFile);
const secretBasename = path.basename(secretFile);
const lockDir = `${secretFile}.lock`;
const envKeys = process.argv.slice(2);
const weakValues = new Set([
  '',
  'vanblog-change-me',
  'replace-with-a-strong-random-string',
  'replace-with-a-long-random-string',
]);
const readIntEnv = (names, fallback) => {
  for (const name of names) {
    const value = parseInt(process.env[name] || '', 10);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return fallback;
};
const concurrentWaitMs = readIntEnv(
  ['VANBLOG_SHARED_SECRET_WAIT_MS', 'VANBLOG_WALINE_JWT_WAIT_MS'],
  10000,
);
const pollIntervalMs = readIntEnv(
  ['VANBLOG_SHARED_SECRET_POLL_MS', 'VANBLOG_WALINE_JWT_POLL_MS'],
  200,
);

const normalizeSecret = (value) => String(value || '').trim();

const isUsableSecret = (value) => {
  const normalized = normalizeSecret(value);
  return normalized.length >= 16 && !weakValues.has(normalized);
};

const readUsableSecret = async (file) => {
  if (!file) {
    return '';
  }
  try {
    const data = await fs.readFile(file, 'utf8');
    const secret = normalizeSecret(data);
    return isUsableSecret(secret) ? secret : '';
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
};

const readSecretFile = () => readUsableSecret(secretFile);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const writeSecretFile = async (secret, overwrite = false) => {
  await fs.mkdir(secretDir, { recursive: true });
  // A per-process temp name keeps two concurrent overwrites from clobbering
  // each other's temp file before the atomic rename.
  const tempFile = path.join(
    secretDir,
    `.${secretBasename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`,
  );
  const targetFile = overwrite ? tempFile : secretFile;
  await fs.writeFile(targetFile, `${secret}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: overwrite ? 'w' : 'wx',
  });
  if (overwrite) {
    try {
      await fs.rename(tempFile, secretFile);
    } catch (error) {
      await fs.rm(tempFile, { force: true }).catch(() => {});
      throw error;
    }
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
  await fs.mkdir(secretDir, { recursive: true });
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
    if ((await readSecretFile()) !== explicitSecret) {
      await writeSecretFile(explicitSecret, true);
    }
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

    const legacySecret = await readUsableSecret(legacySecretFile);
    const secret = legacySecret || generateSecret();
    try {
      await writeSecretFile(secret, false);
      return secret;
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
    console.error(`[ensure-shared-secret] ${error.message}`);
    process.exit(1);
  });
