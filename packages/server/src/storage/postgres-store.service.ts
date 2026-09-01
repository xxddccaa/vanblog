import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'src/config';
import { deepClone, isPlainObject } from './storage.utils';

export interface StorageQueryPlan {
  whereSql: string;
  params: any[];
  exact: boolean;
  hasCandidate: boolean;
}

export interface StorageSortPlan {
  orderBySql: string;
  params: any[];
  exact: boolean;
}

export interface StorageRecord {
  recordId: string;
  payload: Record<string, any>;
}

export interface StorageMutationContext {
  upsert(payload: Record<string, any>): Promise<Record<string, any>>;
  deleteByIds(recordIds: string[]): Promise<number>;
}

type CompiledFragment = {
  sql: string;
  exact: boolean;
  hasCandidate: boolean;
};

const NUMERIC_SORT_FIELDS = new Set([
  'id',
  'sort',
  'sort_order',
  'viewer',
  'visited',
  'top',
  'articleCount',
  'parent_id',
  'library_id',
  'userId',
  'expiresIn',
]);

const TEXT_SORT_FIELDS = new Set([
  '_id',
  'name',
  'title',
  'type',
  'date',
  'pathname',
  'createdAt',
  'updatedAt',
  'lastVisitedTime',
]);

const isSupportedScalar = (value: any) =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const toJsonParameter = (value: any) => JSON.stringify(value);

export const compileStorageQueryPlan = (
  query: any,
  existingParameterCount = 1,
): StorageQueryPlan => {
  const params: any[] = [];
  const addParam = (value: any) => {
    params.push(value);
    return `$${existingParameterCount + params.length}`;
  };
  const pathExpression = (path: string) => {
    const pathParam = addParam(path.split('.'));
    return `(payload #> ${pathParam}::text[])`;
  };
  const scalarPredicate = (path: string, expected: any): CompiledFragment => {
    if (!isSupportedScalar(expected)) {
      return { sql: 'TRUE', exact: false, hasCandidate: false };
    }
    const valueExpression = pathExpression(path);
    const valueParam = addParam(toJsonParameter(expected));
    return {
      sql: `(
        ${valueExpression} = ${valueParam}::jsonb
        OR (
          jsonb_typeof(${valueExpression}) = 'array'
          AND ${valueExpression} @> jsonb_build_array(${valueParam}::jsonb)
        )
      )`,
      exact: true,
      hasCandidate: true,
    };
  };

  const compileField = (path: string, expected: any): CompiledFragment => {
    if (
      isPlainObject(expected) &&
      Object.keys(expected).some((key) => key.startsWith('$'))
    ) {
      const fragments: CompiledFragment[] = [];
      let exact = true;
      for (const [operator, operatorValue] of Object.entries(expected)) {
        if (operator === '$in') {
          const values = Array.isArray(operatorValue) ? operatorValue : [operatorValue];
          if (!values.every(isSupportedScalar)) {
            exact = false;
            continue;
          }
          if (values.length === 0) {
            fragments.push({ sql: 'FALSE', exact: true, hasCandidate: true });
            continue;
          }
          const choices = values.map((value) => scalarPredicate(path, value));
          fragments.push({
            sql: `(${choices.map((choice) => choice.sql).join(' OR ')})`,
            exact: true,
            hasCandidate: true,
          });
          continue;
        }
        exact = false;
      }
      const candidates = fragments.filter((fragment) => fragment.hasCandidate);
      return {
        sql: candidates.length
          ? `(${candidates.map((fragment) => fragment.sql).join(' AND ')})`
          : 'TRUE',
        exact: exact && fragments.every((fragment) => fragment.exact),
        hasCandidate: candidates.length > 0,
      };
    }
    return scalarPredicate(path, expected);
  };

  const compileNode = (node: any): CompiledFragment => {
    if (!node || !isPlainObject(node) || Object.keys(node).length === 0) {
      return { sql: 'TRUE', exact: true, hasCandidate: false };
    }

    const fragments: CompiledFragment[] = [];
    let exact = true;
    for (const [key, expected] of Object.entries(node)) {
      if (key === '$and') {
        if (!Array.isArray(expected)) {
          fragments.push({ sql: 'TRUE', exact: false, hasCandidate: false });
          exact = false;
          continue;
        }
        const children = expected.map((item) => compileNode(item));
        const candidates = children.filter((child) => child.hasCandidate);
        fragments.push({
          sql: candidates.length
            ? `(${candidates.map((child) => child.sql).join(' AND ')})`
            : 'TRUE',
          exact: children.every((child) => child.exact),
          hasCandidate: candidates.length > 0,
        });
        exact = exact && children.every((child) => child.exact);
        continue;
      }
      if (key === '$or') {
        const parameterCountBeforeOr = params.length;
        if (!Array.isArray(expected)) {
          fragments.push({ sql: 'TRUE', exact: false, hasCandidate: false });
          exact = false;
          continue;
        }
        if (expected.length === 0) {
          fragments.push({ sql: 'FALSE', exact: true, hasCandidate: true });
          continue;
        }
        const children = expected.map((item) => compileNode(item));
        const canRestrict = children.every((child) => child.hasCandidate);
        if (!canRestrict) {
          params.splice(parameterCountBeforeOr);
        }
        fragments.push({
          sql: canRestrict
            ? `(${children.map((child) => child.sql).join(' OR ')})`
            : 'TRUE',
          exact: canRestrict && children.every((child) => child.exact),
          hasCandidate: canRestrict,
        });
        exact = exact && canRestrict && children.every((child) => child.exact);
        continue;
      }
      if (key.startsWith('$')) {
        fragments.push({ sql: 'TRUE', exact: false, hasCandidate: false });
        exact = false;
        continue;
      }
      const field = compileField(key, expected);
      fragments.push(field);
      exact = exact && field.exact;
    }

    const candidates = fragments.filter((fragment) => fragment.hasCandidate);
    return {
      sql: candidates.length
        ? `(${candidates.map((fragment) => fragment.sql).join(' AND ')})`
        : 'TRUE',
      exact,
      hasCandidate: candidates.length > 0,
    };
  };

  const compiled = compileNode(query);
  return {
    whereSql: compiled.sql,
    params,
    exact: compiled.exact,
    hasCandidate: compiled.hasCandidate,
  };
};

