import { UnauthorizedException } from '@nestjs/common';
import { config } from 'src/config';
import { AuthController } from './auth.controller';

jest.mock('src/provider/log/utils', () => ({
  getNetIp: jest.fn(),
}));

const { getNetIp } = jest.requireMock('src/provider/log/utils') as {
  getNetIp: jest.Mock;
};

describe('AuthController', () => {
  beforeEach(() => {
    getNetIp.mockResolvedValue({ ip: '', address: '' });
  });

  afterEach(() => {
    (config as any).debugSuperToken = '';
    jest.clearAllMocks();
  });

  function createController() {
    const authProvider = {
      login: jest.fn().mockResolvedValue({
        token: 'jwt-token',
        user: { id: 0, name: 'admin' },
      }),
    };
    const userProvider = {};
    const logProvider = {
      login: jest.fn(),
    };
    const tokenProvider = {
      disableAll: jest.fn(),
      disableToken: jest.fn(),
    };
    const cacheProvider = {
      del: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
    };
    const initProvider = {
      initRestoreKey: jest.fn(),
    };
    const pipelineProvider = {
      dispatchEvent: jest.fn(),
    };

    return {
      controller: new AuthController(
        authProvider as any,
        userProvider as any,
        logProvider as any,
        tokenProvider as any,
        cacheProvider as any,
        initProvider as any,
        pipelineProvider as any,
      ),
      authProvider,
      logProvider,
      cacheProvider,
      pipelineProvider,
      userProvider,
    };
  }

  it('clears the IP retry counter after a successful login so valid sessions do not burn remaining attempts', async () => {
    const { controller, authProvider, logProvider, cacheProvider, pipelineProvider } =
      createController();
    getNetIp.mockResolvedValue({ ip: '8.8.8.8', address: 'test' });

    const result = await controller.login({
      user: { id: 0, name: 'admin', type: 'admin' },
      headers: {},
    } as any);

    expect(logProvider.login).toHaveBeenCalledWith(expect.anything(), true);
    expect(cacheProvider.del).toHaveBeenCalledWith('login-8.8.8.8');
    expect(authProvider.login).toHaveBeenCalledWith({ id: 0, name: 'admin', type: 'admin' });
    expect(pipelineProvider.dispatchEvent).toHaveBeenCalledWith('login', result.data);
    expect(result).toEqual({
      statusCode: 200,
      data: {
        token: 'jwt-token',
        user: { id: 0, name: 'admin' },
      },
    });
  });

  it('keeps the retry counter untouched when credentials are invalid', async () => {
    const { controller, authProvider, logProvider, cacheProvider, pipelineProvider } =
      createController();

    await expect(
      controller.login({
        user: { fail: true },
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(logProvider.login).toHaveBeenCalledWith(expect.anything(), false);
    expect(cacheProvider.del).not.toHaveBeenCalled();
    expect(authProvider.login).not.toHaveBeenCalled();
    expect(pipelineProvider.dispatchEvent).not.toHaveBeenCalled();
  });

  it('only accepts the debug super token from the dedicated header to avoid leaking secrets in URLs', async () => {
    const { controller, authProvider, userProvider } = createController();
    (config as any).debugSuperToken = 'debug-secret';
    (userProvider as any).getUser = jest
      .fn()
      .mockResolvedValue({ name: 'admin', nickname: 'site-admin' });
    authProvider.login.mockResolvedValue({
      token: 'debug-token',
      user: { id: 0, name: 'admin' },
    });

    await expect(
      controller.debugToken({
        get: jest.fn().mockReturnValue(undefined),
        query: { debugSuperToken: 'debug-secret' },
        body: { key: 'debug-secret' },
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const result = await controller.debugToken({
      get: jest
        .fn()
        .mockImplementation((name: string) =>
          name === 'x-debug-super-token' ? 'debug-secret' : undefined,
        ),
      query: { debugSuperToken: 'wrong-place' },
      body: { key: 'wrong-place' },
    } as any);

    expect(authProvider.login).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 0,
        name: 'admin',
        type: 'admin',
        nickname: 'site-admin',
      }),
    );
    expect(result).toEqual({
      statusCode: 200,
      data: {
        token: 'debug-token',
        user: { id: 0, name: 'admin' },
      },
    });
  });

  it('blocks the debug token endpoint from public network clients even when the secret is correct', async () => {
    const { controller } = createController();
    (config as any).debugSuperToken = 'debug-secret';
    getNetIp.mockResolvedValue({ ip: '8.8.8.8', address: 'public' });

    await expect(
      controller.debugToken({
        get: jest
          .fn()
          .mockImplementation((name: string) =>
            name === 'x-debug-super-token' ? 'debug-secret' : undefined,
          ),
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks the restore endpoint from public network clients before applying admin credential changes', async () => {
    const { controller, cacheProvider, userProvider } = createController();
    getNetIp.mockResolvedValue({ ip: '8.8.8.8', address: 'public' });
    cacheProvider.get.mockResolvedValue('restore-key');
    const updateUser = jest.fn();
    (userProvider as any).updateUser = updateUser;

    await expect(
      controller.restore({} as any, {
        key: 'restore-key',
        name: 'admin',
        password: 'next-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(updateUser).not.toHaveBeenCalled();
  });
});
