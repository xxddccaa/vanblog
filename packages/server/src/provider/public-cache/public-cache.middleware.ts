import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { formatCacheTags, toCacheTag } from 'src/utils/cacheTag';

const setEdgeCacheHeaders = (res: Response, browserValue: string, cdnValue: string) => {
  res.setHeader('Cache-Control', browserValue);
  res.setHeader('CDN-Cache-Control', cdnValue);
  res.setHeader('Cloudflare-CDN-Cache-Control', cdnValue);
};

const setNoStoreHeaders = (res: Response) => {
  setEdgeCacheHeaders(res, 'no-store', 'no-store');
};

const AUTH_COOKIE_NAMES = new Set([
  'auth',
  'authorization',
  'connect.sid',
  'next-auth.session-token',
  'session',
  'session-id',
  'session_id',
  'sessionid',
  'token',
]);

const hasAuthenticatedCookie = (cookieHeader?: string | string[]) => {
  if (!cookieHeader) {
    return false;
  }

  const raw = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
  return raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      const [name] = part.split('=');
      const normalizedName = name?.trim().toLowerCase();
      if (!normalizedName) {
        return false;
      }
      return (
        AUTH_COOKIE_NAMES.has(normalizedName) ||
        normalizedName.endsWith('.token') ||
        normalizedName.endsWith('_token') ||
        normalizedName.endsWith('-token') ||
        normalizedName.includes('session-token') ||
        normalizedName.startsWith('__secure-next-auth') ||
        normalizedName.startsWith('__host-next-auth')
      );
    });
};

const AUTH_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'token',
  'x-token',
  'x-api-key',
  'api-key',
]);

const hasAuthLikeHeader = (headers: Request['headers'] = {}) => {
  return Object.keys(headers).some((rawName) => {
    const name = rawName.toLowerCase();
    if (AUTH_HEADER_NAMES.has(name)) {
      return true;
    }
    if (name.startsWith('x-') && (name.includes('token') || name.includes('auth'))) {
      return true;
    }
    return name.endsWith('-token') || name.endsWith('_token') || name.includes('api-key');
  });
};

const buildStrongEtag = (body: unknown) =>
  `"${createHash('sha1')
    .update(JSON.stringify(body) || '')
    .digest('hex')}"`;

const collectLatestTimestamp = (payload: unknown): number | null => {
  let latest: number | null = null;

  const visit = (value: unknown) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }

    if (typeof value !== 'object') {
      return;
    }

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (['updatedAt', 'createdAt', 'lastVisitedTime'].includes(key)) {
        const time = new Date(nestedValue as any).getTime();
        if (!Number.isNaN(time)) {
          latest = latest === null ? time : Math.max(latest, time);
        }
      }
      visit(nestedValue);
    }
  };

  visit(payload);
  return latest;
};

const normalizeEtagHeader = (value?: string | string[]) => {
  if (!value) {
    return [];
  }
  const raw = Array.isArray(value) ? value.join(',') : value;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const decodeCacheSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const applyPublicValidators = (req: Request, res: Response) => {
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    const existingEtag = typeof res.getHeader === 'function' ? res.getHeader('ETag') : undefined;
    const etag = existingEtag || buildStrongEtag(body);
    if (!existingEtag) {
      res.setHeader('ETag', etag as string);
    }

    if (!res.getHeader('Last-Modified')) {
      const latest = collectLatestTimestamp(body);
      if (latest !== null) {
        res.setHeader('Last-Modified', new Date(latest).toUTCString());
      }
    }

    const requestEtags = normalizeEtagHeader(req.headers['if-none-match']);
    const responseEtag = String(res.getHeader('ETag') || '');
    const lastModifiedValue = res.getHeader('Last-Modified');
    const requestModifiedSince = req.headers['if-modified-since'];

    if (responseEtag && requestEtags.includes(responseEtag)) {
      res.status(304);
      return res.send();
    }

    if (lastModifiedValue && requestModifiedSince) {
      const current = new Date(String(lastModifiedValue)).getTime();
      const requested = new Date(String(requestModifiedSince)).getTime();
      if (!Number.isNaN(current) && !Number.isNaN(requested) && current <= requested) {
        res.status(304);
        return res.send();
      }
    }

    return originalJson(body);
  }) as any;
};