export const compileStorageSortPlan = (
  sort: Record<string, 1 | -1> | undefined,
  existingParameterCount = 1,
): StorageSortPlan => {
  if (!sort || Object.keys(sort).length === 0) {
    return { orderBySql: '', params: [], exact: true };
  }

  const params: any[] = [];
  const clauses: string[] = [];
  let exact = true;
  for (const [field, directionValue] of Object.entries(sort)) {
    const direction = directionValue === -1 ? 'DESC' : 'ASC';
    const nulls = directionValue === -1 ? 'NULLS LAST' : 'NULLS FIRST';
    if (field.includes('.') || field.startsWith('$')) {
      exact = false;
      continue;
    }
    params.push([field]);
    const pathParam = `$${existingParameterCount + params.length}`;
    if (NUMERIC_SORT_FIELDS.has(field)) {
      clauses.push(`CASE
        WHEN jsonb_typeof(payload #> ${pathParam}::text[]) = 'number'
          THEN (payload #>> ${pathParam}::text[])::numeric
        ELSE NULL
      END ${direction} ${nulls}`);
      continue;
    }
    clauses.push(`(payload #>> ${pathParam}::text[]) ${direction} ${nulls}`);
    if (!TEXT_SORT_FIELDS.has(field)) {
      exact = false;
    }
  }

  return {
    orderBySql: clauses.join(', '),
    params,
    exact: exact && clauses.length === Object.keys(sort).length,
  };
};

