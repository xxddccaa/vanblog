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

    const provider = new SearchIndexProvider(articleProvider as any);
    await provider.generateSearchIndexFn('测试');

    expect(articleProvider.getAll).toHaveBeenCalledWith('list', false, false);
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

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
});
