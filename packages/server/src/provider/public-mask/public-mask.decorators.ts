import { SetMetadata } from '@nestjs/common';

export const SKIP_PUBLIC_MASK_METADATA = 'vanblog:skip-public-mask';
export const PUBLIC_MASK_BASE64_FIELDS_METADATA = 'vanblog:public-mask-base64-fields';
export const PUBLIC_MASK_INPUT_POLICY_METADATA = 'vanblog:public-mask-input-policy';

export type PublicMaskInputPolicy = 'not-found' | 'empty-search';

/**
 * Opt a public handler out of output masking. Only use this for endpoints that
 * echo caller-supplied input and never read stored content (e.g. diagram render),
 * because the admin editor relies on them returning the exact input.
 */
export const SkipPublicMask = () => SetMetadata(SKIP_PUBLIC_MASK_METADATA, true);

/**
 * Declare response fields that carry base64-encoded text. The masking walker
 * decodes them, masks the text, and re-encodes the result.
 * Paths are dot separated and relative to the handler return value, e.g. `data.html`.
 */
export const PublicMaskBase64Fields = (paths: string[]) =>
  SetMetadata(PUBLIC_MASK_BASE64_FIELDS_METADATA, paths);

/**
 * Decide what a public handler returns when a route param or query value contains
 * a masked term. Both answers look the same as "nothing matched", so the mask list
 * cannot be probed from outside.
 */
export const PublicMaskInput = (policy: PublicMaskInputPolicy) =>
  SetMetadata(PUBLIC_MASK_INPUT_POLICY_METADATA, policy);
