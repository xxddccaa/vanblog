import { SetMetadata } from '@nestjs/common';

export const SKIP_PUBLIC_MASK_METADATA = 'vanblog:skip-public-mask';
export const PUBLIC_MASK_BASE64_FIELDS_METADATA = 'vanblog:public-mask-base64-fields';

/**
 * Opt a public handler out of output masking. Only use this for endpoints that
 * echo caller-supplied input and never read stored content, because callers
 * rely on them returning the exact input.
 */
export const SkipPublicMask = () => SetMetadata(SKIP_PUBLIC_MASK_METADATA, true);

/**
 * Declare response fields that carry base64-encoded text. The masking walker
 * decodes them, masks the text, and re-encodes the result.
 * Paths are dot separated and relative to the handler return value, e.g. `data.html`.
 */
export const PublicMaskBase64Fields = (paths: string[]) =>
  SetMetadata(PUBLIC_MASK_BASE64_FIELDS_METADATA, paths);
