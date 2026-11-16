import { Controller, Get, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { compilePublicMask, defaultPublicMaskSetting } from 'src/utils/publicMask';
import { PublicMaskBase64Fields, SkipPublicMask } from './public-mask.decorators';
import {
  isPublicOutputController,
  neutralizeMaskedInput,
  normalizeControllerPath,
  PUBLIC_MASK_UNMATCHABLE_INPUT,
  PublicOutputInterceptor,
  stripPublicOutputKeys,
} from './public-output.interceptor';

@Controller('/api/public/')
class FakePublicController {
  @Get('item')
  item() {
    return null;
  }

  @Get('page')
  @PublicMaskBase64Fields(['data.html'])
  page() {
    return null;
  }
}

@Controller('/API/Public/upper')
class FakeUpperCasePublicController {
  @Get('item')
  item() {
    return null;
  }
}

@Controller('/api/admin/article')
class FakeAdminController {
  @Get('item')
  item() {
    return null;
  }
}

@Controller('/api/publicity')
class FakeLookalikeController {
  @Get('item')
  item() {
    return null;
  }
}

@SkipPublicMask()
@Controller('/api/public/echo')
class FakeSkippedController {
  @Get('item')
  item() {
    return null;
  }
}

const activeMasker = compilePublicMask({
  ...defaultPublicMaskSetting,
  enabled: true,
  replacements: { custom: 'X-CUSTOM-X', secret: 'X-SECRET-X', email: 'X-EMAIL-X', ip: 'X-IP-X' },
  rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
  updatedAt: '2030-01-01T00:00:00.000Z',
});

const createHttp = () => {
  const headers = new Map<string, string>();
  return {
    req: { params: {} as Record<string, any>, query: {} as Record<string, any> },
    res: {
      headers,
      getHeader: (key: string) => headers.get(key),
      setHeader: (key: string, value: string) => headers.set(key, value),
    },
  };
};

const createContext = (controllerClass: any, handlerName = 'item', http = createHttp()) =>
  ({
    getType: () => 'http',
    getClass: () => controllerClass,
    getHandler: () => controllerClass.prototype[handlerName],
    switchToHttp: () => ({ getRequest: () => http.req, getResponse: () => http.res }),
  }) as any;

const run = async (
  controllerClass: any,
  body: unknown,
  options: { masker?: any; handlerName?: string; http?: ReturnType<typeof createHttp> } = {},
) => {
  const provider = options.masker
    ? ({ getMasker: jest.fn().mockResolvedValue(options.masker) } as any)
    : undefined;
  const interceptor = new PublicOutputInterceptor(new Reflector(), provider);
  const observable = await interceptor.intercept(
    createContext(controllerClass, options.handlerName, options.http),
    { handle: () => (body instanceof Error ? throwError(() => body) : of(body)) },
  );
  return lastValueFrom(observable);
};

describe('PublicOutputInterceptor', () => {
  it('normalizes controller paths', () => {
    expect(normalizeControllerPath('/API//Public/')).toBe('api/public');
  });

  it('selects public controllers by metadata regardless of case', () => {
    expect(isPublicOutputController(FakePublicController)).toBe(true);
    expect(isPublicOutputController(FakeUpperCasePublicController)).toBe(true);
    expect(isPublicOutputController(FakeAdminController)).toBe(false);
    expect(isPublicOutputController(FakeLookalikeController)).toBe(false);
  });

  it('strips password keys at any depth from public responses', async () => {
    const body = {
      statusCode: 200,
      data: {
        password: 'top',
        articles: [{ id: 1, Password: 'nested', meta: { password: 'deep' } }],
      },
    };

    const result: any = await run(FakePublicController, body);

    expect(JSON.stringify(result)).not.toMatch(/password/i);
    expect(result.data.articles[0].id).toBe(1);
  });

  it('does not mutate the handler result, which may be shared with a cache', async () => {
    const cached = { data: [{ id: 1, password: 'kept-in-cache', title: 'acmecore' }] };

    await run(FakePublicController, cached, { masker: activeMasker });

    expect(cached.data[0].password).toBe('kept-in-cache');
    expect(cached.data[0].title).toBe('acmecore');
  });

  it('leaves admin responses untouched', async () => {
    const body = { data: { password: 'admin-only', title: 'acmecore' } };

    const result: any = await run(FakeAdminController, body, { masker: activeMasker });

    expect(result).toBe(body);
  });

  it('honors SkipPublicMask on echo endpoints', async () => {
    const body = { data: { password: 'echo', source: 'acmecore' } };

    const result: any = await run(FakeSkippedController, body, { masker: activeMasker });

    expect(result).toBe(body);
  });

  it('masks public output when masking is active', async () => {
    const result: any = await run(
      FakeUpperCasePublicController,
      { data: { title: 'acmecore', pathname: 'acmecore-post', id: 5 } },
      { masker: activeMasker },
    );
    expect(result).toEqual({ data: { title: 'X-CUSTOM-X', id: 5 } });
  });

  it('masks declared base64 fields', async () => {
    const html = Buffer.from('<p>acmecore</p>').toString('base64');
    const result: any = await run(
      FakePublicController,
      { data: { html } },
      { masker: activeMasker, handlerName: 'page' },
    );
    expect(Buffer.from(result.data.html, 'base64').toString('utf8')).toBe('<p>X-CUSTOM-X</p>');
  });

  it('masks error bodies', async () => {
    await expect(
      run(FakePublicController, new NotFoundException('missing acmecore'), {
        masker: activeMasker,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'missing X-CUSTOM-X' }),
    });
  });

  it('moves Last-Modified forward to the mask update time', async () => {
    const http = createHttp();
    http.res.setHeader('Last-Modified', new Date('2020-01-01T00:00:00.000Z').toUTCString());
    await run(FakePublicController, { data: {} }, { masker: activeMasker, http });
    expect(http.res.headers.get('Last-Modified')).toBe(
      new Date('2030-01-01T00:00:00.000Z').toUTCString(),
    );
  });

  it('passes through non-object payloads', () => {
    expect(stripPublicOutputKeys('plain')).toBe('plain');
    expect(stripPublicOutputKeys(undefined)).toBeUndefined();
  });
});

describe('neutralizeMaskedInput', () => {
  it('replaces params and query values that contain masked terms', () => {
    const req: any = {
      params: { name: 'acmecore-infra', id: '12' },
      query: { value: 'ACMECORE', page: '1', tags: ['ok', encodeURIComponent('acmecore')] },
    };
    neutralizeMaskedInput(req, activeMasker);
    expect(req.params).toEqual({ name: PUBLIC_MASK_UNMATCHABLE_INPUT, id: '12' });
    expect(req.query).toEqual({
      value: PUBLIC_MASK_UNMATCHABLE_INPUT,
      page: '1',
      tags: PUBLIC_MASK_UNMATCHABLE_INPUT,
    });
  });

  it('overrides getter-based query objects like Express 5', () => {
    const req: any = { params: {} };
    Object.defineProperty(req, 'query', {
      get: () => ({ value: 'acmecore' }),
      configurable: true,
    });
    neutralizeMaskedInput(req, activeMasker);
    expect(req.query.value).toBe(PUBLIC_MASK_UNMATCHABLE_INPUT);
  });

  it('does nothing while masking is inactive', () => {
    const req: any = { params: { name: 'acmecore' }, query: {} };
    neutralizeMaskedInput(req, { ...activeMasker, active: false } as any);
    expect(req.params.name).toBe('acmecore');
  });
});
