import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { isMaskableTextFile, maskTextFileContent, PublicMasker } from 'src/utils/publicMask';
import {
  getPublicMaskArtifactForPath,
  readPublicMaskArtifactVersions,
} from './public-mask-artifacts';

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

/** Text files above this size are not masked on the fly and are refused instead. */
export const PUBLIC_STATIC_MAX_MASKED_BYTES = 8 * 1024 * 1024;

/**
 * Checks a path relative to the static root. The path is decoded once, which
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

/** The parts of PublicMaskProvider the static guard needs. */
export interface PublicStaticMasking {
  getMasker(): Promise<PublicMasker>;
  maskCached(
    masker: PublicMasker,
    key: string,
    text: string,
    transform?: (text: string) => string,
  ): string;
}

export interface PublicStaticGuardOptions {
  /** Absolute static root on disk. Required for masking. */
  staticRoot?: string;
  /** Directory under the static root this mount serves, e.g. `rss` for `/rss`. */
  mountDir?: string;
  masking?: PublicStaticMasking;
}

const ARTIFACT_VERSIONS_TTL_MS = 2000;

const sendNotFound = (res: Response) => {
  res.status(404).type('text/plain').send('Not Found');
};

const sendUnavailable = (res: Response) => {
  res.setHeader('Retry-After', '60');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
  res.status(503).type('text/plain').send('Service Unavailable');
};

/**
 * Express middleware mounted before a static file handler (`/static`, `/rss`,
 * `/sitemap`). Express strips the mount path case-insensitively, so `/STATIC/...`
 * is covered.
 *
 * With masking active it also:
 * - refuses paths that contain masked terms (404);
 * - refuses generated files (feeds, sitemap, search index) that were built with
 *   different rules (503 until they are regenerated);
 * - masks text files such as SVG or custom-page HTML/JS/CSS on the fly.
 */
export const createPublicStaticGuard = (options: PublicStaticGuardOptions = {}) => {
  let artifactCache: { versions: Record<string, string>; expiresAt: number } | null = null;
  const getArtifactVersions = () => {
    if (!artifactCache || artifactCache.expiresAt < Date.now()) {
      artifactCache = {
        versions: readPublicMaskArtifactVersions(options.staticRoot || ''),
        expiresAt: Date.now() + ARTIFACT_VERSIONS_TTL_MS,
      };
    }
    return artifactCache.versions;
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const relativePath = options.mountDir ? `/${options.mountDir}${req.path}` : req.path;
    if (!isPublicStaticPathAllowed(relativePath)) {
      sendNotFound(res);
      return;
    }
    if (!options.masking || !options.staticRoot || !['GET', 'HEAD'].includes(req.method)) {
      next();
      return;
    }

    let masker: PublicMasker;
    try {
      masker = await options.masking.getMasker();
    } catch {
      sendUnavailable(res);
      return;
    }
    if (!masker.active) {
      next();
      return;
    }

    const decodedPath = decodeURIComponent(relativePath);
    if (masker.hasHit(decodedPath)) {
      sendNotFound(res);
      return;
    }

    const artifact = getPublicMaskArtifactForPath(decodedPath);
    if (artifact) {
      if (getArtifactVersions()[artifact] !== masker.version) {
        sendUnavailable(res);
        return;
      }
      next();
      return;
    }

    if (!isMaskableTextFile(decodedPath)) {
      next();
      return;
    }

    const filePath = path.join(options.staticRoot, decodedPath);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      next();
      return;
    }
    if (!stat.isFile()) {
      next();
      return;
    }
    if (stat.size > PUBLIC_STATIC_MAX_MASKED_BYTES) {
      // Too large to mask safely on each change; fail closed.
      sendNotFound(res);
      return;
    }

    const content = await fs.promises.readFile(filePath, 'utf8');
    const cacheKey = `static:${filePath}:${stat.mtimeMs}:${stat.size}`;
    const masked = options.masking.maskCached(masker, cacheKey, content, (text) =>
      maskTextFileContent(text, filePath, masker),
    );
    const etag = `"${createHash('sha1').update(masked).digest('hex')}"`;
    res.setHeader('ETag', etag);
    // Masked output changes with the rules, so it is revalidated rather than cached
    // as immutable even when the file name carries a content hash.
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader(
      'Cloudflare-CDN-Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
    res.type(path.extname(filePath));
    const ifNoneMatch = String(req.headers['if-none-match'] || '');
    if (
      ifNoneMatch
        .split(',')
        .map((item) => item.trim())
        .includes(etag)
    ) {
      res.status(304).end();
      return;
    }
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', String(Buffer.byteLength(masked)));
      res.status(200).end();
      return;
    }
    res.status(200).send(masked);
  };
};
