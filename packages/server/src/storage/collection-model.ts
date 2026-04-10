import { randomUUID } from 'crypto';
import { PostgresStoreService } from './postgres-store.service';
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

    static async __loadAll() {
      return await this.__store.getAll(this.__collectionName);
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
      const documents = await this.__loadAll();
      const matched = documents.find((item) => matchesQuery(item, query));
      if (!matched) {
        if (options.upsert) {
          const created = applyUpdate({}, update, query, { isUpsertInsert: true });
          for (const [key, value] of Object.entries(query || {})) {
            if (!key.startsWith('$') && !key.includes('.')) {
              created[key] = deepClone(value);
            }
          }
          await this.__saveDocument(created);
          return buildUpdateResult(0, 0, 1);
        }
        return buildUpdateResult(0, 0, 0);
      }
      const next = applyUpdate(matched, update, query);
      await this.__saveDocument(next);
      return buildUpdateResult(1, 1, 0);
    }

    static async updateMany(query: any, update: any, options: Record<string, any> = {}) {
      const documents = await this.__loadAll();
      const matched = documents.filter((item) => matchesQuery(item, query));
      if (!matched.length) {
        if (options.upsert) {
          await this.updateOne(query, update, options);
          return buildUpdateResult(0, 0, 1);
        }
        return buildUpdateResult(0, 0, 0);
      }
      await Promise.all(
        matched.map(async (item) => {
          const next = applyUpdate(item, update, query);
          await this.__saveDocument(next);
        }),
      );
      return buildUpdateResult(matched.length, matched.length, 0);
    }

    static async deleteOne(query: any) {
      const documents = await this.__loadAll();
      const matched = documents.find((item) => matchesQuery(item, query));
      if (!matched?._id) {
        return { acknowledged: true, deletedCount: 0 };
      }
      const deletedCount = await this.__store.deleteByIds(this.__collectionName, [String(matched._id)]);
      return { acknowledged: true, deletedCount };
    }

    static async deleteMany(query: any) {
      const documents = await this.__loadAll();
      const matchedIds = documents
        .filter((item) => matchesQuery(item, query))
        .map((item) => String(item._id));
      const deletedCount = await this.__store.deleteByIds(this.__collectionName, matchedIds);
      return { acknowledged: true, deletedCount };
    }

    static async findByIdAndUpdate(id: string, update: any, options: Record<string, any> = {}) {
      const current = await this.findById(id).exec();
      if (!current) {
        return null;
      }
      const next = applyUpdate(current.toObject(), update, { _id: id });
      await this.__saveDocument(next);
      const result = options.new ? next : current.toObject();
      return this.__wrapDocument(result);
    }

    static async findOneAndUpdate(query: any, update: any, options: Record<string, any> = {}) {
      const current = await this.findOne(query).exec();
      if (!current) {
        if (options.upsert) {
          const created = applyUpdate({}, update, query, { isUpsertInsert: true });
          for (const [key, value] of Object.entries(query || {})) {
            if (!key.startsWith('$') && !key.includes('.')) {
              created[key] = deepClone(value);
            }
          }
          const saved = await this.__saveDocument(created);
          return this.__wrapDocument(saved);
        }
        return null;
      }
      const next = applyUpdate(current.toObject(), update, query);
      await this.__saveDocument(next);
      const result = options.new ? next : current.toObject();
      return this.__wrapDocument(result);
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
