/**
 * Site-wide secret shared by the server and the website container. It signs
 * ISR revalidation calls, internal website requests and the website control
 * endpoint.
 *
 * `WALINE_JWT_TOKEN` is the name this secret had before the rename. It stays a
 * read-only fallback so an upgraded deployment keeps working with its old env.
 */
export const SHARED_SECRET_ENV = 'VANBLOG_SHARED_SECRET';
export const LEGACY_SHARED_SECRET_ENV = 'WALINE_JWT_TOKEN';

export const getSharedSecret = (env: NodeJS.ProcessEnv = process.env): string =>
  env[SHARED_SECRET_ENV] || env[LEGACY_SHARED_SECRET_ENV] || '';
