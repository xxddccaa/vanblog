import { TagProvider } from './tag.provider';

describe('TagProvider', () => {
  it('syncs tags by rebuilding tag aggregates without rebuilding article tables', async () => {
    const cacheProvider = {
      delPattern: jest.fn().mockResolvedValue(undefined),
    };
    const structuredDataService = {
      rebuildArticleTagAggregates: jest.fn().mockResolvedValue(undefined),
      refreshArticlesFromRecordStore: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new TagProvider(
      {} as any,
      {} as any,
      cacheProvider as any,
      structuredDataService as any,
    );

    await provider.syncTagsFromArticles();

    expect(structuredDataService.rebuildArticleTagAggregates).toHaveBeenCalledTimes(1);
    expect(structuredDataService.refreshArticlesFromRecordStore).not.toHaveBeenCalled();
    expect(cacheProvider.delPattern).toHaveBeenCalledWith('tag:*');
  });

  it('renames tags with a targeted PG sync instead of rebuilding all structured articles', async () => {
    const articleModel = {
      updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const provider = new TagProvider(
      { articleModel } as any,
      {} as any,
      {
        delPattern: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        getTagByName: jest.fn().mockResolvedValue({ name: 'old-tag', articleCount: 3 }),
        renameTagInArticles: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await provider.updateTagByName('old-tag', 'new-tag');

    expect(result).toEqual({ message: '更新成功！', total: 3 });
    expect(articleModel.updateMany).toHaveBeenCalledWith(
      { tags: 'old-tag' },
      { $set: { 'tags.$': 'new-tag' } },
    );
    expect((provider as any).structuredDataService.renameTagInArticles).toHaveBeenCalledWith(
      'old-tag',
      'new-tag',
    );
  });

  it('groups all tag articles from one public article query', async () => {
    const articleProvider = {
      getByOption: jest.fn().mockResolvedValue({
        articles: [
          {
            id: 1,
            title: 'Shared',
            tags: ['beta', 'alpha'],
          },
          {
            id: 2,
            title: 'Alpha only',
            tags: ['alpha'],
          },
          {
            id: 3,
            title: 'Unknown',
            tags: ['not-a-record'],
          },
        ],
      }),
    };
    const structuredDataService = {
      listTagRecords: jest.fn().mockResolvedValue([
        {
          name: 'alpha',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
        {
          name: 'beta',
          createdAt: '2026-04-02T00:00:00.000Z',
        },
        {
          name: 'empty',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ]),
    };
    const provider = new TagProvider(
      articleProvider as any,
      {} as any,
      { get: jest.fn(), set: jest.fn(), delPattern: jest.fn() } as any,
      structuredDataService as any,
    );

    const result = await provider.getTagsWithArticlePayload(false);

    expect(result.data).toEqual({
      alpha: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })],
      beta: [expect.objectContaining({ id: 1 })],
    });
    expect(Object.keys(result.data)).toEqual(['alpha', 'beta']);
    expect(result.latestTimestamp).toBe('2026-04-03T00:00:00.000Z');
    expect(structuredDataService.listTagRecords).toHaveBeenCalledTimes(1);
    expect(articleProvider.getByOption).toHaveBeenCalledTimes(1);
    expect(articleProvider.getByOption).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: -1,
        toListView: true,
        regMatch: false,
      },
      true,
    );
  });
});
