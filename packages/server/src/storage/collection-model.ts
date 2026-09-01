import { randomUUID } from 'crypto';
import {
  compileStorageQueryPlan,
  PostgresStoreService,
} from './postgres-store.service';
import { applyUpdate, matchesQuery } from './query-engine';
import { StorageQuery } from './query';
import { deepClone } from './storage.utils';

export class Document {
  _id?: string;
  private __model: any;

  constructor(model?: any, payload?: Record<string, any>) {
    Object.defineProperty(this, '__model', {
      value: model,
      enumerable: false,
      configurable: false,
      writable: true,
    });
    if (payload) {
      Object.assign(this, deepClone(payload));
    }
  }

  get _doc() {
    return this.toObject();
  }

  toObject() {
    const result: Record<string, any> = {};
    for (const key of Object.keys(this)) {
      result[key] = deepClone((this as any)[key]);
    }
    return result;
  }

  toJSON() {
    return this.toObject();
  }

  async save() {
    if (!this.__model) {
      throw new Error('Document model is not attached');
    }
    const saved = await this.__model.__saveDocument(this.toObject());
    for (const key of Object.keys(this)) {
      delete (this as any)[key];
    }
    Object.assign(this, saved);
    return this;
  }
}

const buildUpdateResult = (matchedCount: number, modifiedCount: number, upsertedCount = 0) => ({
  acknowledged: true,
  matchedCount,
  modifiedCount,
  upsertedCount,
});

export type Model<T = any> = {
  new (payload?: Record<string, any>): T & Document;
  find(query?: any, projection?: any): StorageQuery<T>;
  findOne(query?: any, projection?: any): StorageQuery<T>;
  findById(id: string): StorageQuery<T>;
  countDocuments(query?: any): StorageQuery<T>;
  count(query?: any): StorageQuery<T>;
  create(payload: any): Promise<any>;
  updateOne(query: any, update: any, options?: Record<string, any>): Promise<any>;
  updateMany(query: any, update: any, options?: Record<string, any>): Promise<any>;
  deleteOne(query: any): Promise<any>;
  deleteMany(query: any): Promise<any>;
  findByIdAndUpdate(id: string, update: any, options?: Record<string, any>): Promise<any>;
  findOneAndUpdate(query: any, update: any, options?: Record<string, any>): Promise<any>;
  bulkWrite(operations: any[]): Promise<any>;
};

