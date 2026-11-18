import { HttpException } from '@nestjs/common';
import { COMMENT_RATE_LIMITS } from 'src/types/comment.dto';
import { CommentRequestService, commentError } from './comment-request.service';

const makeRequest = (headers: Record<string, string>, ip = '203.0.113.9') =>
  ({
    headers,
    ip,
    ips: [],
    socket: { remoteAddress: ip },
    app: { get: () => true },
  }) as any;

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return ((error as HttpException).getResponse() as any).code;
  }
  return undefined;
};

describe('CommentRequestService', () => {
  const counters = new Map<string, number>();
  const cacheProvider = {
    incrementWithTtl: jest.fn(async (key: string) => {
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    }),
  };
  const privateSiteProvider = { extractToken: jest.fn() };
  const tokenProvider = { checkSuperAdminSessionToken: jest.fn() };
  const userProvider = { getUser: jest.fn() };
  const service = new CommentRequestService(
    cacheProvider as any,
    privateSiteProvider as any,
    tokenProvider as any,
    userProvider as any,
  );

  beforeEach(() => {
    counters.clear();
    jest.clearAllMocks();
  });

  describe('assertSameOrigin', () => {
    it('accepts a matching Origin regardless of scheme', () => {
      expect(() =>
        service.assertSameOrigin(
          makeRequest({ host: 'blog.example.com', origin: 'https://blog.example.com' }),
        ),
      ).not.toThrow();
    });

    it('falls back to Referer when Origin is absent', () => {
      expect(() =>
        service.assertSameOrigin(
          makeRequest({ host: 'blog.example.com', referer: 'https://blog.example.com/post/1' }),
        ),
      ).not.toThrow();
    });

    it('accepts a browser-marked same-origin request without Origin or Referer', () => {
      expect(() =>
        service.assertSameOrigin(
          makeRequest({ host: 'blog.example.com', 'sec-fetch-site': 'same-origin' }),
        ),
      ).not.toThrow();
    });

    it('rejects foreign, missing and malformed origins', () => {
      for (const headers of [
        { host: 'blog.example.com', origin: 'https://evil.example.net' },
        { host: 'blog.example.com', origin: 'https://blog.example.com.evil.net' },
        { host: 'blog.example.com', referer: 'https://evil.example.net/x' },
        { host: 'blog.example.com', origin: 'null' },
        { host: 'blog.example.com', origin: 'javascript:alert(1)' },
        { host: 'blog.example.com' },
        {
          host: 'blog.example.com',
          origin: 'https://blog.example.com',
          'sec-fetch-site': 'cross-site',
        },
        {
          host: 'blog.example.com',
          origin: 'https://blog.example.com',
          'sec-fetch-site': 'same-site',
        },
        { origin: 'https://blog.example.com' },
      ]) {
        expect(codeOf(() => service.assertSameOrigin(makeRequest(headers)))).toBe(
          'COMMENT_CROSS_SITE',
        );
      }
    });
  });

  it('requires a JSON content type', () => {
    expect(() =>
      service.assertJson(makeRequest({ 'content-type': 'application/json; charset=utf-8' })),
    ).not.toThrow();
    for (const contentType of [
      'text/plain',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'application/jsonp',
      '',
    ]) {
      expect(codeOf(() => service.assertJson(makeRequest({ 'content-type': contentType })))).toBe(
        'COMMENT_UNSUPPORTED_MEDIA',
      );
    }
  });

  it('groups IPv6 visitors by /64', () => {
    const a = service.visitorKey(makeRequest({}, '2001:db8:1:2:aaaa::1'));
    const b = service.visitorKey(makeRequest({}, '2001:db8:1:2:bbbb::2'));
    expect(a).toBe(b);
    expect(service.visitorKey(makeRequest({}, '198.51.100.7'))).toBe('198.51.100.7');
  });

  it('throws a coded 429 once a rule is exhausted', async () => {
    const { max, windowSeconds } = COMMENT_RATE_LIMITS.createPerVisitorShort;
    for (let index = 0; index < max; index += 1) {
      await service.consume('createPerVisitorShort', 'visitor-a');
    }
    await expect(service.consume('createPerVisitorShort', 'visitor-a')).rejects.toMatchObject({
      response: { code: 'COMMENT_RATE_LIMITED', retryAfterSeconds: windowSeconds },
      status: 429,
    });
    await expect(service.consume('createPerVisitorShort', 'visitor-b')).resolves.toBeUndefined();
    const keys = cacheProvider.incrementWithTtl.mock.calls.map(([key]) => key);
    expect(keys.join(' ')).not.toContain('visitor-a');
  });

  describe('getSuperAdmin', () => {
    it('returns null without a token', async () => {
      privateSiteProvider.extractToken.mockReturnValue('');
      await expect(service.getSuperAdmin(makeRequest({}))).resolves.toBeNull();
      expect(tokenProvider.checkSuperAdminSessionToken).not.toHaveBeenCalled();
    });

    it('returns null for a token that is not a super admin session', async () => {
      privateSiteProvider.extractToken.mockReturnValue('collaborator-token');
      tokenProvider.checkSuperAdminSessionToken.mockResolvedValue(false);
      await expect(service.getSuperAdmin(makeRequest({}))).resolves.toBeNull();
    });

    it('fails closed when token validation throws', async () => {
      privateSiteProvider.extractToken.mockReturnValue('broken');
      tokenProvider.checkSuperAdminSessionToken.mockRejectedValue(new Error('db down'));
      await expect(service.getSuperAdmin(makeRequest({}))).resolves.toBeNull();
    });

    it('returns the admin nickname for a super admin session', async () => {
      privateSiteProvider.extractToken.mockReturnValue('admin-token');
      tokenProvider.checkSuperAdminSessionToken.mockResolvedValue(true);
      userProvider.getUser.mockResolvedValue({ name: 'admin', nickname: 'Owner' });
      await expect(service.getSuperAdmin(makeRequest({}))).resolves.toEqual({ nick: 'Owner' });
    });
  });

  it('builds coded error bodies', () => {
    const error = commentError(404, 'COMMENT_NOT_FOUND', 'missing');
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({
      statusCode: 404,
      message: 'missing',
      code: 'COMMENT_NOT_FOUND',
    });
  });
});
