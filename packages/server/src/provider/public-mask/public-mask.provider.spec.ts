import { ServiceUnavailableException } from '@nestjs/common';
import { defaultPublicMaskSetting } from 'src/utils/publicMask';
import { MaskedTextCache, PublicMaskProvider } from './public-mask.provider';

const activeSetting = (
  rules: any[] = [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
) => ({
  ...defaultPublicMaskSetting,
  enabled: true,
  replacements: { custom: 'X-CUSTOM-X', secret: 'X-SECRET-X', email: 'X-EMAIL-X', ip: 'X-IP-X' },
  rules,
});

const createProvider = (value: any) => {
  const structuredDataService = {
    getSetting: jest.fn().mockResolvedValue(value === undefined ? null : { value }),
    listTagNames: jest
      .fn()
      .mockResolvedValue(['golang', 'acmecore-infra', 'ACMECORE-infra', 'acmecore-ops']),
    listCategories: jest.fn().mockResolvedValue([{ name: 'Linux' }, { name: 'acmecore' }]),
  };
  const provider = new PublicMaskProvider(structuredDataService as any);
  return { provider, structuredDataService };
};

describe('PublicMaskProvider', () => {
  it('returns an inactive masker when no setting is stored', async () => {
    const { provider } = createProvider(undefined);
    const masker = await provider.getMasker();
    expect(masker.active).toBe(false);
    expect(masker.mask('acmecore')).toBe('acmecore');
  });

  it('caches the compiled masker between reloads and refreshes after invalidate', async () => {
    const { provider, structuredDataService } = createProvider(activeSetting());
    const first = await provider.getMasker();
    const second = await provider.getMasker();
    expect(second).toBe(first);
    expect(structuredDataService.getSetting).toHaveBeenCalledTimes(1);

    structuredDataService.getSetting.mockResolvedValue({
      value: activeSetting([{ id: 'kw2', enabled: true, type: 'keyword', pattern: 'blueyard' }]),
    });
    provider.invalidate();
    const third = await provider.getMasker();
    expect(third.version).not.toBe(first.version);
    expect(third.mask('blueyard acmecore')).toBe('X-CUSTOM-X acmecore');
  });

  it('fails closed when stored rules cannot compile', async () => {
    const { provider } = createProvider(
      activeSetting([{ id: 'bad', enabled: true, type: 'regex', pattern: '(unclosed' }]),
    );
    await expect(provider.getMasker()).rejects.toBeInstanceOf(ServiceUnavailableException);
    // The failure is cached too, so every public request keeps failing closed.
    await expect(provider.getMasker()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses the id for article paths whose pathname contains a hit', async () => {
    const { provider } = createProvider(activeSetting());
    const masker = await provider.getMasker();
    expect(provider.toPublicArticlePath({ id: 7, pathname: 'acmecore-setup' }, masker)).toBe('7');
    expect(provider.toPublicArticlePath({ id: 8, pathname: 'hello' }, masker)).toBe('hello');
    expect(provider.toPublicArticlePath({ id: 9 }, masker)).toBe('9');
  });

  it('resolves masked taxonomy names back to a unique raw name', async () => {
    const { provider } = createProvider(activeSetting());
    const masker = await provider.getMasker();
    expect(await provider.resolvePublicTaxonomyName('tag', 'golang', masker)).toBe('golang');
    expect(await provider.resolvePublicTaxonomyName('tag', 'X-CUSTOM-X-ops', masker)).toBe(
      'acmecore-ops',
    );
    // Two raw tags mask to the same name, so the lookup is ambiguous.
    expect(await provider.resolvePublicTaxonomyName('tag', 'X-CUSTOM-X-infra', masker)).toBeNull();
    // Raw names that contain a masked term are not addressable from public URLs.
    expect(await provider.resolvePublicTaxonomyName('category', 'acmecore', masker)).toBeNull();
    expect(await provider.resolvePublicTaxonomyName('category', 'X-CUSTOM-X', masker)).toBe(
      'acmecore',
    );
    expect(await provider.resolvePublicTaxonomyName('category', 'Unknown', masker)).toBe('Unknown');
  });

  it('caches masked text per masker version', async () => {
    const { provider } = createProvider(activeSetting());
    const masker = await provider.getMasker();
    const spy = jest.spyOn(masker, 'mask');
    expect(provider.maskCached(masker, 'a:1', 'acmecore body')).toBe('X-CUSTOM-X body');
    expect(provider.maskCached(masker, 'a:1', 'acmecore body')).toBe('X-CUSTOM-X body');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('MaskedTextCache', () => {
  it('evicts least recently used entries beyond the size budget', () => {
    const cache = new MaskedTextCache(10, 10);
    cache.set('a', '12345');
    cache.set('b', '12345');
    cache.get('a');
    cache.set('c', '12345');
    expect(cache.get('a')).toBe('12345');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('12345');
  });

  it('skips entries that exceed the per-entry limit', () => {
    const cache = new MaskedTextCache(100, 3);
    cache.set('a', '12345');
    expect(cache.get('a')).toBeUndefined();
  });
});