export const createStorageModel = <T = any>(
  collectionName: string,
  store: PostgresStoreService,
): Model<T> => {
  class StorageModel extends Document {
    static __collectionName = collectionName;
    static __store = store;

    constructor(payload?: Record<string, any>) {
      super(StorageModel, payload);
      if (!(this as any)._id) {
        (this as any)._id = randomUUID();
      }
    }

    static __wrapDocument(value: Record<string, any>) {
      return new StorageModel(value) as any;
    }

    static async __saveDocument(payload: Record<string, any>) {
      const normalized = deepClone(payload);
      if (!normalized._id) {
        normalized._id = randomUUID();
      }
      return await this.__store.upsert(this.__collectionName, normalized);
    }

    static find(query: any = {}, projection?: any) {
      return new StorageQuery<T>(
        this.__store,
        this.__collectionName,
        query,
        this.__wrapDocument.bind(this),
        'many',
        projection,
      );
    }

    static findOne(query: any = {}, projection?: any) {
      return new StorageQuery<T>(
        this.__store,
        this.__collectionName,
        query,
        this.__wrapDocument.bind(this),
        'one',
        projection,
      );
    }

    static findById(id: string) {
      return this.findOne({ _id: id });
    }

    static countDocuments(query: any = {}) {
      return new StorageQuery<T>(
        this.__store,
        this.__collectionName,
        query,
        this.__wrapDocument.bind(this),
        'count',
      );
    }

    static count(query: any = {}) {
      return this.countDocuments(query);
    }

    static async create(payload: any) {
      if (Array.isArray(payload)) {
        return await Promise.all(payload.map((item) => this.create(item)));
      }
      const document = new StorageModel(payload);
      return await document.save();
    }

    static async updateOne(query: any, update: any, options: Record<string, any> = {}) {
      const queryPlan = compileStorageQueryPlan(query);
      return await this.__store.mutateRecords(
        this.__collectionName,
        queryPlan,
        async (records, context) => {
          const matched = records.map((record) => record.payload).find((item) =>
            matchesQuery(item, query),
          );
          if (!matched) {
            if (options.upsert) {
              const created = this.__buildUpsertPayload(query, update);
              await context.upsert(created);
              return buildUpdateResult(0, 0, 1);
            }
            return buildUpdateResult(0, 0, 0);
          }
          const next = applyUpdate(matched, update, query);
          await context.upsert(next);
          return buildUpdateResult(1, 1, 0);
        },
        { limit: queryPlan.exact ? 1 : undefined },
      );
    }

    static __buildUpsertPayload(query: any, update: any) {
      const created = applyUpdate({}, update, query, { isUpsertInsert: true });
      for (const [key, value] of Object.entries(query || {})) {
        if (!key.startsWith('$') && !key.includes('.')) {
          created[key] = deepClone(value);
        }
      }
      if (!created._id) {
        created._id = randomUUID();
      }
      return created;
    }

    static async updateMany(query: any, update: any, options: Record<string, any> = {}) {
      const queryPlan = compileStorageQueryPlan(query);
      return await this.__store.mutateRecords(
        this.__collectionName,
        queryPlan,
        async (records, context) => {
          const matched = records
            .map((record) => record.payload)
            .filter((item) => matchesQuery(item, query));
          if (!matched.length) {
            if (options.upsert) {
              await context.upsert(this.__buildUpsertPayload(query, update));
              return buildUpdateResult(0, 0, 1);
            }
            return buildUpdateResult(0, 0, 0);
          }
          for (const item of matched) {
            await context.upsert(applyUpdate(item, update, query));
          }
          return buildUpdateResult(matched.length, matched.length, 0);
        },
      );
    }

    static async deleteOne(query: any) {
      const queryPlan = compileStorageQueryPlan(query);
      return await this.__store.mutateRecords(
        this.__collectionName,
        queryPlan,
        async (records, context) => {
          const matched = records.find((record) => matchesQuery(record.payload, query));
          if (!matched) {
            return { acknowledged: true, deletedCount: 0 };
          }
          const deletedCount = await context.deleteByIds([matched.recordId]);
          return { acknowledged: true, deletedCount };
        },
        { limit: queryPlan.exact ? 1 : undefined },
      );
    }

    static async deleteMany(query: any) {
      const queryPlan = compileStorageQueryPlan(query);
      return await this.__store.mutateRecords(
        this.__collectionName,
        queryPlan,
        async (records, context) => {
          const matchedIds = records
            .filter((record) => matchesQuery(record.payload, query))
            .map((record) => record.recordId);
          const deletedCount = await context.deleteByIds(matchedIds);
          return { acknowledged: true, deletedCount };
        },
      );
    }

    static async findByIdAndUpdate(id: string, update: any, options: Record<string, any> = {}) {
      return await this.findOneAndUpdate(
        { _id: id },
        update,
        { ...options, upsert: false },
      );
    }

    static async findOneAndUpdate(query: any, update: any, options: Record<string, any> = {}) {
      const queryPlan = compileStorageQueryPlan(query);
      return await this.__store.mutateRecords(
        this.__collectionName,
        queryPlan,
        async (records, context) => {
          const current = records.find((record) => matchesQuery(record.payload, query));
          if (!current) {
            if (options.upsert) {
              const saved = await context.upsert(this.__buildUpsertPayload(query, update));
              return this.__wrapDocument(saved);
            }
            return null;
          }
          const previous = deepClone(current.payload);
          const next = applyUpdate(previous, update, query);
          await context.upsert(next);
          return this.__wrapDocument(options.new ? next : previous);
        },
        { limit: queryPlan.exact ? 1 : undefined },
      );
    }

    static async bulkWrite(operations: any[]) {
      let matchedCount = 0;
      let modifiedCount = 0;
      let upsertedCount = 0;
      for (const operation of operations || []) {
        if (operation.updateOne) {
          const result = await this.updateOne(
            operation.updateOne.filter,
            operation.updateOne.update,
            { upsert: operation.updateOne.upsert },
          );
          matchedCount += result.matchedCount || 0;
          modifiedCount += result.modifiedCount || 0;
          upsertedCount += result.upsertedCount || 0;
        }
      }
      return { acknowledged: true, matchedCount, modifiedCount, upsertedCount };
    }
  }

  return StorageModel as unknown as Model<T>;
};
