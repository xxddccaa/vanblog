import fs from 'fs';
import { SearchIndexProvider } from './search-index.provider';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('SearchIndexProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('writes a static search index with normalized search text', async () => {
    const articleProvider = {
      getAll: jest.fn().mockResolvedValue([
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

    expect(articleProvider.getAll).toHaveBeenCalledWith('admin', false, false);
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(momentProvider.getByOption).not.toHaveBeenCalled();
    expect(draftProvider.getByOption).not.toHaveBeenCalled();
    expect(documentProvider.getByOption).not.toHaveBeenCalled();
    expect(mindMapProvider.getAllForBackup).not.toHaveBeenCalled();

    const [, content] = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const parsed = JSON.parse(content as string);
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

  it('falls back to provider search when elasticsearch has no hits', async () => {
    const articleProvider = {
      getAll: jest.fn(),
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
