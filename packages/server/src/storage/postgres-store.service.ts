import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'src/config';
import { deepClone } from './storage.utils';

@Injectable()
export class PostgresStoreService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PostgresStoreService.name);
  private readonly pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
  });
  private readyPromise: Promise<void> | null = null;

  async onModuleInit() {
    await this.ensureReady();
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }

  async ensureReady() {
    if (!this.readyPromise) {
      this.readyPromise = this.bootstrap();
    }
    await this.readyPromise;
  }

  private async bootstrap() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vanblog_records (
        collection_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection_name, record_id)
      )
    `);
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_records_collection ON vanblog_records (collection_name)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_records_payload ON vanblog_records USING GIN (payload)',
    );
  }

  async listCollections(): Promise<string[]> {
    await this.ensureReady();
    const result = await this.pool.query<{
      collection_name: string;
    }>('SELECT DISTINCT collection_name FROM vanblog_records ORDER BY collection_name');
    return result.rows.map((row) => row.collection_name);
  }

  async getAll(collectionName: string): Promise<any[]> {
    await this.ensureReady();
    const result = await this.pool.query<{ payload: any }>(
      'SELECT payload FROM vanblog_records WHERE collection_name = $1 ORDER BY updated_at ASC, record_id ASC',
      [collectionName],
    );
    return result.rows.map((row) => deepClone(row.payload));
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    await this.ensureReady();
    return await this.pool.query<T>(sql, params);
  }

  async upsert(collectionName: string, payload: Record<string, any>) {
    await this.ensureReady();
    const normalized = deepClone(payload);
    const now = new Date().toISOString();
    if (!normalized._id) {
      normalized._id = randomUUID();
    }
    if (!normalized.createdAt) {
      normalized.createdAt = now;
    }
    normalized.updatedAt = normalized.updatedAt || now;

    await this.pool.query(
      `
        INSERT INTO vanblog_records (collection_name, record_id, payload, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW(), NOW())
        ON CONFLICT (collection_name, record_id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [collectionName, String(normalized._id), JSON.stringify(normalized)],
    );

    return deepClone(normalized);
  }

  async deleteByIds(collectionName: string, recordIds: string[]) {
    await this.ensureReady();
    if (!recordIds.length) {
      return 0;
    }
    const result = await this.pool.query(
      'DELETE FROM vanblog_records WHERE collection_name = $1 AND record_id = ANY($2::text[])',
      [collectionName, recordIds],
    );
    return result.rowCount || 0;
  }

  async exportAllCollections(): Promise<Record<string, any[]>> {
    const names = await this.listCollections();
    const pairs = await Promise.all(
      names.map(async (name) => [name, await this.getAll(name)] as const),
    );
    return Object.fromEntries(pairs);
  }
}
