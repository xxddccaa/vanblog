import { HttpException } from '@nestjs/common';
import { COMMENT_ACTOR_COOKIE } from 'src/types/comment.dto';
import { PublicCommentController } from './comment.controller';

const ACTOR = 'Q'.repeat(43);

const createRequest = (headers: Record<string, string> = {}) =>
  ({
    headers: {
      host: 'blog.example.com',
      origin: 'https://blog.example.com',
      'content-type': 'application/json',
      'user-agent': 'UA',
      ...headers,
    },
    ip: '203.0.113.7',
    ips: [],
    socket: { remoteAddress: '203.0.113.7' },
    app: { get: () => true },
  }) as any;

const createResponse = () => {
  const headers = new Map<string, string>();
  return {
    headers,
    cookies: [] as any[],
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    cookie(...args: any[]) {
      this.cookies.push(args);
    },
  };
};

const createController = (overrides: Record<string, any> = {}) => {
  const commentProvider = {
    listPublic: jest.fn().mockResolvedValue({ items: [] }),
    countPublic: jest.fn().mockResolvedValue({ 'post:1': 2 }),
    assertCommentsEnabled: jest.fn().mockResolvedValue(undefined),
    likedIds: jest.fn().mockResolvedValue({ ids: [1] }),
    create: jest.fn().mockResolvedValue({ status: 'approved', comment: { id: 1 } }),
    toggleLike: jest.fn().mockResolvedValue({ liked: true, likes: 1 }),
    ...overrides.commentProvider,
  };
  const requestService = {
    assertJson: jest.fn(),
    assertSameOrigin: jest.fn(),
    consume: jest.fn().mockResolvedValue(undefined),
    getSuperAdmin: jest.fn().mockResolvedValue(null),
    requestIp: jest.fn().mockReturnValue('203.0.113.7'),
    userAgent: jest.fn().mockReturnValue('UA'),
    visitorKey: jest.fn().mockReturnValue('203.0.113.7'),
    ...overrides.requestService,
  };
  const privateSiteProvider = {
    isInternalRequest: jest.fn().mockReturnValue(false),
    ...overrides.privateSiteProvider,
  };
  const controller = new PublicCommentController(
    commentProvider as any,
    requestService as any,
    privateSiteProvider as any,
  );
  return { controller, commentProvider, requestService, privateSiteProvider };
};