@Injectable()
export class PostgresStoreService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PostgresStoreService.name);
  private readonly pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
  });
  private readyPromise: Promise<void> | null = null;

  constructor() {
    // Prevent idle-client disconnects from crashing the whole Nest process.
    this.pool.on('error', (error) => {
      this.logger.error(`PostgreSQL 连接意外中断: ${error?.message || error}`);
    });
  }

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
    const client = await this.pool.connect();
    try {
      // Guard schema bootstrap so concurrent initializers do not race on CREATE INDEX.
      await client.query('SELECT pg_advisory_lock($1, $2)', [12686, 1]);
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
      await client.query(
        'CREATE INDEX IF NOT EXISTS idx_vanblog_records_collection ON vanblog_records (collection_name)',
      );
      await client.query(
        'CREATE INDEX IF NOT EXISTS idx_vanblog_records_payload ON vanblog_records USING GIN (payload)',
      );
    } finally {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [12686, 1]);
      } finally {
        client.release();
      }
    }
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

  async getRecords(
    collectionName: string,
    queryPlan: StorageQueryPlan,
    options: {
      sortPlan?: StorageSortPlan;
      skip?: number;
      limit?: number;
    } = {},
  ): Promise<StorageRecord[]> {
    await this.ensureReady();
    const sortPlan = options.sortPlan || { orderBySql: '', params: [], exact: true };
    const params = [collectionName, ...queryPlan.params, ...sortPlan.params];
    const orderBySql = sortPlan.orderBySql
      ? `${sortPlan.orderBySql}, updated_at ASC, record_id ASC`
      : 'updated_at ASC, record_id ASC';
    let windowSql = '';
    if (typeof options.limit === 'number' && options.limit >= 0) {
      params.push(Math.trunc(options.limit));
      windowSql += ` LIMIT $${params.length}`;
    }
    if (typeof options.skip === 'number' && options.skip > 0) {
      if (!windowSql) {
        windowSql += ' LIMIT ALL';
      }
      params.push(Math.trunc(options.skip));
      windowSql += ` OFFSET $${params.length}`;
    }
    const result = await this.pool.query<{ record_id: string; payload: any }>(
      `
        SELECT record_id, payload
        FROM vanblog_records
        WHERE collection_name = $1
          AND (${queryPlan.whereSql})
        ORDER BY ${orderBySql}
        ${windowSql}
      `,
      params,
    );
    return result.rows.map((row) => ({
      recordId: row.record_id,
      payload: deepClone(row.payload),
    }));
  }

  async countRecords(collectionName: string, queryPlan: StorageQueryPlan) {
    await this.ensureReady();
    const result = await this.pool.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM vanblog_records
        WHERE collection_name = $1
          AND (${queryPlan.whereSql})
      `,
      [collectionName, ...queryPlan.params],
    );
    return Number(result.rows[0]?.total || 0);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    await this.ensureReady();
    return await this.pool.query<T>(sql, params);
  }

  private normalizeRecordPayload(payload: Record<string, any>) {
    const normalized = deepClone(payload);
    const now = new Date().toISOString();
    if (!normalized._id) {
      normalized._id = randomUUID();
    }
    if (!normalized.createdAt) {
      normalized.createdAt = now;
    }
    normalized.updatedAt = normalized.updatedAt || now;
    return normalized;
  }

  private async upsertRecord(
    executor: Pick<PoolClient, 'query'>,
    collectionName: string,
    payload: Record<string, any>,
  ) {
    const normalized = this.normalizeRecordPayload(payload);
    await executor.query(
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

  async upsert(collectionName: string, payload: Record<string, any>) {
    await this.ensureReady();
    return await this.upsertRecord(this.pool, collectionName, payload);
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

  async mutateRecords<T>(
    collectionName: string,
    queryPlan: StorageQueryPlan,
    mutation: (
      records: StorageRecord[],
      context: StorageMutationContext,
    ) => Promise<T> | T,
    options: { limit?: number } = {},
  ): Promise<T> {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `vanblog_records:${collectionName}`,
      ]);
      const params = [collectionName, ...queryPlan.params];
      let limitSql = '';
      if (typeof options.limit === 'number' && options.limit > 0) {
        params.push(Math.trunc(options.limit));
        limitSql = `LIMIT $${params.length}`;
      }
      const selected = await client.query<{ record_id: string; payload: any }>(
        `
          SELECT record_id, payload
          FROM vanblog_records
          WHERE collection_name = $1
            AND (${queryPlan.whereSql})
          ORDER BY updated_at ASC, record_id ASC
          ${limitSql}
          FOR UPDATE
        `,
        params,
      );
      const context: StorageMutationContext = {
        upsert: async (payload) =>
          await this.upsertRecord(client, collectionName, payload),
        deleteByIds: async (recordIds) => {
          if (!recordIds.length) {
            return 0;
          }
          const result = await client.query(
            `
              DELETE FROM vanblog_records
              WHERE collection_name = $1
                AND record_id = ANY($2::text[])
            `,
            [collectionName, recordIds],
          );
          return result.rowCount || 0;
        },
      };
      const result = await mutation(
        selected.rows.map((row) => ({
          recordId: row.record_id,
          payload: deepClone(row.payload),
        })),
        context,
      );
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async exportAllCollections(): Promise<Record<string, any[]>> {
    const names = await this.listCollections();
    const pairs = await Promise.all(
      names.map(async (name) => [name, await this.getAll(name)] as const),
    );
    return Object.fromEntries(pairs);
  }
}
