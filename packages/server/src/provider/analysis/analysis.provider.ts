import { Injectable } from '@nestjs/common';
import { ArticleProvider } from '../article/article.provider';
import { ViewerProvider } from '../viewer/viewer.provider';
import { MetaProvider } from '../meta/meta.provider';
import { ArticleTabData, ViewerTabData } from 'src/types/analysis';
import { VisitProvider } from '../visit/visit.provider';
import { TagProvider } from '../tag/tag.provider';
import { CategoryProvider } from '../category/category.provider';
import { CacheProvider } from '../cache/cache.provider';
import { StructuredDataService } from 'src/storage/structured-data.service';
export type WelcomeTab = 'overview' | 'viewer' | 'article';
@Injectable()
export class AnalysisProvider {
  constructor(
    private readonly metaProvider: MetaProvider,
    private readonly articleProvider: ArticleProvider,
    private readonly viewProvider: ViewerProvider,
    private readonly visitProvider: VisitProvider,
    private readonly tagProvider: TagProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly cacheProvider: CacheProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  private readonly CACHE_TTL = 30;

  private async getCachedTabData<T>(tab: WelcomeTab, size: number, loader: () => Promise<T>) {
    const cacheKey = `analysis:${tab}:${size}`;
    const cached = await this.cacheProvider.get(cacheKey);
    if (cached) {
      return cached as T;
    }
    const data = await loader();
    await this.cacheProvider.set(cacheKey, data, this.CACHE_TTL);
    return data;
  }

  async getOverViewTabData(num: number) {
    return this.getCachedTabData('overview', num, async () => {
      const [wordCount, articleNum, viewer, siteInfo] = await Promise.all([
        this.metaProvider.getTotalWords(),
        this.articleProvider.getTotalNum(true),
        this.viewProvider.getViewerGrid(num),
        this.metaProvider.getSiteInfo(),
      ]);
      const safeSiteInfo = siteInfo || ({} as any);

      return {
        total: {
          wordCount,
          articleNum,
        },
        viewer,
        link: {
          baseUrl: safeSiteInfo.baseUrl,
          enableComment: safeSiteInfo.enableComment || 'false',
        },
      };
    });
  }

  async getViewerTabData(num: number): Promise<ViewerTabData> {
    return this.getCachedTabData('viewer', num, async () => {
      const snapshot = await this.structuredDataService.getAnalysisViewerSnapshot(num);
      const [siteInfo, topViewer, topVisited, recentVisitArticles, lastVisitItem, totalStats] =
        snapshot &&
        (this.structuredDataService.isInitialized() ||
          snapshot.topViewer.length > 0 ||
          snapshot.topVisited.length > 0 ||
          snapshot.recentVisitArticles.length > 0 ||
          snapshot.totalViewer > 0 ||
          snapshot.totalVisited > 0)
          ? await Promise.all([
              this.metaProvider.getSiteInfo(),
              Promise.resolve(snapshot.topViewer),
              Promise.resolve(snapshot.topVisited),
              Promise.resolve(snapshot.recentVisitArticles),
              Promise.resolve({
                pathname: snapshot.siteLastVisitedPathname,
                lastVisitedTime: snapshot.siteLastVisitedTime,
              }),
              Promise.resolve({
                viewer: snapshot.totalViewer,
                visited: snapshot.totalVisited,
              }),
            ])
          : await Promise.all([
              this.metaProvider.getSiteInfo(),
              this.articleProvider.getTopViewer('list', num),
              this.articleProvider.getTopVisited('list', num),
              this.articleProvider.getRecentVisitedArticles(num, 'list'),
              this.visitProvider.getLastVisitItem(),
              this.metaProvider.getViewer(),
            ]);
      const safeSiteInfo = siteInfo || ({} as any);

      return {
        enableGA: Boolean(safeSiteInfo.gaAnalysisId) && safeSiteInfo.gaAnalysisId != '',
        enableBaidu: Boolean(safeSiteInfo.baiduAnalysisId) && safeSiteInfo.baiduAnalysisId != '',
        topViewer,
        topVisited,
        recentVisitArticles,
        topVisitedPaths: snapshot?.topVisitedPaths || [],
        recentVisitedPaths: snapshot?.recentVisitedPaths || [],
        siteLastVisitedTime: lastVisitItem?.lastVisitedTime || null,
        siteLastVisitedPathname: lastVisitItem?.pathname || '',
        totalViewer: totalStats.viewer,
        totalVisited: totalStats.visited,
        maxArticleVisited: snapshot?.maxArticleVisited ?? topVisited?.[0]?.visited ?? 0,
        maxArticleViewer: snapshot?.maxArticleViewer ?? topViewer?.[0]?.viewer ?? 0,
      };
    });
  }

  async getArticleTabData(num: number): Promise<ArticleTabData> {
    return this.getCachedTabData('article', num, async () => {
      const snapshot = await this.structuredDataService.getAnalysisArticleSnapshot(num);
      if (
        snapshot &&
        (this.structuredDataService.isInitialized() ||
          snapshot.articleNum > 0 ||
          snapshot.wordNum > 0 ||
          snapshot.tagNum > 0 ||
          snapshot.categoryNum > 0 ||
          snapshot.categoryPieData.length > 0 ||
          snapshot.columnData.length > 0)
      ) {
        return snapshot;
      }

      const [articleNum, wordNum, tags, categories, categoryPieData, columnData] = await Promise.all(
        [
          this.articleProvider.getTotalNum(true),
          this.metaProvider.getTotalWords(),
          this.tagProvider.getAllTags(true),
          this.categoryProvider.getAllCategories(),
          this.categoryProvider.getPieData(),
          this.tagProvider.getColumnData(num, true),
        ],
      );

      return {
        articleNum,
        wordNum,
        tagNum: tags?.length || 0,
        categoryNum: categories?.length || 0,
        categoryPieData,
        columnData,
      };
    });
  }

  async getWelcomePageData(
    tab: WelcomeTab,
    overviewDataNum: number,
    viewerDataNum: number,
    articleTabDataNum: number,
  ) {
    // 总字数和总文章数
    if (tab == 'overview') {
      return await this.getOverViewTabData(overviewDataNum);
    }
    if (tab == 'viewer') {
      return await this.getViewerTabData(viewerDataNum);
    }
    if (tab == 'article') {
      return await this.getArticleTabData(articleTabDataNum);
    }
  }
}
