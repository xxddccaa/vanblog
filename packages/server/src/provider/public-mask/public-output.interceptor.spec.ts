import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { SkipPublicMask } from './public-mask.decorators';
import {
  PublicOutputInterceptor,
  isPublicOutputController,
  normalizeControllerPath,
  stripPublicOutputKeys,
} from './public-output.interceptor';

@Controller('/api/public/')
class FakePublicController {
  @Get('item')
  item() {
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

const createContext = (controllerClass: any, type = 'http') =>
  ({
    getType: () => type,
    getClass: () => controllerClass,
    getHandler: () => controllerClass.prototype.item,
  }) as any;

const run = async (controllerClass: any, body: unknown) => {
  const interceptor = new PublicOutputInterceptor(new Reflector());
  return lastValueFrom(
    interceptor.intercept(createContext(controllerClass), { handle: () => of(body) }),
  );
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
    const cached = { data: [{ id: 1, password: 'kept-in-cache' }] };

    await run(FakePublicController, cached);

    expect(cached.data[0].password).toBe('kept-in-cache');
  });

  it('leaves admin responses untouched', async () => {
    const body = { data: { password: 'admin-only' } };

    const result: any = await run(FakeAdminController, body);

    expect(result).toBe(body);
  });

  it('honors SkipPublicMask on echo endpoints', async () => {
    const body = { data: { password: 'echo' } };

    const result: any = await run(FakeSkippedController, body);

    expect(result).toBe(body);
  });

  it('passes through non-object payloads', () => {
    expect(stripPublicOutputKeys('plain')).toBe('plain');
    expect(stripPublicOutputKeys(undefined)).toBeUndefined();
  });
});