describe('PublicCommentController', () => {
  it('lists and counts comments after charging the read budget', async () => {
    const { controller, commentProvider, requestService } = createController();
    const req = createRequest();
    await expect(controller.list('post:1', '2', 'hot', req)).resolves.toEqual({
      statusCode: 200,
      data: { items: [] },
    });
    expect(commentProvider.listPublic).toHaveBeenCalledWith({
      target: 'post:1',
      page: '2',
      sort: 'hot',
    });
    await expect(controller.count('post:1', req)).resolves.toEqual({
      statusCode: 200,
      data: { 'post:1': 2 },
    });
    expect(requestService.consume).toHaveBeenCalledTimes(2);
    expect(requestService.consume).toHaveBeenCalledWith('readPerVisitorMinute', '203.0.113.7');
  });

  it('does not charge the website server for its own reads', async () => {
    const { controller, requestService } = createController({
      privateSiteProvider: { isInternalRequest: jest.fn().mockReturnValue(true) },
    });
    await controller.list('post:1', undefined, undefined, createRequest());
    expect(requestService.consume).not.toHaveBeenCalled();
  });

  it('propagates read rate limiting', async () => {
    const limited = new HttpException({ code: 'COMMENT_RATE_LIMITED' }, 429);
    const { controller, commentProvider } = createController({
      requestService: { consume: jest.fn().mockRejectedValue(limited) },
    });
    await expect(controller.list('post:1', '1', 'latest', createRequest())).rejects.toBe(limited);
    expect(commentProvider.listPublic).not.toHaveBeenCalled();
  });

  it('reports the admin identity without caching', async () => {
    const { controller, requestService } = createController();
    const res = createResponse();
    await expect(controller.identity(createRequest(), res as any)).resolves.toEqual({
      statusCode: 200,
      data: { admin: false },
    });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('CDN-Cache-Control')).toBe('no-store');
    requestService.getSuperAdmin.mockResolvedValue({ nick: 'Owner' });
    await expect(controller.identity(createRequest(), createResponse() as any)).resolves.toEqual({
      statusCode: 200,
      data: { admin: true, nick: 'Owner' },
    });
  });

  it('refuses the identity endpoint when comments are disabled', async () => {
    const disabled = new HttpException({ code: 'COMMENT_DISABLED' }, 403);
    const { controller } = createController({
      commentProvider: { assertCommentsEnabled: jest.fn().mockRejectedValue(disabled) },
    });
    await expect(controller.identity(createRequest(), createResponse() as any)).rejects.toBe(
      disabled,
    );
  });

  it('reads liked ids from the cookie without issuing one', async () => {
    const { controller, commentProvider } = createController();
    const res = createResponse();
    await controller.liked(
      '1,2',
      createRequest({ cookie: `a=b; ${COMMENT_ACTOR_COOKIE}=${ACTOR}` }),
      res as any,
    );
    expect(commentProvider.likedIds).toHaveBeenCalledWith('1,2', ACTOR);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.cookies).toEqual([]);

    await controller.liked('1', createRequest(), createResponse() as any);
    expect(commentProvider.likedIds).toHaveBeenLastCalledWith('1', '');
    await controller.liked(
      '1',
      createRequest({ cookie: `${COMMENT_ACTOR_COOKIE}=forged` }),
      createResponse() as any,
    );
    expect(commentProvider.likedIds).toHaveBeenLastCalledWith('1', '');
  });

  it('creates comments only from same-origin JSON requests and passes the identity', async () => {
    const { controller, commentProvider, requestService } = createController();
    requestService.getSuperAdmin.mockResolvedValue({ nick: 'Owner' });
    const req = createRequest();
    await expect(controller.create({ target: 'post:1' }, req)).resolves.toEqual({
      statusCode: 200,
      data: { status: 'approved', comment: { id: 1 } },
    });
    expect(requestService.assertJson).toHaveBeenCalledWith(req);
    expect(requestService.assertSameOrigin).toHaveBeenCalledWith(req);
    expect(commentProvider.create).toHaveBeenCalledWith(
      { target: 'post:1' },
      { admin: { nick: 'Owner' }, ip: '203.0.113.7', ua: 'UA', visitorKey: '203.0.113.7' },
    );
  });

  it('rejects cross-site and non-JSON writes before touching the provider', async () => {
    const crossSite = new HttpException({ code: 'COMMENT_CROSS_SITE' }, 403);
    const notJson = new HttpException({ code: 'COMMENT_UNSUPPORTED_MEDIA' }, 415);
    const first = createController({
      requestService: {
        assertSameOrigin: jest.fn(() => {
          throw crossSite;
        }),
      },
    });
    await expect(first.controller.create({}, createRequest())).rejects.toBe(crossSite);
    await expect(first.controller.like('1', createRequest(), createResponse() as any)).rejects.toBe(
      crossSite,
    );
    expect(first.commentProvider.create).not.toHaveBeenCalled();
    expect(first.commentProvider.toggleLike).not.toHaveBeenCalled();

    const second = createController({
      requestService: {
        assertJson: jest.fn(() => {
          throw notJson;
        }),
      },
    });
    await expect(second.controller.create({}, createRequest())).rejects.toBe(notJson);
    await expect(
      second.controller.like('1', createRequest(), createResponse() as any),
    ).rejects.toBe(notJson);
  });

  it('issues the actor cookie on the first stored like only', async () => {
    const { controller, commentProvider } = createController();
    const res = createResponse();
    await expect(
      controller.like('5', createRequest({ origin: 'https://blog.example.com' }), res as any),
    ).resolves.toEqual({ statusCode: 200, data: { liked: true, likes: 1 } });
    const issued = commentProvider.toggleLike.mock.calls[0][1].actorToken;
    expect(issued).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(res.cookies).toEqual([
      [
        COMMENT_ACTOR_COOKIE,
        issued,
        {
          httpOnly: true,
          sameSite: 'lax',
          secure: true,
          path: '/',
          maxAge: 365 * 24 * 60 * 60 * 1000,
        },
      ],
    ]);

    const plain = createResponse();
    await controller.like(
      '5',
      createRequest({ origin: 'http://blog.example.com', host: 'blog.example.com' }),
      plain as any,
    );
    expect(plain.cookies[0][2].secure).toBe(false);

    const returning = createResponse();
    await controller.like(
      '5',
      createRequest({ cookie: `${COMMENT_ACTOR_COOKIE}=${ACTOR}` }),
      returning as any,
    );
    expect(commentProvider.toggleLike).toHaveBeenLastCalledWith('5', {
      actorToken: ACTOR,
      visitorKey: '203.0.113.7',
    });
    expect(returning.cookies).toEqual([]);
  });

  it('does not issue a cookie when the like is rejected', async () => {
    const notFound = new HttpException({ code: 'COMMENT_NOT_FOUND' }, 404);
    const { controller } = createController({
      commentProvider: { toggleLike: jest.fn().mockRejectedValue(notFound) },
    });
    const res = createResponse();
    await expect(controller.like('5', createRequest(), res as any)).rejects.toBe(notFound);
    expect(res.cookies).toEqual([]);
  });
});
