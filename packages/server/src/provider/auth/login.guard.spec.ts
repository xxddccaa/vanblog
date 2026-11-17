import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  getLoginRetryKeys,
  LOGIN_BASELINE_MAX_ATTEMPTS,
  LOGIN_BASELINE_WINDOW_SECONDS,
  LoginGuard,
} from './login.guard';

const IP = '203.0.113.7';

const createCache = () => {
  const counters = new Map<string, { count: number; ttlSeconds: number }>();
  return {
    counters,
    incrementWithTtl: jest.fn(async (key: string, ttlSeconds: number) => {
      const current = counters.get(key);
      const next = {
        count: (current?.count || 0) + 1,
        ttlSeconds: current?.ttlSeconds ?? ttlSeconds,
      };
      counters.set(key, next);
      return next.count;
    }),
    del: jest.fn(async (key: string) => {
      counters.delete(key);
    }),
  };
};

const createGuard = (setting: any) => {
  const cache = createCache();
  const settingProvider = { getLoginSetting: jest.fn(async () => setting) };
  const guard = new LoginGuard(cache as any, settingProvider as any);
  return { guard, cache, settingProvider };
};

const createRequest = (ip = IP) => ({ socket: { remoteAddress: ip } }) as any;

const attempt = (guard: LoginGuard, ip = IP) => guard.validateRequest(createRequest(ip));

const expectRejection = async (guard: LoginGuard, ip = IP) => {
  const error = await attempt(guard, ip).then(
    () => null,
    (thrown) => thrown,
  );
  expect(error).toBeInstanceOf(UnauthorizedException);
  return (error as UnauthorizedException).getResponse() as { statusCode: number; message: string };
};

describe('LoginGuard', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enforces the default limit when no login setting has been stored', async () => {
    const { guard } = createGuard(null);
    for (let i = 0; i < 3; i += 1) {
      await expect(attempt(guard)).resolves.toBe(true);
    }
    const response = await expectRejection(guard);
    expect(response.message).toContain('60');
  });

  it('honours a stricter configured maxRetryTimes and window', async () => {
    const { guard, cache } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 1,
      durationSeconds: 10,
    });
    await expect(attempt(guard)).resolves.toBe(true);
    const response = await expectRejection(guard);
    expect(response.message).toContain('10');
    expect(cache.counters.get(getLoginRetryKeys(createRequest()).configurable)?.ttlSeconds).toBe(
      10,
    );
  });

  it('accepts numeric strings because the setting API does not validate the body', async () => {
    const { guard } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: '2',
      durationSeconds: '30',
    });
    await attempt(guard);
    await attempt(guard);
    const response = await expectRejection(guard);
    expect(response.message).toContain('30');
  });

  it('falls back to the documented defaults when the stored config is invalid', async () => {
    const { guard } = createGuard({
      enableMaxLoginRetry: true,
      maxRetryTimes: 'abc',
      durationSeconds: -5,
    });
    for (let i = 0; i < 3; i += 1) {
      await attempt(guard);
    }
    const response = await expectRejection(guard);
    expect(response.message).toContain('60');
  });

  it('still applies the baseline limit when the configurable limit is disabled', async () => {
    const { guard, cache } = createGuard({ enableMaxLoginRetry: false });
    for (let i = 0; i < LOGIN_BASELINE_MAX_ATTEMPTS; i += 1) {
      await expect(attempt(guard)).resolves.toBe(true);
    }
    const response = await expectRejection(guard);
    expect(response.message).toContain(String(LOGIN_BASELINE_WINDOW_SECONDS));
    expect(cache.counters.has(getLoginRetryKeys(createRequest()).configurable)).toBe(false);
  });

  it('counts parallel attempts without losing increments', async () => {
    const { guard } = createGuard({ enableMaxLoginRetry: true, maxRetryTimes: 3 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => attempt(guard)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
  });

  it('groups IPv6 clients by /64 so rotating the interface id does not reset the counter', async () => {
    const { guard } = createGuard({ enableMaxLoginRetry: true, maxRetryTimes: 2 });
    await attempt(guard, '2001:db8:1:2::a');
    await attempt(guard, '2001:db8:1:2:ffff::b');
    await expectRejection(guard, '2001:db8:1:2:1234:5678:9abc:def0');
    await expect(attempt(guard, '2001:db8:1:3::a')).resolves.toBe(true);
  });

  it('keeps separate counters per IPv4 client', async () => {
    const { guard } = createGuard({ enableMaxLoginRetry: true, maxRetryTimes: 1 });
    await attempt(guard, '198.51.100.1');
    await expectRejection(guard, '198.51.100.1');
    await expect(attempt(guard, '198.51.100.2')).resolves.toBe(true);
  });
});
