import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { VisitProvider } from 'src/provider/visit/visit.provider';
import { config } from 'src/config';
import { UpdateSiteViewerDto, BatchUpdateViewerDto } from 'src/types/viewer.dto';
import { ApiToken } from 'src/provider/swagger/token';
import { PublicDataCacheProvider } from 'src/provider/public-data-cache/public-data-cache.provider';

@ApiTags('viewer')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/meta/viewer')
export class ViewerMetaController {
  constructor(
    private readonly metaProvider: MetaProvider,
    private readonly articleProvider: ArticleProvider,
    private readonly visitProvider: VisitProvider,
    private readonly isrProvider: ISRProvider,
    private readonly publicDataCacheProvider: PublicDataCacheProvider,
  ) {}

  private normalizeNonNegativeInt(value: number | string | undefined, fallback = 0, max = 1000000000) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  private normalizeArticleId(value: number | string | undefined) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error('文章 ID 非法');
    }
    return parsed;
  }

  private async refreshViewerFacingPages() {
    await this.publicDataCacheProvider.clearViewerData();
    this.isrProvider.activeUrl('/', false);
    this.isrProvider.activeUrl('/about', false);
    this.isrProvider.activeUrl('/timeline', false);
  }

  @Get()
  async get() {
    const siteData = await this.metaProvider.getViewer();
    const articles = await this.articleProvider.getAll('list', true);
    const articlesViewer = articles
      .filter(article => !article.deleted && !article.hidden)
      .map(article => ({
        id: article.id,
        title: article.title,
        viewer: article.viewer || 0,
        visited: article.visited || 0,
      }));
    
    return {
      statusCode: 200,
      data: {
        site: siteData,
        articles: articlesViewer,
      },
    };
  }

  @Put('/site')
  async updateSite(@Body() updateDto: UpdateSiteViewerDto) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    await this.metaProvider.update({
      viewer: this.normalizeNonNegativeInt(updateDto.viewer),
      visited: this.normalizeNonNegativeInt(updateDto.visited),
    });
    await this.refreshViewerFacingPages();
    
    return {
      statusCode: 200,
      message: '网站浏览量更新成功！',
    };
  }

  @Put('/article')
  async updateArticle(@Body() updateDto: { id: number; viewer: number; visited: number }) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    const articleId = this.normalizeArticleId(updateDto.id);
    const viewer = this.normalizeNonNegativeInt(updateDto.viewer);
    const visited = this.normalizeNonNegativeInt(updateDto.visited);

    // 更新Article表中的浏览量
    await this.articleProvider.updateById(articleId, {
      viewer,
      visited,
    });
    
    // 同时更新Visit表中的浏览量（这是前端显示的数据源）
    const pathname = `/post/${articleId}`;
    await this.visitProvider.rewriteToday(pathname, viewer, visited);
    await this.refreshViewerFacingPages();
    
    return {
      statusCode: 200,
      message: '文章浏览量更新成功！',
    };
  }

  @Put('/batch')
  async batchUpdate(@Body() updateDto: BatchUpdateViewerDto) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    // 更新网站总浏览量
    await this.metaProvider.update({
      viewer: this.normalizeNonNegativeInt(updateDto.siteViewer),
      visited: this.normalizeNonNegativeInt(updateDto.siteVisited),
    });
    
    // 批量更新文章浏览量
    for (const article of (updateDto.articles || []).slice(0, 500)) {
      const articleId = this.normalizeArticleId(article.id);
      const viewer = this.normalizeNonNegativeInt(article.viewer);
      const visited = this.normalizeNonNegativeInt(article.visited);
      // 更新Article表
      await this.articleProvider.updateById(articleId, {
        viewer,
        visited,
      });
      
      // 同时更新Visit表中的浏览量（这是前端显示的数据源）
      const pathname = `/post/${articleId}`;
      await this.visitProvider.rewriteToday(pathname, viewer, visited);
    }
    await this.refreshViewerFacingPages();
    
    return {
      statusCode: 200,
      message: '浏览量批量更新成功！',
    };
  }

  @Put('/auto-boost')
  async autoBoost(@Body() boostConfig: { 
    minIncrease: number; 
    maxIncrease: number; 
    siteMultiplier: number;
    articlesOnly?: boolean;
  }) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    const { minIncrease, maxIncrease, siteMultiplier, articlesOnly = false } = boostConfig;
    const safeMinIncrease = this.normalizeNonNegativeInt(minIncrease, 0, 1000000);
    const safeMaxIncrease = this.normalizeNonNegativeInt(maxIncrease, safeMinIncrease, 1000000);
    const normalizedMaxIncrease = Math.max(safeMinIncrease, safeMaxIncrease);
    const safeSiteMultiplier = this.normalizeNonNegativeInt(siteMultiplier, 0, 1000);
    
    // 获取所有文章
    const articles = await this.articleProvider.getAll('list', true);
    const validArticles = articles.filter(article => !article.deleted && !article.hidden);
    
    let totalViewerIncrease = 0;
    let totalVisitedIncrease = 0;
    
    // 随机提升每篇文章的浏览量
    for (const article of validArticles) {
      const viewerIncrease =
        Math.floor(Math.random() * (normalizedMaxIncrease - safeMinIncrease + 1)) + safeMinIncrease;
      const visitedIncrease = Math.floor(viewerIncrease * (0.3 + Math.random() * 0.4)); // 访客数是访问量的30%-70%
      
      const newViewer = (article.viewer || 0) + viewerIncrease;
      const newVisited = (article.visited || 0) + visitedIncrease;
      
      // 更新Article表
      await this.articleProvider.updateById(article.id, {
        viewer: newViewer,
        visited: newVisited,
      });
      
      // 同时更新Visit表中的浏览量（这是前端显示的数据源）
      const pathname = `/post/${article.id}`;
      await this.visitProvider.rewriteToday(pathname, newViewer, newVisited);
      
      totalViewerIncrease += viewerIncrease;
      totalVisitedIncrease += visitedIncrease;
    }
    
    // 更新网站总浏览量（考虑到非文章页面的访问）
    if (!articlesOnly) {
      const currentSite = await this.metaProvider.getViewer();
      const siteViewerIncrease = Math.floor(totalViewerIncrease * safeSiteMultiplier);
      const siteVisitedIncrease = Math.floor(totalVisitedIncrease * safeSiteMultiplier);
      
      await this.metaProvider.update({
        viewer: currentSite.viewer + siteViewerIncrease,
        visited: currentSite.visited + siteVisitedIncrease,
      });
    }
    await this.refreshViewerFacingPages();
    
    return {
      statusCode: 200,
      data: {
        articlesUpdated: validArticles.length,
        totalViewerIncrease,
        totalVisitedIncrease,
      },
      message: '浏览量智能提升完成！',
    };
  }
} 
