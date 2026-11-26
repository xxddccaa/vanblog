import {
  asDate,
  dedupeRecords,
  mapArticleRow,
  mapUserRow,
  normalizeArticleCategories,
  normalizeNumericId,
} from './structured-data.mappers';
import { buildArticleOrderSql, buildArticleWhere } from './structured-data.sql';

describe('structured-data helpers', () => {
  it('normalizes numeric ids safely', () => {
    expect(normalizeNumericId(42)).toBe(42);
    expect(normalizeNumericId('17')).toBe(17);
    expect(normalizeNumericId('')).toBeNull();
    expect(normalizeNumericId('   ')).toBeNull();
    expect(normalizeNumericId(null)).toBeNull();
    expect(normalizeNumericId(undefined)).toBeNull();
    expect(normalizeNumericId('abc')).toBeNull();
  });

  it('normalizes dates with ISO fallback for invalid inputs', () => {
    expect(asDate('2026-01-02T03:04:05.000Z')).toBe('2026-01-02T03:04:05.000Z');
    expect(() => new Date(asDate('not-a-date')).toISOString()).not.toThrow();
  });

  it('deduplicates records keeping the latest entry and reporting duplicate count', () => {
    const onDuplicate = jest.fn();
    const result = dedupeRecords(
      [
        { id: 1, title: 'old' },
        { id: 2, title: 'keep' },
        { id: 1, title: 'new' },
      ],
      'article',
      (item) => String(item.id),
      onDuplicate,
    );

    expect(result).toEqual([
      { id: 1, title: 'new' },
      { id: 2, title: 'keep' },
    ]);
    expect(onDuplicate).toHaveBeenCalledWith(1);
  });

  it('normalizes article categories and maps article/user rows', () => {
    expect(normalizeArticleCategories(['Tech', ' Tech ', ''], 'Fallback')).toEqual(['Tech']);
    expect(normalizeArticleCategories([], 'Fallback')).toEqual(['Fallback']);

    expect(mapUserRow(null)).toBeNull();
    expect(
      mapUserRow({
        source_record_id: 'u-1',
        id: '0',
        name: 'admin',
        password: 'hash',
        created_at: '2026-01-01T00:00:00.000Z',
        user_type: 'admin',
        salt: 'salt',
      }),
    ).toMatchObject({ _id: 'u-1', id: 0, name: 'admin', type: 'admin' });

    const article = mapArticleRow({
      id: '5',
      title: 'Hello',
      content: 'Body',
      category: 'Tech',
      categories: ['Tech', 'Notes'],
      tags: ['ts'],
      top_value: '2',
      hidden: false,
      private_flag: false,
      deleted: false,
      viewer: '10',
      visited: '4',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    });
    expect(article).toMatchObject({
      id: 5,
      title: 'Hello',
      categories: ['Tech', 'Notes'],
      top: 2,
      viewer: 10,
      visited: 4,
    });
  });

  it('builds article where clauses and public/admin ordering SQL', () => {
    const where = buildArticleWhere({
      includeHidden: false,
      category: 'Tech',
      tags: 'ts',
    });
    expect(where.whereSql).toContain('a.deleted = FALSE');
    expect(where.whereSql).toContain('a.hidden = FALSE');
    expect(where.params).toEqual(['%Tech%', '%ts%']);

    const publicOrder = buildArticleOrderSql({ sortViewer: 'desc' } as any, true);
    expect(publicOrder).toContain('CASE WHEN a.top_value > 0 THEN 0 ELSE 1 END ASC');
    expect(publicOrder).toContain('a.viewer DESC');

    const adminOrder = buildArticleOrderSql({ sortCreatedAt: 'asc' } as any, false);
    expect(adminOrder).toBe('a.created_at ASC');
  });
});
