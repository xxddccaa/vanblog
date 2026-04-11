import { formatCacheTags, toCacheTag } from './cacheTag';

describe('cacheTag utils', () => {
  it('normalizes cache tag values with lowercase kebab-like output', () => {
    expect(toCacheTag('category', 'System Design')).toBe('category:system-design');
    expect(toCacheTag('tag', ' Cloudflare / CDN ')).toBe('tag:cloudflare-cdn');
    expect(toCacheTag('post', 42)).toBe('post:42');
  });

  it('falls back to prefix or unknown when the source value is empty after normalization', () => {
    expect(toCacheTag('site-stats')).toBe('site-stats');
    expect(toCacheTag('tag', '')).toBe('tag');
    expect(toCacheTag('tag', '!!!')).toBe('tag:unknown');
  });

  it('deduplicates and trims cache tags before joining them', () => {
    expect(
      formatCacheTags([' post:1 ', 'post:1', '', ' site-stats', undefined, 'site-stats ']),
    ).toBe('post:1,site-stats');
  });
});
