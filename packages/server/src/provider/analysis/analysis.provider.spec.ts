import { AnalysisProvider } from './analysis.provider';

describe('AnalysisProvider', () => {
  it('caches overview tab payloads for repeated requests', async () => {
    const cacheProvider = {
      get: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        total: { wordCount: 100, articleNum: 5 },
      }),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new AnalysisProvider(
      {
        getTotalWords: jest.fn().mockResolvedValue(100),
        getSiteInfo: jest.fn().mockResolvedValue({ baseUrl: 'https://example.com' }),
      } as any,
      {
        getTotalNum: jest.fn().mockResolvedValue(5),
      } as any,
      {
        getViewerGrid: jest.fn().mockResolvedValue({ grid: { total: [], each: [] } }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      cacheProvider as any,
      {
        getAnalysisViewerSnapshot: jest.fn().mockResolvedValue(null),
        getAnalysisArticleSnapshot: jest.fn().mockResolvedValue(null),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    const first = await provider.getOverViewTabData(7);
    const second = await provider.getOverViewTabData(7);

    expect(first).toEqual(
      expect.objectContaining({
        total: { wordCount: 100, articleNum: 5 },
      }),
    );
    expect(second).toEqual({
      total: { wordCount: 100, articleNum: 5 },
    });
    expect(cacheProvider.set).toHaveBeenCalledWith(
      'analysis:overview:7',
      expect.any(Object),
      30,
    );
  });

  it('builds viewer tab data from aggregated sources', async () => {
    const provider = new AnalysisProvider(
      {
        getSiteInfo: jest.fn().mockResolvedValue({ gaAnalysisId: 'ga', baiduAnalysisId: '' }),
        getViewer: jest.fn().mockResolvedValue({ viewer: 30, visited: 12 }),
      } as any,
      {
        getTopViewer: jest.fn().mockResolvedValue([{ id: 1, viewer: 8 }]),
        getTopVisited: jest.fn().mockResolvedValue([{ id: 1, visited: 6 }]),
        getRecentVisitedArticles: jest.fn().mockResolvedValue([{ id: 1 }]),
      } as any,
      {} as any,
      {
        getLastVisitItem: jest.fn().mockResolvedValue({
          pathname: '/post/1',
          lastVisitedTime: new Date('2026-04-10T00:00:00.000Z'),
        }),
      } as any,
      {} as any,
      {} as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        getAnalysisViewerSnapshot: jest.fn().mockResolvedValue({
          topViewer: [{ id: 1, viewer: 8 }],
          topVisited: [{ id: 1, visited: 6 }],
          recentVisitArticles: [{ id: 1 }],
          topVisitedPaths: [{ pathname: '/post/1', viewer: 8, visited: 6, lastVisitedTime: null }],
          recentVisitedPaths: [
            {
              pathname: '/about',
              viewer: 4,
              visited: 3,
              lastVisitedTime: new Date('2026-04-10T00:00:00.000Z'),
            },
          ],
          siteLastVisitedPathname: '/post/1',
          siteLastVisitedTime: new Date('2026-04-10T00:00:00.000Z'),
          totalViewer: 30,
          totalVisited: 12,
          maxArticleViewer: 8,
          maxArticleVisited: 6,
        }),
        getAnalysisArticleSnapshot: jest.fn().mockResolvedValue(null),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const result = await provider.getViewerTabData(5);

    expect(result).toEqual(
      expect.objectContaining({
        enableGA: true,
        enableBaidu: false,
        totalViewer: 30,
        totalVisited: 12,
        maxArticleViewer: 8,
        maxArticleVisited: 6,
        siteLastVisitedPathname: '/post/1',
        topVisitedPaths: [{ pathname: '/post/1', viewer: 8, visited: 6, lastVisitedTime: null }],
      }),
    );
  });

  it('prefers structured article snapshot when PostgreSQL aggregates are ready', async () => {
    const provider = new AnalysisProvider(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        getAnalysisViewerSnapshot: jest.fn().mockResolvedValue(null),
        getAnalysisArticleSnapshot: jest.fn().mockResolvedValue({
          articleNum: 8,
          wordNum: 3200,
          tagNum: 12,
          categoryNum: 3,
          categoryPieData: [{ type: 'DB', value: 4 }],
          columnData: [{ type: 'postgresql', value: 5 }],
        }),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    await expect(provider.getArticleTabData(5)).resolves.toEqual({
      articleNum: 8,
      wordNum: 3200,
      tagNum: 12,
      categoryNum: 3,
      categoryPieData: [{ type: 'DB', value: 4 }],
      columnData: [{ type: 'postgresql', value: 5 }],
    });
  });
});
