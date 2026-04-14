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
});
