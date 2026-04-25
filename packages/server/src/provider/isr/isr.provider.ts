import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Article } from 'src/scheme/article.schema';
import { sleep } from 'src/utils/sleep';
import { ArticleProvider } from '../article/article.provider';
import { RssProvider } from '../rss/rss.provider';
import { SettingProvider } from '../setting/setting.provider';
import { SiteMapProvider } from '../sitemap/sitemap.provider';
import { SearchIndexProvider } from '../search-index/search-index.provider';
import { encodeQuerystring } from 'src/utils/washUrl';
import { PublicDataCacheProvider } from '../public-data-cache/public-data-cache.provider';
import { CloudflareCacheProvider } from '../cloudflare-cache/cloudflare-cache.provider';
import { toCacheTag } from 'src/utils/cacheTag';
export interface ActiveConfig {
  postId?: number;
  forceActice?: boolean;
}
@Injectable()
export class ISRProvider {
  urlList = ['/', '/archive', '/category', '/tag', '/timeline', '/about', '/link'];
  base =
    process.env['VANBLOG_WEBSITE_ISR_BASE'] ||
    (process.env.NODE_ENV === 'production'
      ? 'http://website:3001/api/revalidate?path='
      : 'http://127.0.0.1:3001/api/revalidate?path=');
  private readonly isrToken =
    process.env['VANBLOG_ISR_TOKEN'] || process.env['WALINE_JWT_TOKEN'] || '';
  logger = new Logger(ISRProvider.name);
  timer = null;
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly rssProvider: RssProvider,
    private readonly sitemapProvider: SiteMapProvider,
    private readonly settingProvider: SettingProvider,
    private readonly searchIndexProvider: SearchIndexProvider,
    private readonly publicDataCacheProvider: PublicDataCacheProvider,
    private readonly cloudflareCacheProvider: CloudflareCacheProvider,
  ) {}

  private getArtifactUrls() {
    return ['/feed.xml', '/feed.json', '/atom.xml', '/sitemap.xml', '/static/search-index.json'];
  }

  private getIsrRequestConfig() {
    if (!this.isrToken) {
      return undefined;
    }
    return {
      headers: {
        'x-vanblog-isr-token': this.isrToken,
      },
    };
  }

  async activeAllFn(info?: string, activeConfig?: ActiveConfig) {
    const isrConfig = await this.settingProvider.getISRSetting();
    if (isrConfig?.mode == 'delay' && !activeConfig?.forceActice) {
      this.logger.debug(`延时自动更新模式，阻止按需 ISR`);
      return;
    }
    if (info) {
      this.logger.log(info);
    } else {
      this.logger.log('首次启动触发全量渲染！');
    }
    // ! 配置差的机器可能并发多了会卡，所以改成串行的。

    await this.activeUrls(this.urlList, false);
    let postId: any = null;
    const articleWithThisId = await this.articleProvider.getById(postId, 'list');
    if (articleWithThisId) {
      postId = articleWithThisId.pathname || articleWithThisId.id;
    }
    await this.activePath('post', postId || undefined);
    await this.activePath('archive');
    await this.activePath('category');
    await this.activePath('tag');
    this.logger.log('触发全量渲染完成！');
  }
  async activeAll(info?: string, delay?: number, activeConfig?: ActiveConfig) {
    await this.publicDataCacheProvider.clearAllPublicData();
    if (process.env['VANBLOG_DISABLE_WEBSITE'] === 'true') {
      this.rssProvider.generateRssFeed(info || '', delay);
      this.sitemapProvider.generateSiteMap(info || '', delay);
      this.searchIndexProvider.generateSearchIndex(info || '', delay);
      await this.cloudflareCacheProvider.purgeByTagsAndUrls(
        [
          'html-public',
          'html-post',
          'html-listing',
          'public-api',
          'artifact:feed',
          'artifact:sitemap',
          'artifact:search-index',
        ],
        this.getArtifactUrls(),
        info || 'full-site-refresh',
      );
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.rssProvider.generateRssFeed(info || '', delay);
      this.sitemapProvider.generateSiteMap(info || '', delay);
      this.searchIndexProvider.generateSearchIndex(info || '', delay);
      this.activeWithRetry(() => {
        this.activeAllFn(info, activeConfig);
      });
      void this.cloudflareCacheProvider.purgeByTagsAndUrls(
        [
          'html-public',
          'html-post',
          'html-listing',
          'public-api',
          'artifact:feed',
          'artifact:sitemap',
          'artifact:search-index',
        ],
        this.getArtifactUrls(),
        info || 'full-site-refresh',
      );
    }, 1000);
  }

  async testConn() {
    try {
      await axios.get(encodeURI(this.base + '/'), this.getIsrRequestConfig());
      return true;
    } catch {
      return false;
    }
  }
  async activeWithRetry(fn: any, info?: string) {
    const max = 6;
    const delay = 3000;
    let succ = false;
    for (let t = 0; t < max; t++) {
      const r = await this.testConn();
      if (t > 0) {
        this.logger.warn(`第${t}次重试触发增量渲染！来源：${info || '首次启动触发全量渲染！'}`);
      }
      if (r) {
        fn(info);
        succ = true;
        break;
      } else {
        // 延迟
        await sleep(delay);
      }
    }
    if (!succ) {
      this.logger.error(`达到最大增量渲染重试次数！来源：${info || '首次启动触发全量渲染！'}`);
    }
  }
  async activeUrls(urls: string[], log: boolean) {
    for (const each of [...new Set(urls.filter(Boolean))]) {
      await this.activeUrl(each, log);
    }
  }

  private isListingVisible(article?: Article) {
    return Boolean(article && !article.deleted && !article.hidden);
  }

  private sameTagSet(left?: string[], right?: string[]) {
    const leftTags = [...new Set((left || []).filter(Boolean))].sort();
    const rightTags = [...new Set((right || []).filter(Boolean))].sort();
    return leftTags.join('||') === rightTags.join('||');
  }

  private didPaginationShapeChange(beforeObj?: Article, article?: Article) {
    if (!beforeObj || !article) {
      return true;
    }

    return (
      beforeObj.top !== article.top ||
      beforeObj.hidden !== article.hidden ||
      beforeObj.deleted !== article.deleted ||
      new Date(beforeObj.createdAt).getTime() !== new Date(article.createdAt).getTime()
    );
  }

  private didListingContentChange(beforeObj?: Article, article?: Article) {
    if (!beforeObj || !article) {
      return true;
    }

    return (
      beforeObj.title !== article.title ||
      beforeObj.content !== article.content ||
      beforeObj.category !== article.category ||
      beforeObj.pathname !== article.pathname ||
      !this.sameTagSet(beforeObj.tags, article.tags)
    );
  }

  private didSummaryShapeChange(
    event: 'create' | 'delete' | 'update',
    beforeObj?: Article,
    article?: Article,
  ) {
    if (event !== 'update') {
      return true;
    }
    if (!beforeObj || !article) {
      return true;
    }

    return (
      beforeObj.category !== article.category ||
      !this.sameTagSet(beforeObj.tags, article.tags) ||
      this.didPaginationShapeChange(beforeObj, article)
    );
  }

  private async getListingPageUrl(
    articleId: number,
    option: Record<string, any>,
    firstPagePath: string,
    pageBasePath: string,
  ) {
    const pageSize = await this.sitemapProvider.getHomePageSize();
    const { articles } = await this.articleProvider.getByOption(
      {
        page: 1,
        pageSize: -1,
        regMatch: false,
        toListView: true,
        ...option,
      },
      true,
    );
    const index = articles.findIndex((item) => item.id === articleId);
    if (index === -1) {
      return null;
    }
    const pageNum = Math.floor(index / pageSize) + 1;
    return pageNum === 1 ? firstPagePath : `${pageBasePath}/${pageNum}`;
  }

  private async getTagListingUrls(article: Article) {
    const urls: string[] = [];
    for (const each of article.tags || []) {
      const encodedTag = encodeQuerystring(each);
      const pageUrl = await this.getListingPageUrl(
        article.id,
        { tags: each },
        `/tag/${encodedTag}`,
        `/tag/${encodedTag}/page`,
      );
      if (pageUrl) {
        urls.push(pageUrl);
      }
    }
    return urls;
  }

  private async getCategoryListingUrl(article: Article) {
    const encodedCategory = encodeQuerystring(article.category);
    return await this.getListingPageUrl(
      article.id,
      { category: article.category },
      `/category/${encodedCategory}`,
      `/category/${encodedCategory}/page`,
    );
  }

  private getArchiveYear(article?: Article) {
    if (!article?.createdAt) {
      return null;
    }
    return String(new Date(article.createdAt).getFullYear());
  }

  private getArchiveMonth(article?: Article) {
    if (!article?.createdAt) {
      return null;
    }
    return String(new Date(article.createdAt).getMonth() + 1).padStart(2, '0');
  }

  private getArchiveMonthKey(article?: Article) {
    const year = this.getArchiveYear(article);
    const month = this.getArchiveMonth(article);
    if (!year || !month) {
      return null;
    }
    return `${year}-${month}`;
  }

  private getGlobalArchiveUrls(article?: Article) {
    const year = this.getArchiveYear(article);
    const month = this.getArchiveMonth(article);
    if (!year || !month) {
      return [];
    }
    return [`/archive/${year}`, `/archive/${year}/${month}`];
  }

  private getCategoryArchiveUrls(article?: Article) {
    if (!article?.category) {
      return [];
    }
    const year = this.getArchiveYear(article);
    const month = this.getArchiveMonth(article);
    const encodedCategory = encodeQuerystring(article.category);
    const urls = [`/category/${encodedCategory}`];
    if (year) {
      urls.push(`/category/${encodedCategory}/archive/${year}`);
    }
    if (year && month) {
      urls.push(`/category/${encodedCategory}/archive/${year}/${month}`);
    }
    return urls;
  }

  private getTagArchiveUrls(article?: Article) {
    const year = this.getArchiveYear(article);
    const month = this.getArchiveMonth(article);
    const urls: string[] = [];

    for (const tag of article?.tags || []) {
      const encodedTag = encodeQuerystring(tag);
      urls.push(`/tag/${encodedTag}`);
      if (year) {
        urls.push(`/tag/${encodedTag}/archive/${year}`);
      }
      if (year && month) {
        urls.push(`/tag/${encodedTag}/archive/${year}/${month}`);
      }
    }

    return urls;
  }

  private async purgeArticleChange(
    event: 'create' | 'delete' | 'update',
    article: Article,
    beforeObj?: Article,
    htmlUrls: string[] = [],
    summaryShapeChanged: boolean = true,
    listingContentChanged: boolean = true,
  ) {
    const cacheTags = new Set<string>([
      'article-shell',
      'article-nav',
      'article-engagement',
      'article-fragments',
      'article-ranking',
      'article-listing',
      'archive-summary',
      'site-stats',
      'artifact:feed',
      'artifact:sitemap',
      'artifact:search-index',
      toCacheTag('post', article.id),
      toCacheTag('post', article.pathname),
      toCacheTag('archive-year', this.getArchiveYear(article)),
      toCacheTag('archive-month', this.getArchiveMonthKey(article)),
      toCacheTag('category', article.category),
      toCacheTag('timeline', new Date(article.createdAt).getFullYear()),
    ]);

    for (const tag of article.tags || []) {
      cacheTags.add(toCacheTag('tag', tag));
    }
    if (beforeObj?.pathname) {
      cacheTags.add(toCacheTag('post', beforeObj.pathname));
    }
    if (beforeObj?.category) {
      cacheTags.add(toCacheTag('category', beforeObj.category));
      cacheTags.add(toCacheTag('category-archive-summary', beforeObj.category));
    }
    if (beforeObj?.createdAt) {
      cacheTags.add(toCacheTag('timeline', new Date(beforeObj.createdAt).getFullYear()));
      cacheTags.add(toCacheTag('archive-year', this.getArchiveYear(beforeObj)));
      cacheTags.add(toCacheTag('archive-month', this.getArchiveMonthKey(beforeObj)));
    }
    for (const tag of beforeObj?.tags || []) {
      cacheTags.add(toCacheTag('tag', tag));
    }
    if (article.category) {
      cacheTags.add(toCacheTag('category-archive-summary', article.category));
      cacheTags.add(
        toCacheTag(
          'category-archive-month',
          `${article.category}-${this.getArchiveMonthKey(article)}`,
        ),
      );
    }
    for (const tag of article.tags || []) {
      cacheTags.add(toCacheTag('tag-archive-summary', tag));
      cacheTags.add(toCacheTag('tag-archive-month', `${tag}-${this.getArchiveMonthKey(article)}`));
    }
    if (beforeObj?.category) {
      cacheTags.add(
        toCacheTag(
          'category-archive-month',
          `${beforeObj.category}-${this.getArchiveMonthKey(beforeObj)}`,
        ),
      );
    }
    for (const tag of beforeObj?.tags || []) {
      cacheTags.add(toCacheTag('tag-archive-summary', tag));
      cacheTags.add(
        toCacheTag('tag-archive-month', `${tag}-${this.getArchiveMonthKey(beforeObj)}`),
      );
    }
    if (summaryShapeChanged) {
      cacheTags.add('category-summary');
      cacheTags.add('timeline-summary');
      cacheTags.add('tag-hot');
      cacheTags.add('tag-list');
    }
    if (summaryShapeChanged || (listingContentChanged && this.isListingVisible(article))) {
      cacheTags.add('category-list');
      cacheTags.add('timeline-list');
    }

    const tags = [...cacheTags];

    if (beforeObj?.pathname && beforeObj.pathname !== article.pathname) {
      htmlUrls.push(`/post/${beforeObj.pathname}`);
    }

    htmlUrls.push(...this.getArtifactUrls());

    await this.cloudflareCacheProvider.purgeByTagsAndUrls(
      tags,
      [...new Set(htmlUrls.filter(Boolean))],
      `article-${event}-${article.id}`,
    );
  }
  async activePath(type: 'archive' | 'category' | 'tag' | 'post', postId?: number) {
    switch (type) {
      case 'archive':
        const archiveUrls = await this.sitemapProvider.getArchiveSummaryUrls();
        await this.activeUrls(archiveUrls, false);
        break;
      case 'category':
        const categoryArchiveUrls = await this.sitemapProvider.getCategoryArchiveUrls();
        await this.activeUrls(categoryArchiveUrls, false);
        break;
      case 'tag':
        const tagArchiveUrls = await this.sitemapProvider.getTagArchiveUrls();
        await this.activeUrls(tagArchiveUrls, false);
        break;
      case 'post':
        const articleUrls = await this.getArticleUrls();
        if (postId) {
          const urlsWithoutThisId = articleUrls.filter((u) => u !== `/post/${postId}`);
          await this.activeUrls([`/post/${postId}`, ...urlsWithoutThisId], false);
        } else {
          await this.activeUrls(articleUrls, false);
        }
        break;
    }
  }

  // 修改文章牵扯太多，暂时不用这个方法。
  async activeArticleById(id: number, event: 'create' | 'delete' | 'update', beforeObj?: Article) {
    await this.publicDataCacheProvider.clearArticleRelatedData();
    let article;

    if (event === 'delete' && beforeObj) {
      // 删除事件时使用删除前的文章信息，避免查询已删除的文章
      article = beforeObj;
    } else {
      // 创建和更新事件需要兼容隐藏/私密文章，不能走只允许公开访问的查询逻辑
      article = await this.articleProvider.getById(id, 'list');
    }

    const htmlUrls = [`/post/${id}`];
    this.activeUrl(`/post/${id}`, true);

    if (article.pathname) {
      htmlUrls.push(`/post/${article.pathname}`);
      this.activeUrl(`/post/${article.pathname}`, true);
    }

    if (event == 'update' && beforeObj) {
      const oldPathname = beforeObj.pathname;
      const newPathname = article.pathname;
      if (oldPathname && oldPathname !== newPathname) {
        this.logger.log(`检测到 pathname 变化：${oldPathname} -> ${newPathname}，触发旧路径失效`);
        this.activeUrl(`/post/${oldPathname}`, true);
        htmlUrls.push(`/post/${oldPathname}`);
      }
    }

    const summaryShapeChanged = this.didSummaryShapeChange(event, beforeObj, article);
    const paginationShapeChanged =
      event !== 'update' || this.didPaginationShapeChange(beforeObj, article);
    const listingContentChanged =
      event !== 'update' || this.didListingContentChange(beforeObj, article);

    const affectedUrls = new Set<string>(['/archive']);
    const pushAffectedUrls = (urls: string[]) => {
      for (const url of urls || []) {
        if (url) {
          affectedUrls.add(url);
        }
      }
    };

    pushAffectedUrls(this.getGlobalArchiveUrls(article));
    pushAffectedUrls(this.getGlobalArchiveUrls(beforeObj));

    if (summaryShapeChanged || listingContentChanged) {
      pushAffectedUrls(this.getCategoryArchiveUrls(article));
      pushAffectedUrls(this.getCategoryArchiveUrls(beforeObj));
      pushAffectedUrls(this.getTagArchiveUrls(article));
      pushAffectedUrls(this.getTagArchiveUrls(beforeObj));
    }

    if (summaryShapeChanged) {
      affectedUrls.add('/timeline');
      affectedUrls.add('/tag');
      affectedUrls.add('/category');
    }

    const targetedArchiveUrls = [...affectedUrls];
    if (targetedArchiveUrls.length) {
      await this.activeUrls(targetedArchiveUrls, false);
      htmlUrls.push(...targetedArchiveUrls);
    }

    this.searchIndexProvider.generateSearchIndex(`文章 ${event} 触发搜索索引更新`, 1000);
    this.rssProvider.generateRssFeed(`文章 ${event} 触发 RSS 更新`, 1000);
    this.sitemapProvider.generateSiteMap(`文章 ${event} 触发 SiteMap 更新`, 1000);

    if (paginationShapeChanged) {
      this.activeUrl(`/`, true);
      this.logger.log('触发首页增量渲染！');
      htmlUrls.push('/');
    } else if (listingContentChanged && this.isListingVisible(article)) {
      const homePageUrl = await this.getListingPageUrl(article.id, {}, '/', '/page');
      if (homePageUrl === '/') {
        await this.activeUrl('/', true);
        htmlUrls.push('/');
      }
    }

    await this.purgeArticleChange(
      event,
      article,
      beforeObj,
      htmlUrls,
      summaryShapeChanged,
      listingContentChanged,
    );
  }

  async activeAbout(info: string) {
    await this.publicDataCacheProvider.clearMetaData();
    this.activeWithRetry(() => {
      this.logger.log(info);
      this.activeUrl(`/about`, false);
    }, info);
    await this.cloudflareCacheProvider.purgeByTagsAndUrls(
      ['public-meta'],
      ['/about'],
      'about-page-update',
    );
  }
  async activeLink(info: string) {
    await this.publicDataCacheProvider.clearMetaData();
    this.activeWithRetry(() => {
      this.logger.log(info);
      this.activeUrl(`/link`, false);
    }, info);
    await this.cloudflareCacheProvider.purgeByTagsAndUrls(
      ['public-meta'],
      ['/link'],
      'link-page-update',
    );
  }

  async activeUrl(url: string, log: boolean) {
    try {
      await axios.get(encodeURI(this.base + url), this.getIsrRequestConfig());
      if (log) {
        this.logger.log(`触发增量渲染成功！ ${url}`);
      }
    } catch (err) {
      // console.log(err);
      this.logger.error(`触发增量渲染失败！ ${url}`);
    }
  }

  async getArticleUrls() {
    const articles = await this.articleProvider.getAll('list', true, true);
    return articles.map((a) => {
      return `/post/${a.pathname || a.id}`;
    });
  }
}
