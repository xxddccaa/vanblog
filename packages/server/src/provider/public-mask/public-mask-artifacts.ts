import fs from 'fs';
import path from 'path';

/** Generated public files that must be rebuilt whenever masking rules change. */
export type PublicMaskArtifact = 'searchIndex' | 'rss' | 'sitemap';

/** Sidecar recording which mask version each artifact was generated with. It is a
 * dotfile, so the static guard never serves it. */
export const PUBLIC_MASK_ARTIFACTS_FILE = '.public-mask-artifacts.json';

/**
 * Writes a file through a hidden temp file and a rename, so readers never see a
 * half-written file. The temp name starts with a dot so it is never served.
 */
export const writeFileAtomic = (filePath: string, content: string | Buffer) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, content);
  fs.renameSync(tempPath, filePath);
};

export const readPublicMaskArtifactVersions = (staticPath: string): Record<string, string> => {
  try {
    const raw = fs.readFileSync(path.join(staticPath, PUBLIC_MASK_ARTIFACTS_FILE), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const recordPublicMaskArtifact = (
  staticPath: string,
  artifact: PublicMaskArtifact,
  version: string,
) => {
  const versions = readPublicMaskArtifactVersions(staticPath);
  versions[artifact] = version;
  writeFileAtomic(path.join(staticPath, PUBLIC_MASK_ARTIFACTS_FILE), JSON.stringify(versions));
};

/** Maps a path relative to the static root to the artifact it belongs to. */
export const getPublicMaskArtifactForPath = (relativePath: string): PublicMaskArtifact | null => {
  const normalized = String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();
  if (normalized === 'search-index.json') {
    return 'searchIndex';
  }
  if (normalized.startsWith('rss/')) {
    return 'rss';
  }
  if (normalized.startsWith('sitemap/')) {
    return 'sitemap';
  }
  return null;
};
