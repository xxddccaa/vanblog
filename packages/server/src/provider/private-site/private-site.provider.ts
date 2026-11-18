import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { CloudflareCacheProvider } from 'src/provider/cloudflare-cache/cloudflare-cache.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { TokenProvider } from 'src/provider/token/token.provider';
import { getSharedSecret } from 'src/utils/sharedSecret';

/** Cookie the admin sets on login so the browser carries the session to site pages. */
export const PRIVATE_SITE_ACCESS_COOKIE = 'vanblog_token';
/** Header the website server sends on its own server-side requests. */
export const INTERNAL_REQUEST_HEADER = 'x-vanblog-internal-token';

const FLAG_TTL_MS = 5_000;
const ALLOWED_TOKEN_TTL_MS = 30_000;
const DENIED_TOKEN_TTL_MS = 5_000;
const MAX_TOKEN_CACHE_ENTRIES = 1_000;

/** Shared secret between the server and the website container. */
export const resolveInternalRequestSecret = () =>
  process.env.VANBLOG_ISR_TOKEN || getSharedSecret();

const readHeader = (req: any, name: string): string => {
  const value = req?.headers?.[name];
  return String(Array.isArray(value) ? value[0] : value || '').trim();
};

export const readCookie = (req: any, name: string): string => {
  const header = readHeader(req, 'cookie');
  if (!header) {
    return '';
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    if (part.slice(0, separator).trim() !== name) {
      continue;
    }
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return '';
};

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export interface PrivateSiteAccess {
  privateSite: boolean;
  allowed: boolean;
}

/**
 * Enforces the "private site" switch on the server. When it is on, public
 * content is only served to logged-in admin users (token header or the access
 * cookie) and to the website's own server-side requests.
 */
@Injectable()
export class PrivateSiteProvider {
  private readonly logger = new Logger(PrivateSiteProvider.name);
  private flagCache: { value: boolean; expiresAt: number } | null = null;
  private readonly tokenCache = new Map<string, { allowed: boolean; expiresAt: number }>();
  private warnedMissingSecret = false;

  constructor(
    private readonly metaProvider: MetaProvider,
    private readonly tokenProvider: TokenProvider,
    @Optional() private readonly cloudflareCacheProvider?: CloudflareCacheProvider,
  ) {}

  async isPrivateSite(): Promise<boolean> {
    const now = Date.now();
    if (this.flagCache && this.flagCache.expiresAt > now) {
      return this.flagCache.value;
    }
    let value = this.flagCache?.value ?? false;
    try {
      const siteInfo: any = await this.metaProvider.getSiteInfo();
      value = String(siteInfo?.privateSite) === 'true';
    } catch (error) {
      // Keep the last known value; never flip a private site to public on errors.
      this.logger.warn(`Failed to read privateSite flag: ${error?.message || error}`);
    }
    this.flagCache = { value, expiresAt: now + FLAG_TTL_MS };
    return value;
  }

  invalidate() {
    this.flagCache = null;
    this.tokenCache.clear();
  }

  isInternalRequest(req: any): boolean {
    const secret = resolveInternalRequestSecret();
    if (!secret) {
      if (!this.warnedMissingSecret) {
        this.warnedMissingSecret = true;
        this.logger.warn(
          'No internal request secret (VANBLOG_ISR_TOKEN / VANBLOG_SHARED_SECRET); the website cannot render a private site.',
        );
      }
      return false;
    }
    const provided = readHeader(req, INTERNAL_REQUEST_HEADER);
    return Boolean(provided) && safeEqual(provided, secret);
  }

  extractToken(req: any): string {
    return readHeader(req, 'token') || readCookie(req, PRIVATE_SITE_ACCESS_COOKIE);
  }

  async isAuthorizedToken(token: string): Promise<boolean> {
    if (!token) {
      return false;
    }
    const key = createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.allowed;
    }
    let allowed = false;
    try {
      allowed = await this.tokenProvider.checkToken(token);
    } catch {
      allowed = false;
    }
    if (this.tokenCache.size >= MAX_TOKEN_CACHE_ENTRIES) {
      this.tokenCache.clear();
    }
    this.tokenCache.set(key, {
      allowed,
      expiresAt: now + (allowed ? ALLOWED_TOKEN_TTL_MS : DENIED_TOKEN_TTL_MS),
    });
    return allowed;
  }

  async getAccess(req: any): Promise<PrivateSiteAccess> {
    const privateSite = await this.isPrivateSite();
    if (!privateSite) {
      return { privateSite, allowed: true };
    }
    if (this.isInternalRequest(req)) {
      return { privateSite, allowed: true };
    }
    return { privateSite, allowed: await this.isAuthorizedToken(this.extractToken(req)) };
  }

  /** Called after the site settings are saved. */
  async handleSiteInfoUpdated(previousPrivateSite: unknown, nextPrivateSite: unknown) {
    this.invalidate();
    const wasPrivate = String(previousPrivateSite) === 'true';
    const isPrivate = String(nextPrivateSite) === 'true';
    if (!wasPrivate && isPrivate) {
      // Pages and feeds cached by the CDN while the site was public must go.
      await this.cloudflareCacheProvider?.purgeEverything('enable private site');
    }
  }
}
