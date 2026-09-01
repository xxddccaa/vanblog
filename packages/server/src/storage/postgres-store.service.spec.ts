import {
  compileStorageQueryPlan,
  compileStorageSortPlan,
} from './postgres-store.service';

describe('PostgresStoreService query plans', () => {
  it('compiles scalar equality, nested paths and array membership as exact candidates', () => {
    const plan = compileStorageQueryPlan({
      status: 'active',
      'profile.name': 'alice',
      tags: 'typescript',
    });

    expect(plan).toMatchObject({ exact: true, hasCandidate: true });
    expect(plan.whereSql).toContain('payload #>');
    expect(plan.whereSql).toContain('jsonb_build_array');
    expect(plan.params).toEqual([
      ['status'],
      '"active"',
      ['profile', 'name'],
      '"alice"',
      ['tags'],
      '"typescript"',
    ]);
  });

  it('compiles $in, $and and fully translatable $or branches', () => {
    const plan = compileStorageQueryPlan({
      $and: [
        { status: { $in: ['active', 'pending'] } },
        { $or: [{ type: 'admin' }, { type: 'collaborator' }] },
      ],
    });

    expect(plan).toMatchObject({ exact: true, hasCandidate: true });
    expect(plan.whereSql).toContain(' OR ');
    expect(plan.whereSql).toContain(' AND ');
  });

  it.each([
    { field: { $exists: true } },
    { field: { $ne: 'x' } },
    { field: { $gte: 10 } },
    { field: { $regex: 'x', $options: 'i' } },
  ])('falls back for unsupported conditions: %p', (query) => {
    const plan = compileStorageQueryPlan(query);

    expect(plan).toMatchObject({
      whereSql: 'TRUE',
      exact: false,
      hasCandidate: false,
    });
  });

  it('keeps an exact AND candidate but refuses unsafe OR narrowing', () => {
    const partialAnd = compileStorageQueryPlan({
      $and: [{ status: 'active' }, { name: { $regex: '^keep' } }],
    });
    const unsafeOr = compileStorageQueryPlan({
      $or: [{ status: 'active' }, { name: { $regex: '^keep' } }],
    });

    expect(partialAnd).toMatchObject({ exact: false, hasCandidate: true });
    expect(partialAnd.whereSql).not.toBe('TRUE');
    expect(unsafeOr).toMatchObject({
      whereSql: 'TRUE',
      exact: false,
      hasCandidate: false,
    });
    expect(unsafeOr.params).toEqual([]);
  });

  it('discards parameters from an unsafe OR while retaining surrounding candidates', () => {
    const plan = compileStorageQueryPlan({
      id: 7,
      $and: [
        {
          $or: [
            { deleted: false },
            { deleted: { $exists: false } },
          ],
        },
      ],
    });

    expect(plan).toMatchObject({
      exact: false,
      hasCandidate: true,
    });
    expect(plan.params).toEqual([['id'], '7']);
    expect(plan.whereSql).toContain('$2::text[]');
    expect(plan.whereSql).toContain('$3::jsonb');
    expect(plan.whereSql).not.toMatch(/\$[4-9]/);
  });

  it('only marks known simple sort fields as exact', () => {
    const exact = compileStorageSortPlan({ sort: 1, createdAt: -1 }, 3);
    const fallback = compileStorageSortPlan({ 'profile.rank': 1 } as any, 3);

    expect(exact.exact).toBe(true);
    expect(exact.orderBySql).toContain('numeric');
    expect(exact.orderBySql).toContain('NULLS LAST');
    expect(exact.params).toEqual([['sort'], ['createdAt']]);
    expect(fallback).toMatchObject({ exact: false, orderBySql: '' });
  });
});
