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

const ensureWalineSchema = async (client, prefix) => {
  const safePrefix = prefix.replace(/[^A-Za-z0-9_]/g, '');
  if (!safePrefix) {
    throw new Error('Invalid Waline table prefix');
  }

  const sql = `
CREATE SEQUENCE IF NOT EXISTS ${safePrefix}comment_seq;
CREATE TABLE IF NOT EXISTS ${safePrefix}comment (
  id integer NOT NULL DEFAULT nextval('${safePrefix}comment_seq'::regclass),
  user_id integer,
  insertedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  ip text,
  link text,
  mail text,
  nick text NOT NULL,
  pid integer,
  rid integer,
  "like" integer DEFAULT 0,
  comment text,
  status text,
  sticky boolean DEFAULT FALSE,
  ua text,
  url text,
  objectId text,
  createdAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  avatar text,
  label text,
  type text DEFAULT '',
  PRIMARY KEY (id)
);

CREATE SEQUENCE IF NOT EXISTS ${safePrefix}counter_seq;
CREATE TABLE IF NOT EXISTS ${safePrefix}counter (
  id integer NOT NULL DEFAULT nextval('${safePrefix}counter_seq'::regclass),
  time integer DEFAULT 0,
  url text,
  objectId text,
  createdAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE SEQUENCE IF NOT EXISTS ${safePrefix}users_seq;
CREATE TABLE IF NOT EXISTS ${safePrefix}users (
  id integer NOT NULL DEFAULT nextval('${safePrefix}users_seq'::regclass),
  display_name text,
  email text,
  github text,
  insertedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  label text,
  link text,
  objectId text,
  password text,
  type text DEFAULT 'user',
  avatar text,
  createdAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  ip text,
  token text,
  uid text,
  url text,
  verified text,
  nick text,
  mail text,
  "2fa" text,
  PRIMARY KEY (id)
);
`;
  await client.query(sql);
  console.log('[host-dev-db] ensured waline schema');
};

const main = async () => {
  await loadShellEnv();

  const appUrl = new URL(process.env.VAN_BLOG_DATABASE_URL);
  const walineUrl = new URL(process.env.VAN_BLOG_WALINE_DATABASE_URL);
  const maintenanceDb = process.env.PG_BOOTSTRAP_DATABASE || 'postgres';
  const walinePrefix = process.env.PG_PREFIX || process.env.POSTGRES_PREFIX || 'wl_';

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
    await ensureDatabase(bootstrapClient, walineUrl.pathname.replace(/^\/+/, '') || 'waline');
  } finally {
    await bootstrapClient.end();
  }

  const walineClient = new Client({
    host: walineUrl.hostname,
    port: Number(walineUrl.port || 5432),
    user: decodeURIComponent(walineUrl.username || 'postgres'),
    password: decodeURIComponent(walineUrl.password || ''),
    database: walineUrl.pathname.replace(/^\/+/, '') || 'waline',
  });

  await walineClient.connect();
  try {
    await ensureWalineSchema(walineClient, walinePrefix);
  } finally {
    await walineClient.end();
  }
};

main().catch((error) => {
  console.error('[host-dev-db] failed', error);
  process.exit(1);
});
