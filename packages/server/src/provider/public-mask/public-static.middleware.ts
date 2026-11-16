import type { NextFunction, Request, Response } from 'express';

/**
 * Top-level directories under the static root that anonymous visitors may read.
 * Everything else (legacy backups in `blog-json/`, `export/`, `tmp/`, ad-hoc
 * folders, dotfiles) is answered with 404.
 */
export const PUBLIC_STATIC_ALLOWED_DIRS = new Set([
  'img',
  'music',
  'font',
  'custompage',
  'rss',
  'sitemap',
  'markdown-themes',
]);

/** Single files directly under the static root that may be served. */
export const PUBLIC_STATIC_ALLOWED_FILES = new Set(['search-index.json']);

/**
 * Checks a path relative to the `/static` mount. The path is decoded once, which
 * matches what serve-static does; any remaining `%`, dot segment, dotfile, or NUL
 * byte is rejected so traversal tricks such as `img/../blog-json` cannot escape
 * the allowlist.
 */
export const isPublicStaticPathAllowed = (rawPath: string) => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(String(rawPath || ''));
  } catch {
    return false;
  }
  if (decoded.includes('\0') || decoded.includes('%')) {
    return false;
  }
  const segments = decoded.split(/[\\/]+/).filter(Boolean);
  if (!segments.length) {
    return false;
  }
  if (segments.some((segment) => segment.startsWith('.'))) {
    return false;
  }
  const first = segments[0].toLowerCase();
  if (segments.length === 1) {
    return PUBLIC_STATIC_ALLOWED_FILES.has(first);
  }
  return PUBLIC_STATIC_ALLOWED_DIRS.has(first);
};

/**
 * Express middleware mounted at `/static` before the static file handler.
 * Express strips the mount path case-insensitively, so `/STATIC/...` is covered.
 */
export const createPublicStaticGuard = () => (req: Request, res: Response, next: NextFunction) => {
  if (isPublicStaticPathAllowed(req.path)) {
    next();
    return;
  }
  res.status(404).type('text/plain').send('Not Found');
};
