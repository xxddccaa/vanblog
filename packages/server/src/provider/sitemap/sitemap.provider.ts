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

  async getCategoryPageUrls(category?: string) {
    const categories: string[] = category
      ? [category]
      : ((await this.categoryProvider.getAllCategories()) as string[]);
    const pageSize = await this.getHomePageSize();
    const urls: string[] = [];

    for (const currentCategory of categories) {
      const { total } = await this.articleProvider.getByOption(
        {
          page: 1,
          pageSize,
          category: currentCategory,
          toListView: true,
          regMatch: false,
        },
        true,
      );
      const totalPages = Math.ceil(total / pageSize);
      for (let page = 2; page <= totalPages; page++) {
        urls.push(`/category/${encodeQuerystring(currentCategory)}/page/${page}`);
      }
    }

    return urls;
  }

  async getPageUrls() {
    const num = await this.articleProvider.getTotalNum(false);
    const pageSize = await this.getHomePageSize();
    const total = Math.ceil(num / pageSize);
    const paths = [];
    for (let i = 2; i <= total; i++) {
      paths.push(`/page/${i}`);
    }
    return paths;
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

  async getTagPageUrls(tag?: string) {
    const tags: string[] = tag ? [tag] : ((await this.tagProvider.getAllTags(false)) as string[]);
    const pageSize = await this.getHomePageSize();
    const urls: string[] = [];

    for (const currentTag of tags) {
      const { total } = await this.articleProvider.getByOption(
        {
          page: 1,
          pageSize,
          tags: currentTag,
          toListView: true,
          regMatch: false,
        },
        true,
      );
      const totalPages = Math.ceil(total / pageSize);
      for (let page = 2; page <= totalPages; page++) {
        urls.push(`/tag/${encodeQuerystring(currentTag)}/page/${page}`);
      }
    }

    return urls;
  }

  async getSiteUrls() {
    let urlList = ['/', '/category', '/tag', '/timeline', '/about', '/link'];
    urlList = urlList.concat(await this.getArticleUrls());
    urlList = urlList.concat(await this.getTagUrls());
    urlList = urlList.concat(await this.getTagPageUrls());
    urlList = urlList.concat(await this.getCategoryUrls());
    urlList = urlList.concat(await this.getCategoryPageUrls());
    urlList = urlList.concat(await this.getPageUrls());
    urlList = urlList.concat(await this.getCustomUrls());
    return urlList;
  }

  private async getHomePageSize() {
    const siteInfo = await this.metaProvider.getSiteInfo();
    return siteInfo?.homePageSize || 5;
  }
}
