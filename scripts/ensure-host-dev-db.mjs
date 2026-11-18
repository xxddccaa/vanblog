import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const requireFromServer = createRequire(path.join(rootDir, 'packages/server/package.json'));
const { Client } = requireFromServer('pg');

const loadShellEnv = async () => {
  const envPath = path.join(rootDir, 'scripts', 'host-dev-env.sh');
  const content = await fs.promises.readFile(envPath, 'utf8');
  const exportLine = /^export\s+([A-Z0-9_]+)=["']?(.*?)["']?$/;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const match = line.match(exportLine);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = rawValue
      .replace(/\$\{([A-Z0-9_]+):-([^}]+)\}/g, (_, envKey, fallback) => process.env[envKey] || fallback)
      .replace(/\$\{([A-Z0-9_]+)\}/g, (_, envKey) => process.env[envKey] || '')
      .replace(/\$(\{)?ROOT_DIR(\})?/g, rootDir);
  }
};

const ensureDatabase = async (client, databaseName) => {
  const safeDbName = databaseName.replace(/"/g, '""');
  const query = `
    SELECT format('CREATE DATABASE "%s"', '${safeDbName}')
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${databaseName}');
  `;
  const result = await client.query(query);
  const statement = result.rows?.[0]?.format;
  if (statement) {
    await client.query(statement);
    console.log(`[host-dev-db] created database ${databaseName}`);
  } else {
    console.log(`[host-dev-db] database ${databaseName} already exists`);
  }
};

const main = async () => {
  await loadShellEnv();

  const appUrl = new URL(process.env.VAN_BLOG_DATABASE_URL);
  const maintenanceDb = process.env.PG_BOOTSTRAP_DATABASE || 'postgres';

  const bootstrapClient = new Client({
    host: appUrl.hostname,
    port: Number(appUrl.port || 5432),
    user: decodeURIComponent(appUrl.username || 'postgres'),
    password: decodeURIComponent(appUrl.password || ''),
    database: maintenanceDb,
  });

  await bootstrapClient.connect();
  try {
    await ensureDatabase(bootstrapClient, appUrl.pathname.replace(/^\/+/, '') || 'vanblog');
  } finally {
    await bootstrapClient.end();
  }
};

main().catch((error) => {
  console.error('[host-dev-db] failed', error);
  process.exit(1);
});
