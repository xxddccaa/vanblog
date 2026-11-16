import { PublicController } from './public.controller';
import { PublicMaskProvider } from 'src/provider/public-mask/public-mask.provider';
import { PUBLIC_MASK_UNMATCHABLE_INPUT } from 'src/provider/public-mask/public-output.interceptor';
import { defaultPublicMaskSetting } from 'src/utils/publicMask';

const setting = {
  ...defaultPublicMaskSetting,
  enabled: true,
  replacements: { custom: 'X-CUSTOM-X', secret: 'X-SECRET-X', email: 'X-EMAIL-X', ip: 'X-IP-X' },
  rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
};

const createController = () => {
  const structuredDataService = {
    getSetting: jest.fn().mockResolvedValue({ value: setting }),
    listTagNames: jest.fn().mockResolvedValue(['golang', 'acmecore-ops']),
    listCategories: jest.fn().mockResolvedValue([{ name: 'acmecore-lab' }, { name: 'Linux' }]),
  };
  const publicMaskProvider = new PublicMaskProvider(structuredDataService as any);
  const articleProvider = {
    getByOption: jest.fn().mockResolvedValue({ articles: [], total: 0 }),
    searchByString: jest.fn().mockResolvedValue([]),
    toSearchResult: jest.fn((items) => items),
    toPublic: jest.fn((items) => items),
  };
  const tagProvider = {
    getArticlesByTag: jest.fn().mockResolvedValue([]),
    getTagsPaginated: jest.fn().mockResolvedValue({
      tags: [
        { name: 'golang', articleCount: 3 },
        { name: 'acmecore-ops', articleCount: 9 },
        { name: 'zeta', articleCount: 1 },
      ],
      total: 3,
    }),
  };
  const customPageProvider = {
    getAll: jest.fn().mockResolvedValue([
      { name: 'Public', path: '/about-me' },
      { name: 'Internal', path: '/acmecore-runbook' },
    ]),
  };
  const cacheProvider = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
  const res = { setHeader: jest.fn(), getHeader: jest.fn() };
  const controller = new PublicController(
    articleProvider as any,
    {} as any,
    tagProvider as any,
    {} as any,
    {} as any,
    {} as any,
    customPageProvider as any,
    {} as any,
    {} as any,
    {} as any,
    cacheProvider as any,
    {} as any,
    publicMaskProvider,
  );
  return { controller, articleProvider, tagProvider, res };
};

describe('PublicController with masking', () => {
  it('searches and sorts tag pages on masked names', async () => {
    const { controller, tagProvider, res } = createController();

    const byPrefix = await controller.getTagsPaginated(
      '1',
      '50',
      'articleCount',
      'desc',
      'acme',
      res as any,
    );
    expect(byPrefix.data.total).toBe(0);
    expect(tagProvider.getTagsPaginated).toHaveBeenCalledWith(1, 100_000, 'articleCount', 'desc');

    const byName = await controller.getTagsPaginated(
      '1',
      '50',
      'name',
      'asc',
      undefined,
      res as any,
    );
    expect(byName.data.tags.map((tag: any) => tag.name)).toEqual([
      'golang',
      'X-CUSTOM-X-ops',
      'zeta',
    ]);
  });

  it('does not list custom pages whose path contains a masked term', async () => {
    const { controller, res } = createController();
    const result = await controller.getAll(res as any);
    expect(result.data.map((page: any) => page.path)).toEqual(['/about-me']);
  });

  it('resolves masked taxonomy names from public URLs back to stored names', async () => {
    const { controller, tagProvider, articleProvider, res } = createController();

    await controller.getArticlesByTagName('X-CUSTOM-X-ops', res as any);
    expect(tagProvider.getArticlesByTag).toHaveBeenCalledWith('acmecore-ops', false);

    await controller.getArticlesByCategoryName('X-CUSTOM-X-lab', res as any);
    expect(articleProvider.getByOption).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'acmecore-lab' }),
      true,
    );

    // A raw name that contains a masked term is not addressable.
    await controller.getArticlesByCategoryName('acmecore-lab', res as any);
    expect(articleProvider.getByOption).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: PUBLIC_MASK_UNMATCHABLE_INPUT }),
      true,
    );
  });

  it('passes a text masker to search and list queries', async () => {
    const { controller, articleProvider, res } = createController();

    await controller.searchArticle('golang');
    const searchOptions = articleProvider.searchByString.mock.calls[0][2];
    expect(searchOptions.maskText('acmecore')).toBe('X-CUSTOM-X');

    await controller.getByOption(
      '1' as any,
      '5' as any,
      false as any,
      'true' as any,
      false as any,
      false as any,
      'X-CUSTOM-X-lab',
      'golang,X-CUSTOM-X-ops',
      undefined,
      undefined,
      res as any,
    );
    const [option, isPublic, listOptions] = articleProvider.getByOption.mock.calls.at(-1);
    expect(option).toEqual(
      expect.objectContaining({ category: 'acmecore-lab', tags: 'golang,acmecore-ops' }),
    );
    expect(isPublic).toBe(true);
    expect(listOptions.maskText('acmecore')).toBe('X-CUSTOM-X');
  });
});
