import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { CacheProvider } from 'src/provider/cache/cache.provider';
import { getRateLimitBucket, getRequestIp } from 'src/provider/log/utils';
import { PrivateSiteProvider } from 'src/provider/private-site/private-site.provider';
import { TokenProvider } from 'src/provider/token/token.provider';
import { UserProvider } from 'src/provider/user/user.provider';
import {
  COMMENT_RATE_LIMITS,
  CommentErrorBody,
  CommentErrorCode,
  CommentRateLimitRule,
} from 'src/types/comment.dto';

export type CommentRateLimitName = keyof typeof COMMENT_RATE_LIMITS;

/** Builds the coded error body every comment endpoint uses. */
export function commentError(
  status: number,
  code: CommentErrorCode,
  message: string,
  extra: Partial<CommentErrorBody> = {},
): HttpException {
  const body: CommentErrorBody = { statusCode: status, message, code, ...extra };
  return new HttpException(body, status);
}

function headerValue(req: Request, name: string): string {
  const value = req.headers?.[name];
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function originHost(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Request-level building blocks shared by every comment controller: CSRF
 * protection, visitor identification, rate limiting and super admin detection.
 */
@Injectable()
export class CommentRequestService {
  constructor(
    private readonly cacheProvider: CacheProvider,
    private readonly privateSiteProvider: PrivateSiteProvider,
    private readonly tokenProvider: TokenProvider,
    private readonly userProvider: UserProvider,
  ) {}

  /**
   * Rejects cross-site writes. The admin identity travels in a cookie, so every
   * state-changing comment request must prove it comes from this site.
   *
   * Hosts are compared without the scheme because TLS may terminate at a CDN
   * or at Caddy, which makes the scheme seen here unreliable. A request with
   * neither Origin nor Referer is accepted only when the browser itself marks
   * it as same-origin through Sec-Fetch-Site.
   */
  assertSameOrigin(req: Request): void {
    const fetchSite = headerValue(req, 'sec-fetch-site').toLowerCase();
    if (fetchSite === 'cross-site' || fetchSite === 'same-site') {
      throw commentError(403, 'COMMENT_CROSS_SITE', 'Cross-site comment requests are not allowed');
    }
    const host = headerValue(req, 'host').toLowerCase();
    if (!host) {
      throw commentError(403, 'COMMENT_CROSS_SITE', 'A request host is required');
    }
    const origin = headerValue(req, 'origin');
    const referer = headerValue(req, 'referer');
    const claimed = origin && origin !== 'null' ? origin : referer;
    if (!claimed) {
      if (fetchSite === 'same-origin') return;
      throw commentError(403, 'COMMENT_CROSS_SITE', 'The request origin could not be verified');
    }
    if (originHost(claimed) !== host) {
      throw commentError(403, 'COMMENT_CROSS_SITE', 'Cross-site comment requests are not allowed');
    }
  }

  /** JSON-only writes cannot be sent by a plain HTML form. */
  assertJson(req: Request): void {
    const contentType = headerValue(req, 'content-type').toLowerCase();
    if (!/^application\/json(?:\s*;|$)/u.test(contentType)) {
      throw commentError(
        415,
        'COMMENT_UNSUPPORTED_MEDIA',
        'Comment requests must use application/json',
      );
    }
  }

  /** Normalized client IP as forwarded by the trusted proxy, or ''. */
  requestIp(req: Request): string {
    return getRequestIp(req) || '';
  }

  userAgent(req: Request): string {
    return headerValue(req, 'user-agent').slice(0, 512);
  }

  /** Rate limit identity: the IPv4 address or the IPv6 /64 prefix. */
  visitorKey(req: Request): string {
    return getRateLimitBucket(this.requestIp(req));
  }

  /**
   * Counts one hit against a fixed-window rule and throws a coded 429 when the
   * rule is exceeded. `identity` is hashed, so it may contain raw IPs.
   */
  async consume(name: CommentRateLimitName, identity: string): Promise<void> {
    const rule: CommentRateLimitRule = COMMENT_RATE_LIMITS[name];
    const digest = createHash('sha256').update(identity).digest('hex').slice(0, 32);
    const count = await this.cacheProvider.incrementWithTtl(
      `comment:rate:${name}:${digest}`,
      rule.windowSeconds,
    );
    if (count > rule.max) {
      throw commentError(
        HttpStatus.TOO_MANY_REQUESTS,
        'COMMENT_RATE_LIMITED',
        'Too many comment requests, please try again later',
        { retryAfterSeconds: rule.windowSeconds },
      );
    }
  }

  /**
   * Returns the super admin's display name when the request carries a valid
   * super admin session (token header or the admin access cookie), else null.
   */
  async getSuperAdmin(req: Request): Promise<{ nick: string } | null> {
    const token = this.privateSiteProvider.extractToken(req);
    if (!token) return null;
    let valid = false;
    try {
      valid = await this.tokenProvider.checkSuperAdminSessionToken(token);
    } catch {
      valid = false;
    }
    if (!valid) return null;
    const user: any = await this.userProvider.getUser();
    const nick = String(user?.nickname || user?.name || '').trim();
    return { nick };
  }
}
