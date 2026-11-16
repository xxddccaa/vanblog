import { PublicMasker } from './types';

export interface MaskPayloadOptions {
  /**
   * Dot-separated paths (array indices omitted) whose string values are base64
   * encoded text. They are decoded, masked, and re-encoded instead of masked raw.
   */
  base64Paths?: string[];
  /**
   * Keys whose value is removed when it contains a hit instead of being masked,
   * e.g. `pathname`, so links fall back to a neutral identifier.
   */
  dropKeysOnHit?: string[];
}

export const DEFAULT_DROP_KEYS_ON_HIT = ['pathname'];

const mergeCollidingValues = (existing: unknown, incoming: unknown) => {
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    return [...existing, ...incoming];
  }
  if (typeof existing === 'number' && typeof incoming === 'number') {
    return existing + incoming;
  }
  if (
    existing &&
    incoming &&
    typeof existing === 'object' &&
    typeof incoming === 'object' &&
    !Array.isArray(existing) &&
    !Array.isArray(incoming)
  ) {
    return { ...(incoming as object), ...(existing as object) };
  }
  return existing;
};

const maskBase64Text = (value: string, masker: PublicMasker) => {
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  const masked = masker.mask(decoded);
  return masked === decoded ? value : Buffer.from(masked, 'utf8').toString('base64');
};

/**
 * Returns a masked copy of a JSON-like payload. Every string value and every object
 * key is masked; keys that collide after masking are merged so name-keyed maps
 * (categories, tags) stay well-formed. The input is never mutated.
 */
export const maskPublicPayload = <T>(
  payload: T,
  masker: PublicMasker,
  options: MaskPayloadOptions = {},
): T => {
  if (!masker.active) {
    return payload;
  }
  const base64Paths = new Set(options.base64Paths || []);
  const dropKeys = new Set(options.dropKeysOnHit ?? DEFAULT_DROP_KEYS_ON_HIT);

  const visit = (value: unknown, path: string): unknown => {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'string') {
      return base64Paths.has(path) ? maskBase64Text(value, masker) : masker.mask(value);
    }
    if (typeof value !== 'object') {
      return value;
    }
    if (typeof (value as any).toJSON === 'function') {
      return visit((value as any).toJSON(), path);
    }
    if (Array.isArray(value)) {
      return value.map((item) => visit(item, path));
    }
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) {
        continue;
      }
      if (dropKeys.has(key) && typeof child === 'string' && masker.hasHit(child)) {
        continue;
      }
      const childPath = path ? `${path}.${key}` : key;
      const maskedKey = masker.mask(key);
      const maskedChild = visit(child, childPath);
      output[maskedKey] = Object.prototype.hasOwnProperty.call(output, maskedKey)
        ? mergeCollidingValues(output[maskedKey], maskedChild)
        : maskedChild;
    }
    return output;
  };

  return visit(payload, '') as T;
};
