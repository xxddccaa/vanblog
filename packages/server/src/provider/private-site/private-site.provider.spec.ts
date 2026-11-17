import { resolveInternalRequestSecret } from './private-site.provider';

describe('resolveInternalRequestSecret', () => {
  const keys = ['VANBLOG_ISR_TOKEN', 'VANBLOG_SHARED_SECRET', 'WALINE_JWT_TOKEN'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('prefers the dedicated ISR token', () => {
    process.env.VANBLOG_ISR_TOKEN = 'isr-secret';
    process.env.VANBLOG_SHARED_SECRET = 'shared-secret';
    process.env.WALINE_JWT_TOKEN = 'legacy-secret';
    expect(resolveInternalRequestSecret()).toBe('isr-secret');
  });

  it('uses VANBLOG_SHARED_SECRET before the legacy name', () => {
    process.env.VANBLOG_SHARED_SECRET = 'shared-secret';
    process.env.WALINE_JWT_TOKEN = 'legacy-secret';
    expect(resolveInternalRequestSecret()).toBe('shared-secret');
  });

  it('still honours the legacy WALINE_JWT_TOKEN', () => {
    process.env.WALINE_JWT_TOKEN = 'legacy-secret';
    expect(resolveInternalRequestSecret()).toBe('legacy-secret');
  });

  it('returns an empty string when nothing is configured', () => {
    expect(resolveInternalRequestSecret()).toBe('');
  });
});
