import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { PrivateSiteProvider } from './private-site.provider';

/**
 * Paths that stay reachable for anonymous visitors on a private site. Everything
 * else served by the API server needs a valid admin session.
 */
const OPEN_EXACT_PATHS = new Set([
  '/',
  '/favicon.ico',
  '/api/public/site-info',
  '/api/public/private-site/access',
  '/api/public/verify-admin-token',
]);

const OPEN_PREFIXES = [
  // Admin APIs enforce their own authentication.
  '/api/admin/',
  // Media referenced by pages; file names are content hashes.
  '/static/img/',
  '/static/font/',
  '/static/music/',
  '/static/markdown-themes/',
];

// POST /api/public/article/:id/admin validates a super admin token itself.
const OPEN_PATTERNS = [/^\/api\/public\/article\/[^/]+\/admin$/];

/**
 * Normalizes a request path for the allowlist check. Returns null when the path
 * is ambiguous (dot segments, encoded separators, NUL), which is treated as
 * "not open" so encoding tricks cannot reach a gated route through an open one.
 */
export const normalizePrivateSitePath = (rawPath: string): string | null => {
  const pathname = String(rawPath || '/').split('?')[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (/%|\\|\0/.test(decoded) || decoded.includes('/./') || decoded.includes('/../')) {
    return null;
  }
  const collapsed = decoded.replace(/\/{2,}/g, '/');
  const normalized = path.posix.normalize(collapsed);
  if (normalized !== collapsed && `${normalized}/` !== collapsed) {
    return null;
  }
  return normalized.toLowerCase();
};

export const isOpenOnPrivateSite = (rawPath: string): boolean => {
  const normalized = normalizePrivateSitePath(rawPath);
  if (normalized === null) {
    return false;
  }
  return (
    OPEN_EXACT_PATHS.has(normalized) ||
    OPEN_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    OPEN_PATTERNS.some((pattern) => pattern.test(normalized))
  );
};

/** Forces private responses so no shared cache (CDN) keeps a copy. */
export const forcePrivateCacheHeaders = (res: Response) => {
  const writeHead = res.writeHead;
  (res as any).writeHead = function patchedWriteHead(...args: any[]) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
    res.removeHeader('Surrogate-Control');
    res.removeHeader('Cache-Tag');
    return writeHead.apply(this, args);
  };
};

export const createPrivateSiteMiddleware =
  (provider: PrivateSiteProvider) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (isOpenOnPrivateSite(req.originalUrl || req.url)) {
        return next();
      }
      const privateSite = await provider.isPrivateSite();
      if (!privateSite) {
        return next();
      }
      if (provider.isInternalRequest(req)) {
        return next();
      }
      forcePrivateCacheHeaders(res);
      if (await provider.isAuthorizedToken(provider.extractToken(req))) {
        return next();
      }
      res.status(401).json({
        statusCode: 401,
        message: '本站已开启全站隐私，请先登录',
      });
    } catch (error) {
      next(error);
    }
  };
