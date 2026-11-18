import { HttpException, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { GUARDS_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { createHash } from 'crypto';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import { config } from 'src/config';
import { CommentImageProvider } from 'src/provider/comment/comment-image.provider';
import {
  COMMENT_IMAGE_MULTIPART_LIMITS,
  COMMENT_IMAGE_UPLOADER,
  CommentImageMultipartInterceptor,
  CommentImageUploadGuard,
  mapMultipartError,
} from 'src/provider/comment/comment-image-upload.guard';
import { CommentRequestService, commentError } from 'src/provider/comment/comment-request.service';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import {
  COMMENT_LIMITS,
  COMMENT_RATE_LIMITS,
  COMMENT_TARGET_RESOLVER,
  defaultCommentSetting,
} from 'src/types/comment.dto';
import { CommentImageController } from './comment-image.controller';

const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360f8cfc0f01f0005000201e2213c' +
    'c60000000049454e44ae426082',
  'hex',
);

const fakeWebp = (input: Buffer) => {
  const digest = createHash('sha256').update(input).digest();
  const chunk = Buffer.concat([Buffer.from([0x2f, 0, 0, 0, 0]), digest]);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.write('VP8L', 0, 'ascii');
  chunkHeader.writeUInt32LE(chunk.length, 4);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(4 + chunkHeader.length + chunk.length, 4);
  riff.write('WEBP', 8, 'ascii');
  return Buffer.concat([riff, chunkHeader, chunk]);
};

const httpContext = (req: any, res: any = {}) =>
  ({
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  }) as any;

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    return { status: exception.getStatus(), ...(exception.getResponse() as any) };
  }
  throw new Error('expected a rejection');
};