const toQueryValueList = (value: unknown) => {
  if (value === undefined || value === null) {
    return [];
  }

  return (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
};

const getPublicCacheTags = (path: string, query: Record<string, unknown> = {}) => {
  const tags = ['public-api'];
  const articleMatch = path.match(/^\/api\/public\/article\/([^/]+)$/);
  const navMatch = path.match(/^\/api\/public\/article\/([^/]+)\/nav$/);
  const engagementMatch = path.match(/^\/api\/public\/article\/([^/]+)\/engagement$/);
  const fragmentsMatch = path.match(/^\/api\/public\/article\/([^/]+)\/fragments$/);
  const viewerMatch = path.match(/^\/api\/public\/article\/viewer\/([^/]+)$/);
  const tagArticlesMatch = path.match(/^\/api\/public\/tag-articles\/([^/]+)$/);
  const categoryArticlesMatch = path.match(/^\/api\/public\/category\/([^/]+)\/articles$/);
  const timelineArticlesMatch = path.match(/^\/api\/public\/timeline\/([^/]+)\/articles$/);
  const archiveMonthMatch = path.match(/^\/api\/public\/archive\/([^/]+)\/([^/]+)\/articles$/);
  const categoryArchiveSummaryMatch = path.match(/^\/api\/public\/category\/([^/]+)\/archive\/summary$/);
  const categoryArchiveMonthMatch = path.match(
    /^\/api\/public\/category\/([^/]+)\/archive\/([^/]+)\/([^/]+)\/articles$/,
  );
  const tagArchiveSummaryMatch = path.match(/^\/api\/public\/tag\/([^/]+)\/archive\/summary$/);
  const tagArchiveMonthMatch = path.match(
    /^\/api\/public\/tag\/([^/]+)\/archive\/([^/]+)\/([^/]+)\/articles$/,
  );

  if (articleMatch) {
    tags.push('article-shell', toCacheTag('post', articleMatch[1]));
  }
  if (navMatch) {
    tags.push('article-nav', toCacheTag('post', navMatch[1]));
  }
  if (engagementMatch) {
    tags.push('article-engagement', toCacheTag('post', engagementMatch[1]));
  }
  if (fragmentsMatch) {
    tags.push('article-fragments', 'article-ranking', toCacheTag('post', fragmentsMatch[1]));
  }
  if (viewerMatch) {
    tags.push('article-engagement', toCacheTag('post', viewerMatch[1]));
  }
  if (tagArticlesMatch) {
    tags.push('tag-articles', toCacheTag('tag', decodeCacheSegment(tagArticlesMatch[1])));
  }
  if (categoryArticlesMatch) {
    tags.push('category-articles', toCacheTag('category', decodeCacheSegment(categoryArticlesMatch[1])));
  }
  if (timelineArticlesMatch) {
    tags.push('timeline-articles', toCacheTag('timeline', decodeCacheSegment(timelineArticlesMatch[1])));
  }
  if (archiveMonthMatch) {
    tags.push('archive-month', toCacheTag('archive-month', `${archiveMonthMatch[1]}-${archiveMonthMatch[2]}`));
  }
  if (path === '/api/public/article') {
    tags.push('article-listing', 'site-stats');
    const categories = toQueryValueList(query.category);
    const tagFilters = toQueryValueList(query.tags);

    if (!categories.length && !tagFilters.length) {
      tags.push('home');
    }

    for (const category of categories) {
      tags.push(toCacheTag('category', decodeCacheSegment(category)));
    }
    for (const tag of tagFilters) {
      tags.push(toCacheTag('tag', decodeCacheSegment(tag)));
    }
  }
  if (path === '/api/public/site-stats') {
    tags.push('site-stats');
  }
  if (path === '/api/public/meta') {
    tags.push('public-meta');
  }
  if (path === '/api/public/site-info') {
    tags.push('site-info');
  }
  if (path === '/api/public/customPage/all') {
    tags.push('custom-page-list');
  }
  if (path === '/api/public/customPage') {
    tags.push('custom-page');
  }
  if (path === '/api/public/category/summary') {
    tags.push('category-summary');
  }
  if (path === '/api/public/archive/summary') {
    tags.push('archive-summary');
  }
  if (categoryArchiveSummaryMatch) {
    const category = decodeCacheSegment(categoryArchiveSummaryMatch[1]);
    tags.push('archive-summary', toCacheTag('category-archive-summary', category), toCacheTag('category', category));
  }
  if (categoryArchiveMonthMatch) {
    const category = decodeCacheSegment(categoryArchiveMonthMatch[1]);
    const year = decodeCacheSegment(categoryArchiveMonthMatch[2]);
    const month = decodeCacheSegment(categoryArchiveMonthMatch[3]);
    tags.push(
      'archive-month',
      toCacheTag('category', category),
      toCacheTag('category-archive-month', `${category}-${year}-${month}`),
    );
  }
  if (path === '/api/public/category') {
    tags.push('category-list');
  }
  if (path === '/api/public/timeline/summary') {
    tags.push('timeline-summary');
  }
  if (path === '/api/public/timeline') {
    tags.push('timeline-list');
  }
  if (path === '/api/public/tags/hot') {
    tags.push('tag-hot');
  }
  if (path === '/api/public/tags/paginated' || path === '/api/public/tags/all') {
    tags.push('tag-list');
  }
  if (tagArchiveSummaryMatch) {
    const tag = decodeCacheSegment(tagArchiveSummaryMatch[1]);
    tags.push('archive-summary', toCacheTag('tag-archive-summary', tag), toCacheTag('tag', tag));
  }
  if (tagArchiveMonthMatch) {
    const tag = decodeCacheSegment(tagArchiveMonthMatch[1]);
    const year = decodeCacheSegment(tagArchiveMonthMatch[2]);
    const month = decodeCacheSegment(tagArchiveMonthMatch[3]);
    tags.push(
      'archive-month',
      toCacheTag('tag', tag),
      toCacheTag('tag-archive-month', `${tag}-${year}-${month}`),
    );
  }
  if (path === '/api/public/icon' || path.startsWith('/api/public/icon/')) {
    tags.push('icon-public');
  }
  if (path === '/api/public/music/setting' || path === '/api/public/music/list') {
    tags.push('music-public');
  }
  if (path.startsWith('/api/public/nav')) {
    tags.push('nav-public');
  }
  if (path.startsWith('/api/public/moment')) {
    tags.push('moment-public');
  }
  return formatCacheTags(tags);
};

@Injectable()
export class PublicCacheMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headers = req.headers || {};

    if (!['GET', 'HEAD'].includes(req.method)) {
      setNoStoreHeaders(res);
      return next();
    }

    if (hasAuthLikeHeader(headers) || hasAuthenticatedCookie(headers.cookie)) {
      setNoStoreHeaders(res);
      return next();
    }

    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = ((name: string, value: string | readonly string[]) => {
      if (String(name).toLowerCase() === 'set-cookie') {
        setNoStoreHeaders(res);
      }
      return originalSetHeader(name, value as any);
    }) as any;

    applyPublicValidators(req, res);

    const path = req.path;
    const cacheTags = getPublicCacheTags(path, (req.query || {}) as Record<string, unknown>);
    if (cacheTags) {
      res.setHeader('Cache-Tag', cacheTags);
    }

    if (path === '/api/public/search' || path === '/api/public/search/all') {
      setNoStoreHeaders(res);
      return next();
    }

    if (path === '/api/public/nav/admin-data') {
      setNoStoreHeaders(res);
      return next();
    }

    if (
      path.startsWith('/api/public/moment')
    ) {
      setEdgeCacheHeaders(
        res,
        'public, max-age=30, stale-while-revalidate=300',
        'public, s-maxage=300, stale-while-revalidate=300',
      );
      return next();
    }

    if (
      path.startsWith('/api/public/nav')
    ) {
      setEdgeCacheHeaders(
        res,
        'public, max-age=60, stale-while-revalidate=900',
        'public, s-maxage=900, stale-while-revalidate=900',
      );
      return next();
    }

    if (
      path === '/api/public/viewer' ||
      path.startsWith('/api/public/article/viewer/') ||
      path.endsWith('/engagement') ||
      path.endsWith('/fragments') ||
      path.startsWith('/api/public/comment')
    ) {
      setEdgeCacheHeaders(
        res,
        'public, max-age=15, stale-while-revalidate=300',
        'public, s-maxage=300, stale-while-revalidate=300',
      );
      return next();
    }

    setEdgeCacheHeaders(
      res,
      'public, max-age=60, stale-while-revalidate=86400',
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
    next();
  }
}
