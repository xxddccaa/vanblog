import { createHmac, randomBytes } from 'crypto';
import type { CookieOptions, Request } from 'express';
import { COMMENT_ACTOR_COOKIE } from 'src/types/comment.dto';

/** 32 random bytes, base64url encoded without padding. */
const ACTOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const ACTOR_HASH_LABEL = 'vanblog:comment-actor:v1';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

let fallbackSecret: string | null = null;

/**
 * The like identity is keyed from the JWT secret so the stored hashes cannot be
 * linked back to cookie values. Without a secret (tests, broken startup) a
 * per-process key is used, which only means likes reset on restart.
 */
const resolveActorSecret = (): string => {
  const secret = (global as any).jwtSecret;
  if (typeof secret === 'string' && secret) return secret;
  if (!fallbackSecret) fallbackSecret = randomBytes(32).toString('hex');
  return fallbackSecret;
};

export const createCommentActorToken = () => randomBytes(32).toString('base64url');

export const isValidCommentActorToken = (value: unknown): value is string =>
  typeof value === 'string' && ACTOR_TOKEN_PATTERN.test(value);

/** Reads the actor cookie from the raw Cookie header; '' when absent or malformed. */
export function readCommentActorToken(req: Pick<Request, 'headers'>): string {
  const raw = req?.headers?.cookie;
  const header = Array.isArray(raw) ? raw.join(';') : String(raw || '');
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0 || part.slice(0, separator).trim() !== COMMENT_ACTOR_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    if (isValidCommentActorToken(value)) return value;
  }
  return '';
}

/** HMAC-SHA256 of the cookie value under a key derived from the JWT secret. */
export function hashCommentActor(token: string): string {
  const key = createHmac('sha256', resolveActorSecret()).update(ACTOR_HASH_LABEL).digest();
  return createHmac('sha256', key).update(token).digest('hex');
}

const headerValue = (req: Request, name: string) => {
  const value = req?.headers?.[name];
  return String(Array.isArray(value) ? value[0] : value || '');
};

/**
 * True when the page talking to us is served over HTTPS. TLS often terminates at
 * a CDN or at Caddy, so the browser's Origin/Referer is consulted as well.
 */
export function isSecureCommentRequest(req: Request): boolean {
  if (req?.secure === true || req?.protocol === 'https') return true;
  const claimed = headerValue(req, 'origin') || headerValue(req, 'referer');
  return /^https:\/\//iu.test(claimed);
}

export function commentActorCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ONE_YEAR_MS,
  };
}
