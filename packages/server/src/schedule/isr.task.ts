import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RssProvider } from 'src/provider/rss/rss.provider';
import { SearchIndexProvider } from 'src/provider/search-index/search-index.provider';
import { SiteMapProvider } from 'src/provider/sitemap/sitemap.provider';
@Injectable()
export class ISRTask {
  constructor(
    private readonly rssProvider: RssProvider,
    private readonly sitemapProvider: SiteMapProvider,
    private readonly searchIndexProvider: SearchIndexProvider,
  ) {}

  @Cron('0 0 2 * * *')
  async handleCron() {
    // 保持 feed / sitemap / 搜索索引新鲜，但不再主动让整个公开站点重新渲染。
    this.rssProvider.generateRssFeed('定时刷新 RSS');
    this.sitemapProvider.generateSiteMap('定时刷新 SiteMap');
    this.searchIndexProvider.generateSearchIndex('定时刷新搜索索引');
  }
}