describe('comment image upload', () => {
  let counters: Map<string, number>;
  let setting: typeof defaultCommentSetting;
  let superAdmin: { nick: string } | null;
  const cacheProvider = {
    incrementWithTtl: jest.fn(async (key: string) => {
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    }),
  };
  const requestService = new CommentRequestService(
    cacheProvider as any,
    { extractToken: () => null } as any,
    {} as any,
    {} as any,
  );
  const settingProvider = { getCommentSetting: jest.fn(async () => setting) };
  let guard: CommentImageUploadGuard;

  const visitorRequest = (headers: Record<string, string> = {}, ip = '203.0.113.9') => ({
    headers: { host: 'blog.example.com', origin: 'https://blog.example.com', ...headers },
    ip,
    ips: [],
    socket: { remoteAddress: ip },
    app: { get: () => true },
  });

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    settingProvider.getCommentSetting.mockClear();
    cacheProvider.incrementWithTtl.mockClear();
    counters = new Map();
    setting = JSON.parse(JSON.stringify(defaultCommentSetting));
    superAdmin = null;
    jest.spyOn(requestService, 'getSuperAdmin').mockImplementation(async () => superAdmin);
    guard = new CommentImageUploadGuard(requestService, settingProvider as any);
  });

  describe('CommentImageUploadGuard', () => {
    it('admits a same-origin visitor and counts every image rule', async () => {
      const req: any = visitorRequest();
      await expect(guard.canActivate(httpContext(req))).resolves.toBe(true);
      expect(req[COMMENT_IMAGE_UPLOADER]).toEqual({ admin: false });
      const rules = [...counters.keys()].map((key) => key.split(':')[2]).sort();
      // The site-wide budget is charged later, by the controller.
      expect(rules).toEqual(['imagePerVisitorDay', 'imagePerVisitorHour']);
    });

    it.each([
      [{ origin: 'https://evil.example.net' }],
      [{ origin: '', referer: '', 'sec-fetch-site': 'cross-site' }],
      [{ origin: '', referer: '' }],
    ])('rejects a cross-site upload %p before anything else', async (headers) => {
      const result = await codeOf(guard.canActivate(httpContext(visitorRequest(headers))));
      expect(result.status).toBe(403);
      expect(result.code).toBe('COMMENT_CROSS_SITE');
      expect(counters.size).toBe(0);
      expect(settingProvider.getCommentSetting).not.toHaveBeenCalled();
    });

    it('rejects visitors while visitor uploads are disabled', async () => {
      setting.allowVisitorImage = false;
      const result = await codeOf(guard.canActivate(httpContext(visitorRequest())));
      expect(result.status).toBe(403);
      expect(result.code).toBe('COMMENT_IMAGE_DISABLED');
      expect(counters.size).toBe(0);
    });

    it('lets the super admin bypass the switch and the rate limits', async () => {
      setting.allowVisitorImage = false;
      superAdmin = { nick: 'Owner' };
      const req: any = visitorRequest();
      for (let i = 0; i < COMMENT_RATE_LIMITS.imagePerVisitorHour.max + 5; i += 1) {
        await expect(guard.canActivate(httpContext(req))).resolves.toBe(true);
      }
      expect(req[COMMENT_IMAGE_UPLOADER]).toEqual({ admin: true });
      expect(counters.size).toBe(0);
    });

    it('still requires same origin from the super admin', async () => {
      superAdmin = { nick: 'Owner' };
      const req = visitorRequest({ origin: 'https://evil.example.net' });
      expect((await codeOf(guard.canActivate(httpContext(req)))).code).toBe('COMMENT_CROSS_SITE');
    });

    it('limits uploads per visitor per hour', async () => {
      const max = COMMENT_RATE_LIMITS.imagePerVisitorHour.max;
      for (let i = 0; i < max; i += 1) {
        await guard.canActivate(httpContext(visitorRequest()));
      }
      const result = await codeOf(guard.canActivate(httpContext(visitorRequest())));
      expect(result.status).toBe(429);
      expect(result.code).toBe('COMMENT_RATE_LIMITED');
      expect(result.retryAfterSeconds).toBe(COMMENT_RATE_LIMITS.imagePerVisitorHour.windowSeconds);
      // Another visitor is unaffected.
      await expect(
        guard.canActivate(httpContext(visitorRequest({}, '198.51.100.1'))),
      ).resolves.toBe(true);
    });

    it('groups an IPv6 /64 into one visitor', async () => {
      const max = COMMENT_RATE_LIMITS.imagePerVisitorHour.max;
      for (let i = 0; i < max; i += 1) {
        await guard.canActivate(httpContext(visitorRequest({}, `2001:db8:1:2::${i + 1}`)));
      }
      const result = await codeOf(
        guard.canActivate(httpContext(visitorRequest({}, '2001:db8:1:2:ffff::1'))),
      );
      expect(result.status).toBe(429);
    });

    it('limits uploads per visitor per day', async () => {
      const hourKey = 'imagePerVisitorHour';
      const dayMax = COMMENT_RATE_LIMITS.imagePerVisitorDay.max;
      for (let i = 0; i < dayMax; i += 1) {
        // Reset the hourly window to simulate uploads spread over the day.
        for (const key of [...counters.keys()]) if (key.includes(hourKey)) counters.delete(key);
        await guard.canActivate(httpContext(visitorRequest()));
      }
      for (const key of [...counters.keys()]) if (key.includes(hourKey)) counters.delete(key);
      const result = await codeOf(guard.canActivate(httpContext(visitorRequest())));
      expect(result.status).toBe(429);
    });
  });

  describe('mapMultipartError', () => {
    it('maps the size limit to COMMENT_IMAGE_TOO_LARGE', () => {
      const error = mapMultipartError({ code: 'LIMIT_FILE_SIZE' });
      expect(error.getStatus()).toBe(413);
      expect((error.getResponse() as any).code).toBe('COMMENT_IMAGE_TOO_LARGE');
    });

    it.each(['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_FIELD_COUNT', 'LIMIT_PART_COUNT'])(
      'maps %s to COMMENT_IMAGE_INVALID',
      (code) => {
        const error = mapMultipartError({ code });
        expect(error.getStatus()).toBe(400);
        expect((error.getResponse() as any).code).toBe('COMMENT_IMAGE_INVALID');
      },
    );

    it('keeps coded errors', () => {
      const coded = commentError(429, 'COMMENT_RATE_LIMITED', 'busy');
      expect(mapMultipartError(coded)).toBe(coded);
    });
  });

  describe('CommentImageController', () => {
    it('runs the guard before the multipart parser', () => {
      const handler = CommentImageController.prototype.upload;
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([CommentImageUploadGuard]);
      expect(Reflect.getMetadata(INTERCEPTORS_METADATA, handler)).toEqual([
        CommentImageMultipartInterceptor,
      ]);
    });

    it('validates the target before storing the image', async () => {
      const resolver = {
        resolvePublicTarget: jest.fn(async () => {
          throw commentError(404, 'COMMENT_TARGET_UNAVAILABLE', 'gone');
        }),
      };
      const images = { store: jest.fn() };
      const controller = new CommentImageController(resolver as any, images as any);
      const result = await codeOf(
        controller.upload({ body: { target: ' post:9 ' } } as any, { buffer: PNG_1X1 }),
      );
      expect(result.code).toBe('COMMENT_TARGET_UNAVAILABLE');
      expect(resolver.resolvePublicTarget).toHaveBeenCalledWith('post:9');
      expect(images.store).not.toHaveBeenCalled();
    });

    it('fails closed when no target resolver is bound', async () => {
      const images = { store: jest.fn() };
      const controller = new CommentImageController(null, images as any);
      const result = await codeOf(
        controller.upload({ body: { target: 'post:1' } } as any, { buffer: PNG_1X1 }),
      );
      expect(result.status).toBe(404);
      expect(result.code).toBe('COMMENT_TARGET_UNAVAILABLE');
      expect(images.store).not.toHaveBeenCalled();
    });

    it('charges the site-wide budget only for valid images', async () => {
      const resolver = { resolvePublicTarget: jest.fn(async () => ({})) };
      const images = {
        inspect: jest.fn(() => {
          throw commentError(400, 'COMMENT_IMAGE_INVALID', 'bad');
        }),
        store: jest.fn(),
      };
      const controller = new CommentImageController(resolver as any, images as any, requestService);
      const req: any = { body: { target: 'post:1' }, [COMMENT_IMAGE_UPLOADER]: { admin: false } };
      const result = await codeOf(controller.upload(req, { buffer: Buffer.from('nope') }));
      expect(result.code).toBe('COMMENT_IMAGE_INVALID');
      expect([...counters.keys()].some((key) => key.includes('imageGlobalHour'))).toBe(false);
      expect(images.store).not.toHaveBeenCalled();
    });

    it('limits valid visitor uploads for the whole site per hour', async () => {
      const resolver = { resolvePublicTarget: jest.fn(async () => ({})) };
      const images = {
        inspect: jest.fn(),
        store: jest.fn(async () => ({ url: '/x', markdown: '' })),
      };
      const controller = new CommentImageController(resolver as any, images as any, requestService);
      const upload = () =>
        controller.upload(
          { body: { target: 'post:1' }, [COMMENT_IMAGE_UPLOADER]: { admin: false } } as any,
          { buffer: PNG_1X1 },
        );
      for (let i = 0; i < COMMENT_RATE_LIMITS.imageGlobalHour.max; i += 1) await upload();
      const result = await codeOf(upload());
      expect(result.status).toBe(429);
      // A super admin is never limited.
      await expect(
        controller.upload(
          { body: { target: 'post:1' }, [COMMENT_IMAGE_UPLOADER]: { admin: true } } as any,
          { buffer: PNG_1X1 },
        ),
      ).resolves.toMatchObject({ statusCode: 200 });
    });

    it('requires a file', async () => {
      const resolver = { resolvePublicTarget: jest.fn(async () => ({})) };
      const controller = new CommentImageController(resolver as any, { store: jest.fn() } as any);
      const result = await codeOf(controller.upload({ body: { target: 'post:1' } } as any));
      expect(result.status).toBe(400);
      expect(result.code).toBe('COMMENT_IMAGE_INVALID');
    });
  });

  describe('over HTTP', () => {
    const originalStaticPath = config.staticPath;
    let staticRoot: string;
    let app: NestExpressApplication;
    let server: http.Server;
    let baseUrl: string;
    let resolver: { resolvePublicTarget: jest.Mock };
    let encoder: jest.Mock;

    beforeAll(async () => {
      staticRoot = mkdtempSync(path.join(os.tmpdir(), 'vanblog-comment-upload-spec-'));
      config.staticPath = staticRoot;
      resolver = { resolvePublicTarget: jest.fn() };
      encoder = jest.fn(async (input: Buffer) => fakeWebp(input));
      const moduleRef = await Test.createTestingModule({
        controllers: [CommentImageController],
        providers: [
          { provide: COMMENT_TARGET_RESOLVER, useValue: resolver },
          { provide: CommentImageProvider, useValue: new CommentImageProvider(encoder) },
          { provide: CommentRequestService, useValue: requestService },
          { provide: SettingProvider, useValue: settingProvider },
        ],
      }).compile();
      app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
      await app.listen(0, '127.0.0.1');
      server = app.getHttpServer();
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      await app.close();
      config.staticPath = originalStaticPath;
      rmSync(staticRoot, { recursive: true, force: true });
    });

    beforeEach(() => {
      resolver.resolvePublicTarget.mockReset().mockResolvedValue({ key: 'post:1' });
      encoder.mockClear();
    });

    const upload = async (form: FormData, headers: Record<string, string> = {}) => {
      const host = new URL(baseUrl).host;
      const response = await fetch(`${baseUrl}/api/public/comment/image`, {
        method: 'POST',
        body: form,
        headers: { origin: `http://${host}`, ...headers },
      });
      return { status: response.status, body: (await response.json()) as any };
    };

    const imageForm = (bytes: Buffer, target = 'post:1', name = 'a.png') => {
      const form = new FormData();
      form.append('target', target);
      form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), name);
      return form;
    };

    it('stores a valid upload and returns the URL and Markdown', async () => {
      const { status, body } = await upload(imageForm(PNG_1X1));
      // Nest answers POST with 201, like every other POST route in this server.
      expect(status).toBe(201);
      const name = `${createHash('sha256').update(fakeWebp(PNG_1X1)).digest('hex')}.webp`;
      expect(body).toEqual({
        statusCode: 200,
        data: {
          url: `/static/img/comment/${name}`,
          markdown: `![](/static/img/comment/${name})`,
        },
      });
      expect(resolver.resolvePublicTarget).toHaveBeenCalledWith('post:1');
      expect(readdirSync(path.join(staticRoot, 'img', 'comment'))).toContain(name);
    });

    it('rejects a cross-site request without parsing the body', async () => {
      const { status, body } = await upload(imageForm(PNG_1X1), {
        origin: 'https://evil.example.net',
      });
      expect(status).toBe(403);
      expect(body.code).toBe('COMMENT_CROSS_SITE');
      expect(resolver.resolvePublicTarget).not.toHaveBeenCalled();
    });

    it('rejects an oversized file with COMMENT_IMAGE_TOO_LARGE', async () => {
      const big = Buffer.concat([PNG_1X1, Buffer.alloc(COMMENT_LIMITS.imageMaxBytes)]);
      const { status, body } = await upload(imageForm(big));
      expect(status).toBe(413);
      expect(body.code).toBe('COMMENT_IMAGE_TOO_LARGE');
      expect(encoder).not.toHaveBeenCalled();
    });

    it('rejects an SVG even when it claims to be a PNG', async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');
      const { status, body } = await upload(imageForm(svg, 'post:1', 'cat.png'));
      expect(status).toBe(400);
      expect(body.code).toBe('COMMENT_IMAGE_INVALID');
      expect(encoder).not.toHaveBeenCalled();
    });

    it('rejects a second file', async () => {
      const form = imageForm(PNG_1X1);
      form.append('file', new Blob([new Uint8Array(PNG_1X1)]), 'b.png');
      const { status, body } = await upload(form);
      expect(status).toBe(400);
      expect(body.code).toBe('COMMENT_IMAGE_INVALID');
    });

    it('rejects extra fields beyond the multipart limits', async () => {
      const form = imageForm(PNG_1X1);
      for (let i = 0; i < COMMENT_IMAGE_MULTIPART_LIMITS.fields + 1; i += 1) {
        form.append(`extra${i}`, 'x');
      }
      const { status } = await upload(form);
      expect(status).toBe(400);
    });

    it('rejects an unavailable target', async () => {
      resolver.resolvePublicTarget.mockRejectedValue(
        commentError(404, 'COMMENT_TARGET_UNAVAILABLE', 'gone'),
      );
      const { status, body } = await upload(imageForm(PNG_1X1, 'post:404'));
      expect(status).toBe(404);
      expect(body.code).toBe('COMMENT_TARGET_UNAVAILABLE');
      expect(encoder).not.toHaveBeenCalled();
    });
  });
});
