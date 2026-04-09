import { describe, expect, it } from 'vitest';
import { filterSearchIndex } from './search';

describe('filterSearchIndex', () => {
  const index = [
    {
      id: 1,
      title: 'Cloudflare Cache Strategy',
      category: 'Architecture',
      tags: ['cloudflare', 'cache'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      preview: 'Move dynamic fragments out of stable HTML.',
      searchText: 'cloudflare cache strategy architecture cloudflare cache move dynamic fragments out of stable html',
    },
    {
      id: 2,
      title: 'Edge Friendly Search',
      category: 'Search',
      tags: ['index'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z',
      preview: 'Serve a static search index from the edge.',
      searchText: 'edge friendly search search index serve a static search index from the edge',
    },
  ];

  it('matches against the normalized search text', () => {
    const result = filterSearchIndex(index, 'stable html');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('prefers title prefix matches over generic content matches', () => {
    const result = filterSearchIndex(index, 'edge');
    expect(result[0].id).toBe(2);
  });
});
