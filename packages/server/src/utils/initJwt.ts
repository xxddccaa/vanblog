import { Client } from 'pg';
import { loadDatabaseUrl } from 'src/config';
import { randomUUID } from 'crypto';
import { makeSalt } from './crypto';

export const initJwt = async () => {
  const client = new Client({
    connectionString: loadDatabaseUrl(),
  });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS vanblog_records (
        collection_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection_name, record_id)
      )
    `);

    const existing = await client.query<{ payload: { value?: { secret?: string } } }>(
      `
        SELECT payload
        FROM vanblog_records
        WHERE collection_name = 'settings' AND payload->>'type' = 'jwt'
        LIMIT 1
      `,
    );
    const secret = existing.rows[0]?.payload?.value?.secret;
    if (secret) {
      return secret;
    }

    const nextSecret = makeSalt();
    const payload = {
      _id: randomUUID(),
      type: 'jwt',
      value: {
        secret: nextSecret,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await client.query(
      `
        INSERT INTO vanblog_records (collection_name, record_id, payload, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW(), NOW())
      `,
      ['settings', payload._id, JSON.stringify(payload)],
    );
    return nextSecret;
  } finally {
    await client.end();
  }
};
