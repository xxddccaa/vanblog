import * as fs from 'fs';
import * as path from 'path';
import { formatCacheTags } from './cacheTag';

export const hasContentHash = (basename: string) => /(^|[._-])[a-f0-9]{8,}(?=\.|$)/i.test(basename);

export const setStaticCacheHeaders = (
  kind: 'asset' | 'feed' | 'sitemap' | 'searchIndex',
  res: any,
  filePath: string,
) => {
  const setEdgeCacheHeaders = (browserValue: string, cdnValue?: string) => {
    res.setHeader('Cache-Control', browserValue);
    if (cdnValue) {
      res.setHeader('CDN-Cache-Control', cdnValue);
      res.setHeader('Cloudflare-CDN-Cache-Control', cdnValue);
    }
  };
  const basename = path.basename(filePath);

  if (kind === 'asset') {
    if (basename === 'search-index.json') {
      res.setHeader('Cache-Tag', formatCacheTags(['artifact:search-index']));
      setEdgeCacheHeaders(
        'public, max-age=300, stale-while-revalidate=86400',
        'public, s-maxage=3600, stale-while-revalidate=86400',
      );
      try {
        res.setHeader('Last-Modified', fs.statSync(filePath).mtime.toUTCString());
      } catch {}
      return;
    }

    if (hasContentHash(basename)) {
      setEdgeCacheHeaders('public, max-age=31536000, immutable');
    } else {
      setEdgeCacheHeaders(
        'public, max-age=0, must-revalidate',
        'public, s-maxage=86400, stale-while-revalidate=86400',
      );
    }
    try {
      res.setHeader('Last-Modified', fs.statSync(filePath).mtime.toUTCString());
    } catch {}
    return;
  }

  if (kind === 'feed' || kind === 'sitemap' || kind === 'searchIndex') {
    if (kind === 'feed') {
      res.setHeader('Cache-Tag', formatCacheTags(['artifact:feed']));
    }
    if (kind === 'sitemap') {
      res.setHeader('Cache-Tag', formatCacheTags(['artifact:sitemap']));
    }
    if (kind === 'searchIndex') {
      res.setHeader('Cache-Tag', formatCacheTags(['artifact:search-index']));
    }
    setEdgeCacheHeaders(
      'public, max-age=300, stale-while-revalidate=86400',
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    try {
      res.setHeader('Last-Modified', fs.statSync(filePath).mtime.toUTCString());
    } catch {}
  }
};
