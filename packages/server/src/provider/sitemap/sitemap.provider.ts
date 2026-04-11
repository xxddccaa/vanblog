import { Injectable, Logger } from '@nestjs/common';
import { ArticleProvider } from '../article/article.provider';
import { encodeQuerystring, washUrl } from 'src/utils/washUrl';
import { CustomPageProvider } from '../customPage/customPage.provider';
import { CategoryProvider } from '../category/category.provider';
import { TagProvider } from '../tag/tag.provider';
import { MetaProvider } from '../meta/meta.provider';
import { SitemapStream, streamToPromise } from 'sitemap';
import { config } from 'src/config';
import path from 'path';
import fs from 'fs';

@Injectable()
export class SiteMapProvider {
  logger = new Logger(SiteMapProvider.name);
  timer = null;
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly tagProvider: TagProvider,
    private readonly customPageProvider: CustomPageProvider,
    private readonly metaProvider: MetaProvider,
  ) {}

  async generateSiteMap(info?: string, delay?: number) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(
      () => {
        this.generateSiteMapFn(info);
      },
      delay || 60 * 1000,
    );
  }

  async generateSiteMapFn(info?: string) {
    this.logger.log(info + '重新生成 SiteMap ');
    try {
      const pathnames = await this.getSiteUrls();
      const siteInfo = await this.metaProvider.getSiteInfo();
      const baseUrl = washUrl(siteInfo?.baseUrl || '');
      if (!baseUrl) {
        this.logger.warn('站点 baseUrl 未配置，跳过 SiteMap 生成');
        return;
      }
      const smStream = new SitemapStream({ hostname: baseUrl });
      pathnames.forEach((pathname) => {
        smStream.write({
          url: pathname,
        });
      });
      streamToPromise(smStream).then((sm) => {
        const sitemapPath = path.join(config.staticPath, 'sitemap');

        fs.mkdirSync(sitemapPath, { recursive: true });
        fs.writeFileSync(path.join(sitemapPath, 'sitemap.xml'), sm);
      });
      smStream.end();
    } catch (err) {
      this.logger.error('生成 SiteMap 失败！');
      this.logger.error(JSON.stringify(err, null, 2));
    }
  }
  async getArticleUrls() {
    const articles = await this.articleProvider.getAll('list', false, false);
    return articles.map((a) => {
      return `/post/${a.pathname || a.id}`;
    });
  }
  async getCategoryUrls() {
    const categories = await this.categoryProvider.getAllCategories();
    return categories.map((c) => {
      return `/category/${encodeQuerystring(c)}`;
    });
  }

  async getArchiveSummaryUrls() {
    const summary = await this.articleProvider.getArchiveSummary();
    const urls = ['/archive'];
    for (const year of summary.years || []) {
      urls.push(`/archive/${year.year}`);
      for (const month of year.months || []) {
        urls.push(`/archive/${year.year}/${month.month}`);
      }
    }
    return urls;
  }
  async getCustomUrls() {
    const data = await this.customPageProvider.getAll();
    return data.map((c) => {
      return `/c${c.path}`;
    });
  }
  async getTagUrls() {
    const tags = await this.tagProvider.getAllTags(false);
    return tags.map((c) => {
      return `/tag/${encodeQuerystring(c)}`;
    });
  }

  async getCategoryArchiveUrls(category?: string) {
    const categories: string[] = category
      ? [category]
      : ((await this.categoryProvider.getAllCategories()) as string[]);
    const urls: string[] = [];

    for (const currentCategory of categories) {
      const encodedCategory = encodeQuerystring(currentCategory);
      const summary = await this.articleProvider.getArchiveSummary({
        category: currentCategory,
      });
      urls.push(`/category/${encodedCategory}`);
      for (const year of summary.years || []) {
        urls.push(`/category/${encodedCategory}/archive/${year.year}`);
        for (const month of year.months || []) {
          urls.push(`/category/${encodedCategory}/archive/${year.year}/${month.month}`);
        }
      }
    }

    return urls;
  }

  async getTagArchiveUrls(tag?: string) {
    const tags: string[] = tag ? [tag] : ((await this.tagProvider.getAllTags(false)) as string[]);
    const urls: string[] = [];

    for (const currentTag of tags) {
      const encodedTag = encodeQuerystring(currentTag);
      const summary = await this.articleProvider.getArchiveSummary({
        tag: currentTag,
      });
      urls.push(`/tag/${encodedTag}`);
      for (const year of summary.years || []) {
        urls.push(`/tag/${encodedTag}/archive/${year.year}`);
        for (const month of year.months || []) {
          urls.push(`/tag/${encodedTag}/archive/${year.year}/${month.month}`);
        }
      }
    }

    return urls;
  }

  async getSiteUrls() {
    let urlList = ['/', '/category', '/tag', '/timeline', '/about', '/link'];
    urlList = urlList.concat(await this.getArticleUrls());
    urlList = urlList.concat(await this.getArchiveSummaryUrls());
    urlList = urlList.concat(await this.getCategoryArchiveUrls());
    urlList = urlList.concat(await this.getTagArchiveUrls());
    urlList = urlList.concat(await this.getCustomUrls());
    return urlList;
  }

  async getHomePageSize() {
    const siteInfo = await this.metaProvider.getSiteInfo();
    return siteInfo?.homePageSize || 5;
  }
}
