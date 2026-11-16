import { Injectable, Logger, Optional } from '@nestjs/common';
import { ArticleProvider } from '../article/article.provider';
import { encodeQuerystring, washUrl } from 'src/utils/washUrl';
import { CustomPageProvider } from '../customPage/customPage.provider';
import { CategoryProvider } from '../category/category.provider';
import { TagProvider } from '../tag/tag.provider';
import { MetaProvider } from '../meta/meta.provider';
import { SitemapStream, streamToPromise } from 'sitemap';
import { config } from 'src/config';
import path from 'path';
import { PublicMaskProvider } from '../public-mask/public-mask.provider';
import { recordPublicMaskArtifact, writeFileAtomic } from '../public-mask/public-mask-artifacts';
import { INACTIVE_PUBLIC_MASKER, PublicMasker } from 'src/utils/publicMask';

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

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
    @Optional() private readonly publicMaskProvider?: PublicMaskProvider,
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
      const masker = this.publicMaskProvider
        ? await this.publicMaskProvider.getMasker()
        : INACTIVE_PUBLIC_MASKER;
      const pathnames = await this.toPublicSiteUrls(await this.getSiteUrls(), masker);
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
      const written = streamToPromise(smStream).then((sm) => {
        writeFileAtomic(path.join(config.staticPath, 'sitemap', 'sitemap.xml'), sm);
        recordPublicMaskArtifact(config.staticPath, 'sitemap', masker.version);
      });
      smStream.end();
      await written;
    } catch (err) {
      this.logger.error('生成 SiteMap 失败！');
      this.logger.error(JSON.stringify(err, null, 2));
    }
  }
  /**
   * Rewrites internal site URLs into the ones the public site exposes: article
   * pathnames with masked terms become ids, tag and category names become their
   * masked form (dropped when two names collide), and anything that still carries a
   * masked term is left out. The internal URL list stays raw for ISR.
   */
  async toPublicSiteUrls(urls: string[], masker: PublicMasker) {
    if (!masker.active) {
      return urls;
    }
    const articles = await this.articleProvider.getAll('list', false, false);
    const idByPathname = new Map<string, string>();
    for (const article of articles as any[]) {
      if (article?.pathname) {
        idByPathname.set(String(article.pathname), String(article.id));
      }
    }
    const maskedNameOwners = new Map<string, Set<string>>();
    const trackName = (name: string) => {
      const masked = masker.mask(name);
      maskedNameOwners.set(masked, (maskedNameOwners.get(masked) || new Set()).add(name));
      return masked;
    };

    const rewritten: string[] = [];
    for (const url of urls) {
      const [, section, rawSegment, ...rest] = url.split('/');
      let next: string | null = url;
      if (section === 'post' && rawSegment && masker.hasHit(safeDecode(rawSegment))) {
        const id = idByPathname.get(safeDecode(rawSegment));
        next = id ? `/post/${id}` : null;
      } else if ((section === 'category' || section === 'tag') && rawSegment) {
        const name = safeDecode(rawSegment);
        if (masker.hasHit(name)) {
          const masked = trackName(name);
          next = ['', section, encodeQuerystring(masked), ...rest].join('/');
        } else {
          trackName(name);
        }
      }
      rewritten.push(next);
    }

    const ambiguous = new Set(
      [...maskedNameOwners.entries()]
        .filter(([, owners]) => owners.size > 1)
        .map(([masked]) => masked),
    );
    return Array.from(
      new Set(
        rewritten.filter((url): url is string => {
          if (!url || masker.hasHit(safeDecode(url))) {
            return false;
          }
          const [, section, segment] = url.split('/');
          return !(
            (section === 'category' || section === 'tag') &&
            segment &&
            ambiguous.has(safeDecode(segment))
          );
        }),
      ),
    );
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
