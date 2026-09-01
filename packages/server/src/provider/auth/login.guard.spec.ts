import { Logger, UnauthorizedException } from '@nestjs/common';
import { LoginGuard } from './login.guard';

const IP = '203.0.113.7';
const KEY = `login-${IP}`;

const createCache = () => {
  const store = new Map<string, { value: any; ttlSeconds?: number }>();
  return {
    store,
    seed: (value: any, ttlSeconds?: number) => store.set(KEY, { value, ttlSeconds }),
    entry: () => store.get(KEY),
    get: jest.fn(async (key: string) => (store.has(key) ? store.get(key).value : null)),
    set: jest.fn(async (key: string, value: any, ttlSeconds?: number) => {
      store.set(key, { value, ttlSeconds });
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
};

const createGuard = (setting: any) => {
  const cache = createCache();
  const settingProvider = { getLoginSetting: jest.fn(async () => setting) };
  const guard = new LoginGuard(cache as any, settingProvider as any);
  return { guard, cache, settingProvider };
};

const createRequest = () => ({ socket: { remoteAddress: IP } }) as any;

const secondsAgo = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

const attempt = (guard: LoginGuard) => guard.validateRequest(createRequest());

const expectRejection = async (guard: LoginGuard) => {
  const error = await attempt(guard).then(
    () => null,
    (thrown) => thrown,
  );
  expect(error).toBeInstanceOf(UnauthorizedException);
  return (error as UnauthorizedException).getResponse() as { statusCode: number; message: string };
};

describe('LoginGuard retry limit configuration', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects the attempt that exceeds a stricter configured maxRetryTimes', async () => {
    const { guard } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 1,
      durationSeconds: 10,
    });

    await expect(attempt(guard)).resolves.toBe(true);
    await expectRejection(guard);
  });

  it('allows more attempts than the legacy hardcoded limit when configured', async () => {
    const { guard } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 10,
      durationSeconds: 60,
    });

    for (let i = 0; i < 10; i += 1) {
      await expect(attempt(guard)).resolves.toBe(true);
    }
    await expectRejection(guard);
  });

  it('accepts numeric strings because the setting API does not validate the body', async () => {
    const { guard } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: '2',
      durationSeconds: '30',
    });

    await expect(attempt(guard)).resolves.toBe(true);
    await expect(attempt(guard)).resolves.toBe(true);
    await expectRejection(guard);
  });

  it('keeps blocking while the configured window is still open', async () => {
    const { guard, cache } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 3,
      durationSeconds: 600,
    });
    cache.seed({ count: 3, lastLoginTime: secondsAgo(120) });

    await expectRejection(guard);
  });

  it('resets the counter once the configured window has expired', async () => {
    const { guard, cache } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 3,
      durationSeconds: 10,
    });
    cache.seed({ count: 9, lastLoginTime: secondsAgo(30) });

    await expect(attempt(guard)).resolves.toBe(true);
    expect(cache.entry().value.count).toBe(1);
  });

  it('describes the configured lockout duration in the rejection message', async () => {
    const { guard, cache } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 2,
      durationSeconds: 300,
    });
    cache.seed({ count: 2, lastLoginTime: secondsAgo(1) });

    const response = await expectRejection(guard);
    expect(response.statusCode).toBe(401);
    expect(response.message).toContain('300 秒');
  });

  it('expires the retry counter with the configured window', async () => {
    const { guard, cache } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 3,
      durationSeconds: 45,
    });

    await expect(attempt(guard)).resolves.toBe(true);
    expect(cache.set).toHaveBeenLastCalledWith(KEY, expect.objectContaining({ count: 1 }), 45);
  });

  it('falls back to the documented defaults when the stored config is invalid', async () => {
    const { guard, cache } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 0,
      durationSeconds: -5,
    });

    for (let i = 0; i < 3; i += 1) {
      await expect(attempt(guard)).resolves.toBe(true);
    }
    await expectRejection(guard);
    expect(cache.set).toHaveBeenLastCalledWith(KEY, expect.any(Object), 60);
  });

  it('does not let a corrupted counter disable the retry limit', async () => {
    const { guard, cache } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 2,
      durationSeconds: 60,
    });
    cache.seed({ count: 'not-a-number', lastLoginTime: secondsAgo(1) });

    await expect(attempt(guard)).resolves.toBe(true);
    expect(cache.entry().value.count).toBe(1);
    await expect(attempt(guard)).resolves.toBe(true);
    await expectRejection(guard);
  });

  it('allows every attempt when the retry limit is disabled', async () => {
    const { guard, cache } = createGuard({
      enableMaxLoginRetry: false,
      maxRetryTimes: 1,
      durationSeconds: 10,
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(attempt(guard)).resolves.toBe(true);
    }
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('allows every attempt when no login setting has been stored', async () => {
    const { guard, cache } = createGuard(null);

    for (let i = 0; i < 5; i += 1) {
      await expect(attempt(guard)).resolves.toBe(true);
    }
    expect(cache.set).not.toHaveBeenCalled();
  });
});
