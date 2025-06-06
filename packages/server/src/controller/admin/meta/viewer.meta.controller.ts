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
  ) {}

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
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    await this.metaProvider.update({
      viewer: updateDto.viewer,
      visited: updateDto.visited,
    });
    
    return {
      statusCode: 200,
      message: '网站浏览量更新成功！',
    };
  }

  @Put('/article')
  async updateArticle(@Body() updateDto: { id: number; viewer: number; visited: number }) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    // 更新Article表中的浏览量
    await this.articleProvider.updateById(updateDto.id, {
      viewer: updateDto.viewer,
      visited: updateDto.visited,
    });
    
    // 同时更新Visit表中的浏览量（这是前端显示的数据源）
    const pathname = `/post/${updateDto.id}`;
    await this.visitProvider.rewriteToday(pathname, updateDto.viewer, updateDto.visited);
    
    return {
      statusCode: 200,
      message: '文章浏览量更新成功！',
    };
  }

  @Put('/batch')
  async batchUpdate(@Body() updateDto: BatchUpdateViewerDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    // 更新网站总浏览量
    await this.metaProvider.update({
      viewer: updateDto.siteViewer,
      visited: updateDto.siteVisited,
    });
    
    // 批量更新文章浏览量
    for (const article of updateDto.articles) {
      // 更新Article表
      await this.articleProvider.updateById(article.id, {
        viewer: article.viewer,
        visited: article.visited,
      });
      
      // 同时更新Visit表中的浏览量（这是前端显示的数据源）
      const pathname = `/post/${article.id}`;
      await this.visitProvider.rewriteToday(pathname, article.viewer, article.visited);
    }
    
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
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    const { minIncrease, maxIncrease, siteMultiplier, articlesOnly = false } = boostConfig;
    
    // 获取所有文章
    const articles = await this.articleProvider.getAll('list', true);
    const validArticles = articles.filter(article => !article.deleted && !article.hidden);
    
    let totalViewerIncrease = 0;
    let totalVisitedIncrease = 0;
    
    // 随机提升每篇文章的浏览量
    for (const article of validArticles) {
      const viewerIncrease = Math.floor(Math.random() * (maxIncrease - minIncrease + 1)) + minIncrease;
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
      const siteViewerIncrease = Math.floor(totalViewerIncrease * siteMultiplier);
      const siteVisitedIncrease = Math.floor(totalVisitedIncrease * siteMultiplier);
      
      await this.metaProvider.update({
        viewer: currentSite.viewer + siteViewerIncrease,
        visited: currentSite.visited + siteVisitedIncrease,
      });
    }
    
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