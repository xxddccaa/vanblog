import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasContentHash, setStaticCacheHeaders } from './staticCacheHeaders';

describe('staticCacheHeaders', () => {
  let tempDir: string;

  const createRes = () => {
    const headers = new Map<string, string>();
    return {
      headers,
      setHeader: (key: string, value: string) => headers.set(key, value),
      getHeader: (key: string) => headers.get(key),
    };
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-cache-headers-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createTempFile = (name: string) => {
    const filePath = path.join(tempDir, name);
    fs.writeFileSync(filePath, 'cache-test');
    const mtime = new Date('2026-04-11T00:00:00.000Z');
    fs.utimesSync(filePath, mtime, mtime);
    return filePath;
  };

  it('detects content-hashed asset names', () => {
    expect(hasContentHash('app.12345678.js')).toBe(true);
    expect(hasContentHash('chunk-abcdef123456.css')).toBe(true);
    expect(hasContentHash('favicon.ico')).toBe(false);
  });

  it('uses immutable browser caching for content-hashed assets', () => {
    const res = createRes();
    setStaticCacheHeaders('asset', res, createTempFile('app.12345678.js'));

    expect(res.getHeader('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(res.getHeader('CDN-Cache-Control')).toBeUndefined();
    expect(res.getHeader('Cloudflare-CDN-Cache-Control')).toBeUndefined();
    expect(res.getHeader('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('uses shorter revalidated caching for fixed-path assets', () => {
    const res = createRes();
    setStaticCacheHeaders('asset', res, createTempFile('favicon.ico'));

    expect(res.getHeader('Cache-Control')).toBe('public, max-age=0, must-revalidate');
    expect(res.getHeader('CDN-Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    expect(res.getHeader('Cloudflare-CDN-Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    expect(res.getHeader('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect(res.getHeader('Cache-Control')).not.toContain('immutable');
  });

  it('uses dedicated cache headers for search index artifacts', () => {
    const res = createRes();
    setStaticCacheHeaders('asset', res, createTempFile('search-index.json'));

    expect(res.getHeader('Cache-Control')).toBe('public, max-age=300, stale-while-revalidate=86400');
    expect(res.getHeader('Cloudflare-CDN-Cache-Control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
    expect(res.getHeader('Cache-Tag')).toContain('artifact:search-index');
  });

  it('uses long edge caching for feed and sitemap artifacts', () => {
    const feedRes = createRes();
    const jsonFeedRes = createRes();
    const atomRes = createRes();
    const sitemapRes = createRes();
    const searchIndexRes = createRes();

    setStaticCacheHeaders('feed', feedRes, createTempFile('feed.xml'));
    setStaticCacheHeaders('feed', jsonFeedRes, createTempFile('feed.json'));
    setStaticCacheHeaders('feed', atomRes, createTempFile('atom.xml'));
    setStaticCacheHeaders('sitemap', sitemapRes, createTempFile('sitemap.xml'));
    setStaticCacheHeaders('searchIndex', searchIndexRes, createTempFile('search-index.json'));

    expect(feedRes.getHeader('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=86400',
    );
    expect(feedRes.getHeader('Cloudflare-CDN-Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    expect(jsonFeedRes.getHeader('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=86400',
    );
    expect(jsonFeedRes.getHeader('Cloudflare-CDN-Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    expect(atomRes.getHeader('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=86400',
    );
    expect(atomRes.getHeader('Cloudflare-CDN-Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    expect(sitemapRes.getHeader('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=86400',
    );
    expect(sitemapRes.getHeader('Cloudflare-CDN-Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    expect(searchIndexRes.getHeader('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=86400',
    );
    expect(searchIndexRes.getHeader('Cloudflare-CDN-Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    expect(feedRes.getHeader('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect(jsonFeedRes.getHeader('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect(atomRes.getHeader('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect(sitemapRes.getHeader('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect(searchIndexRes.getHeader('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect(feedRes.getHeader('Cache-Tag')).toContain('artifact:feed');
    expect(jsonFeedRes.getHeader('Cache-Tag')).toContain('artifact:feed');
    expect(atomRes.getHeader('Cache-Tag')).toContain('artifact:feed');
    expect(sitemapRes.getHeader('Cache-Tag')).toContain('artifact:sitemap');
    expect(searchIndexRes.getHeader('Cache-Tag')).toContain('artifact:search-index');
  });
});
