import path from 'path';
import { PublicMasker } from './types';
import { maskPublicPayload } from './walk';

/** Static file extensions that are served as text and therefore masked. */
export const PUBLIC_MASK_TEXT_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.json',
  '.map',
  '.txt',
  '.md',
  '.xml',
  '.svg',
  '.csv',
  '.yaml',
  '.yml',
  '.lrc',
  '.vtt',
  '.srt',
]);

export const isMaskableTextFile = (filePath: string) =>
  PUBLIC_MASK_TEXT_EXTENSIONS.has(path.extname(String(filePath || '')).toLowerCase());

/**
 * Masks the content of a text file. JSON is parsed and walked so masking cannot
 * break its syntax; other formats are masked as plain text.
 */
export const maskTextFileContent = (content: string, filePath: string, masker: PublicMasker) => {
  if (!masker.active) {
    return content;
  }
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.json' || extension === '.map') {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(maskPublicPayload(parsed, masker, { dropKeysOnHit: [] }));
    } catch {
      // Not valid JSON: fall back to text masking.
    }
  }
  return masker.mask(content);
};
