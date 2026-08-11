import { CacheProvider } from './cache.provider';

describe('CacheProvider', () => {
  it('increments a fallback counter without a check-then-set race', async () => {
    const provider = new CacheProvider();
    (provider as any).redisFailed = true;

    const values = await Promise.all(
      Array.from({ length: 20 }, () => provider.incrementWithTtl('attempts', 60)),
    );

    expect(values.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(await provider.get('attempts')).toBe(20);
  });
});
