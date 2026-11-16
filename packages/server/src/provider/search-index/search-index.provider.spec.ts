import fs from 'fs';
import { SearchIndexProvider } from './search-index.provider';
import { PublicMaskProvider } from '../public-mask/public-mask.provider';
import { defaultPublicMaskSetting } from 'src/utils/publicMask';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(() => {
    throw new Error('missing');
  }),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  renameSync: jest.fn(),
}));

/** Returns the parsed search index from the atomic write of search-index.json. */
const readWrittenIndex = () => {
  const call = (fs.writeFileSync as jest.Mock).mock.calls.find(([filePath]) =>
    String(filePath).includes('.search-index.json.'),
  );
  return JSON.parse(call[1] as string);
};

describe('SearchIndexProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('writes a static search index with normalized search text', async () => {
    const articleProvider = {
      getPublicSearchIndexArticles: jest.fn().mockResolvedValue([
        {
          id: 1,
          pathname: 'stable-html',
          title: 'Stable HTML',
          category: 'Architecture',
          tags: ['Cloudflare', 'Cache'],
          content: 'Keep HTML stable and move dynamic parts out.',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
      ]),
    };
    const momentProvider = {
      getByOption: jest.fn().mockResolvedValue({ moments: [] }),
      searchByString: jest.fn().mockResolvedValue([]),
    };
    const draftProvider = {
      getByOption: jest.fn().mockResolvedValue({ drafts: [] }),
      searchByString: jest.fn().mockResolvedValue([]),
    };
    const documentProvider = {
      getByOption: jest.fn().mockResolvedValue({ documents: [] }),
      searchByString: jest.fn().mockResolvedValue([]),
    };
    const mindMapProvider = {
      getAllForBackup: jest.fn().mockResolvedValue([]),
      searchByString: jest.fn().mockResolvedValue([]),
    };

    const provider = new SearchIndexProvider(
      articleProvider as any,
      momentProvider as any,
      draftProvider as any,
      documentProvider as any,
      mindMapProvider as any,
    );
    await provider.generateSearchIndexFn('测试');

    expect(articleProvider.getPublicSearchIndexArticles).toHaveBeenCalledTimes(1);
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.renameSync).toHaveBeenCalledWith(
      expect.stringContaining('.search-index.json.'),
      expect.stringMatching(/search-index\.json$/),
    );
    expect(momentProvider.getByOption).not.toHaveBeenCalled();
    expect(draftProvider.getByOption).not.toHaveBeenCalled();
    expect(documentProvider.getByOption).not.toHaveBeenCalled();
    expect(mindMapProvider.getAllForBackup).not.toHaveBeenCalled();

    const parsed = readWrittenIndex();
    expect(parsed).toEqual([
      expect.objectContaining({
        id: 1,
        pathname: 'stable-html',
        title: 'Stable HTML',
        category: 'Architecture',
        tags: ['Cloudflare', 'Cache'],
      }),
    ]);
    expect(parsed[0].searchText).toContain('stable html');
    expect(parsed[0].searchText).toContain('architecture');
    expect(parsed[0].searchText).toContain('cloudflare cache');
  });

  it('builds the public static index from sanitized public articles so private content never lands in the file', async () => {
    const articleProvider = {
      getPublicSearchIndexArticles: jest.fn().mockResolvedValue([
        {
          id: 2,
          pathname: 'locked-post',
          title: 'Locked Post',
          category: 'Members',
          tags: ['Secret'],
          content: undefined,
          private: true,
          createdAt: new Date('2024-01-03T00:00:00.000Z'),
          updatedAt: new Date('2024-01-04T00:00:00.000Z'),
        },
      ]),
    };

    const provider = new SearchIndexProvider(
      articleProvider as any,
      { searchByString: jest.fn().mockResolvedValue([]) } as any,
      { searchByString: jest.fn().mockResolvedValue([]) } as any,
      { searchByString: jest.fn().mockResolvedValue([]) } as any,
      { searchByString: jest.fn().mockResolvedValue([]) } as any,
    );

    await provider.generateSearchIndexFn('测试');

    const parsed = readWrittenIndex();

    expect(parsed).toEqual([
      expect.objectContaining({
        id: 2,
        title: 'Locked Post',
        preview: '',
        searchText: 'locked post members secret',
      }),
    ]);
    expect(parsed[0].searchText).not.toContain('private');
    expect(parsed[0].searchText).not.toContain('content');
  });

  it('masks titles, taxonomy, previews, and search text before writing the index', async () => {
    const publicMaskProvider = new PublicMaskProvider({
      getSetting: jest.fn().mockResolvedValue({
        value: {
          ...defaultPublicMaskSetting,
          enabled: true,
          replacements: {
            custom: 'X-CUSTOM-X',
            secret: 'X-SECRET-X',
            email: 'X-EMAIL-X',
            ip: 'X-IP-X',
          },
          rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
        },
      }),
    } as any);
    const provider = new SearchIndexProvider(
      {
        getPublicSearchIndexArticles: jest.fn().mockResolvedValue([
          {
            id: 4,
            pathname: 'acmecore-runbook',
            title: 'AcmeCore runbook',
            category: 'acmecore-lab',
            tags: ['ACMECORE'],
            // The masked term sits right at the preview cut-off.
            content: `${'x'.repeat(275)} acmecore tail`,
            createdAt: new Date('2024-01-03T00:00:00.000Z'),
          },
        ]),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      publicMaskProvider,
    );

    await provider.generateSearchIndexFn('test');

    const parsed = readWrittenIndex();
    expect(JSON.stringify(parsed).toLowerCase()).not.toContain('acme');
    expect(parsed[0].pathname).toBeUndefined();
    expect(parsed[0].title).toBe('X-CUSTOM-X runbook');
  });

  it('falls back to provider search when elasticsearch has no hits', async () => {
    const articleProvider = {
      getPublicSearchIndexArticles: jest.fn(),
      searchByString: jest.fn().mockResolvedValue([
        {
          id: 1,
          pathname: 'stable-html',
          title: 'Stable HTML',
          category: 'Architecture',
          tags: ['Cloudflare'],
          content: 'Keep HTML stable and move dynamic parts out.',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
      ]),
    };
    const momentProvider = {
      getByOption: jest.fn(),
      searchByString: jest.fn().mockResolvedValue([
        {
          id: 2,
          content: 'Ship a new search pipeline.',
          createdAt: new Date('2024-02-01T00:00:00.000Z'),
          updatedAt: new Date('2024-02-03T00:00:00.000Z'),
        },
      ]),
    };
    const draftProvider = {
      getByOption: jest.fn(),
      searchByString: jest.fn().mockResolvedValue([]),
    };
    const documentProvider = {
      getByOption: jest.fn(),
      searchByString: jest.fn().mockResolvedValue([]),
    };
    const mindMapProvider = {
      getAllForBackup: jest.fn(),
      searchByString: jest.fn().mockResolvedValue([]),
    };

    const provider = new SearchIndexProvider(
      articleProvider as any,
      momentProvider as any,
      draftProvider as any,
      documentProvider as any,
      mindMapProvider as any,
    );
    const result = await provider.searchContent('search');

    expect(result).toEqual([
      expect.objectContaining({ type: 'moment', id: 2 }),
      expect.objectContaining({ type: 'article', id: 1, pathname: 'stable-html' }),
    ]);
  });

  it('searches admin scope across drafts, documents and mind maps', async () => {
    const provider = new SearchIndexProvider(
      {
        searchByString: jest.fn().mockResolvedValue([]),
      } as any,
      {
        searchByString: jest.fn().mockResolvedValue([]),
      } as any,
      {
        searchByString: jest.fn().mockResolvedValue([
          {
            id: 9,
            title: 'Draft Search',
            content: 'draft body',
            category: 'Ops',
            tags: ['redis'],
            createdAt: new Date('2024-03-01T00:00:00.000Z'),
            updatedAt: new Date('2024-03-02T00:00:00.000Z'),
          },
        ]),
      } as any,
      {
        searchByString: jest.fn().mockResolvedValue([
          {
            id: 11,
            title: 'Private Doc',
            content: 'postgres index notes',
            type: 'document',
            isSearchResult: true,
            createdAt: new Date('2024-03-03T00:00:00.000Z'),
            updatedAt: new Date('2024-03-04T00:00:00.000Z'),
          },
        ]),
      } as any,
      {
        searchByString: jest.fn().mockResolvedValue([
          {
            _id: 'mind-1',
            title: 'Search Graph',
            description: 'elasticsearch flow',
            createdAt: new Date('2024-03-05T00:00:00.000Z'),
            updatedAt: new Date('2024-03-06T00:00:00.000Z'),
          },
        ]),
      } as any,
    );

    const result = await provider.searchContent('postgres', 20, 'admin');

    expect(result).toEqual([
      expect.objectContaining({ type: 'mindmap', id: 'mind-1' }),
      expect.objectContaining({ type: 'document', id: 11 }),
      expect.objectContaining({ type: 'draft', id: 9 }),
    ]);
  });
});
