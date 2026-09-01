import {
  compileStorageQueryPlan,
  compileStorageSortPlan,
  PostgresStoreService,
} from './postgres-store.service';
import { applyProjection, applySort, matchesQuery } from './query-engine';
import { deepClone } from './storage.utils';

export class StorageQuery<T = any> implements PromiseLike<any> {
  private sortValue: Record<string, 1 | -1> | undefined;
  private skipValue = 0;
  private limitValue: number | undefined;
  private projectionValue: any;
  private leanValue = false;

  constructor(
    private readonly store: PostgresStoreService,
    private readonly collectionName: string,
    private readonly query: any,
    private readonly wrapDocument: (value: any) => T,
    private readonly mode: 'many' | 'one' | 'count',
    projection?: any,
  ) {
    this.projectionValue = projection;
  }

  sort(sort: Record<string, 1 | -1>) {
    this.sortValue = sort;
    return this;
  }

  skip(skip: number) {
    this.skipValue = skip;
    return this;
  }

  limit(limit: number) {
    this.limitValue = limit;
    return this;
  }

  select(projection: any) {
    this.projectionValue = projection;
    return this;
  }

  lean() {
    this.leanValue = true;
    return this;
  }

  async exec(): Promise<any> {
    const queryPlan = compileStorageQueryPlan(this.query);
    if (this.mode === 'count' && queryPlan.exact) {
      return await this.store.countRecords(this.collectionName, queryPlan);
    }

    const sortPlan = compileStorageSortPlan(
      this.sortValue,
      1 + queryPlan.params.length,
    );
    const hasWindow =
      this.mode === 'one' ||
      this.skipValue > 0 ||
      typeof this.limitValue === 'number';
    const canPushWindow =
      queryPlan.exact &&
      sortPlan.exact &&
      (this.limitValue === undefined || this.limitValue >= 0);
    const shouldUseCandidates =
      queryPlan.hasCandidate ||
      (queryPlan.exact && (hasWindow || Boolean(sortPlan.orderBySql)));
    const records = shouldUseCandidates
      ? await this.store.getRecords(this.collectionName, queryPlan, {
          sortPlan: sortPlan.exact ? sortPlan : undefined,
          skip: canPushWindow ? this.skipValue : undefined,
          limit: canPushWindow
            ? this.mode === 'one'
              ? Math.min(this.limitValue ?? 1, 1)
              : this.limitValue
            : undefined,
        })
      : null;
    const raw = records
      ? records.map((record) => record.payload)
      : await this.store.getAll(this.collectionName);
    let results = raw.filter((item) => matchesQuery(item, this.query));

    if (this.mode === 'count') {
      return results.length;
    }

    if (!canPushWindow) {
      results = applySort(results, this.sortValue as any);
      if (this.skipValue > 0) {
        results = results.slice(this.skipValue);
      }
      if (typeof this.limitValue === 'number') {
        results = results.slice(0, this.limitValue);
      }
    }

    const projected = results.map((item) =>
      this.projectionValue ? applyProjection(item, this.projectionValue) : deepClone(item),
    );

    if (this.mode === 'one') {
      const first = projected[0];
      if (!first) {
        return null;
      }
      return this.leanValue ? first : this.wrapDocument(first);
    }

    return this.leanValue
      ? projected
      : projected.map((item) => this.wrapDocument(item));
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<any> {
    return this.exec().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<any> {
    return this.exec().finally(onfinally);
  }
}
