import { Body, Controller, Get, Logger, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SortOrder } from 'src/types/sort';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { CategoryProvider } from 'src/provider/category/category.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { TagProvider } from 'src/provider/tag/tag.provider';
import { VisitProvider } from 'src/provider/visit/visit.provider';
import { version } from 'src/utils/loadConfig';
import { CustomPageProvider } from 'src/provider/customPage/customPage.provider';
import { encode } from 'js-base64';
import { TokenProvider } from 'src/provider/token/token.provider';
import { IconProvider } from 'src/provider/icon/icon.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { CacheProvider } from 'src/provider/cache/cache.provider';
import { SearchIndexProvider } from 'src/provider/search-index/search-index.provider';
import { WalineProvider } from 'src/provider/waline/waline.provider';
import { normalizeCustomPageRoutePath } from 'src/utils/customPagePath';

@ApiTags('public')
@Controller('/api/public/')
export class PublicController {
  private readonly logger = new Logger(PublicController.name);
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly tagProvider: TagProvider,
    private readonly metaProvider: MetaProvider,
    private readonly visitProvider: VisitProvider,
    private readonly settingProvider: SettingProvider,
    private readonly customPageProvider: CustomPageProvider,
    private readonly tokenProvider: TokenProvider,
    private readonly iconProvider: IconProvider,
    private readonly staticProvider: StaticProvider,
    private readonly cacheProvider: CacheProvider,
    private readonly searchIndexProvider: SearchIndexProvider,
    private readonly walineProvider: WalineProvider,
  ) {}

  private async getCachedPublicPayload<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ) {
    const cached = await this.cacheProvider.get(key);
    if (cached) {
      return cached as T;
    }
    const data = await loader();
    await this.cacheProvider.set(key, data, ttlSeconds);
    return data;
  }

  private toArticleShell(article: Record<string, any> | null | undefined) {
    if (!article) {
      return article;
    }

    const payload = { ...(article as any) };
    for (const key of [
      'viewer',
      'visited',
      'lastVisitedTime',
      'commentCount',
      'commentNum',
      'likeCount',
      'likeNum',
      'liked',
      'likes',
      'comments',
    ]) {
      delete payload[key];
    }
    return payload;
  }

  private setLastModified(
    res: Response | undefined,
    ...candidates: Array<string | Date | number | null | undefined>
  ) {
    if (!res) {
      return;
    }

    const latest = candidates
      .map((candidate) => new Date(candidate as any).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((left, right) => right - left)[0];

    if (latest) {
      res.setHeader('Last-Modified', new Date(latest).toUTCString());
    }
  }

  private getLatestTimestampCandidate(
    ...candidates: Array<string | Date | number | null | undefined>
  ) {
    const latest = candidates
      .map((candidate) => ({
        raw: candidate,
        value: new Date(candidate as any).getTime(),
      }))
      .filter((item) => !Number.isNaN(item.value))
      .sort((left, right) => right.value - left.value)[0];

    return latest?.raw;
  }

  private normalizePositiveInt(value: string | number | undefined, fallback: number, max: number) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  private unwrapCachedPayload<T>(
    res: Response | undefined,
    payload:
      | T
      | {
          data: T;
          __lastModified?: string | Date | number;
        },
  ) {
    if (
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      Object.prototype.hasOwnProperty.call(payload, 'data')
    ) {
      const envelope = payload as {
        data: T;
        __lastModified?: string | Date | number;
      };
      this.setLastModified(res, envelope.__lastModified);
      return envelope.data;
    }

    return payload as T;
  }

  private getArchiveSummaryLastModified(summary: { latestTimestamp?: string | null }) {
    return summary?.latestTimestamp || null;
  }

  @Get('/customPage/all')
  async getAll(@Res({ passthrough: true }) res?: Response) {
    const data = await this.getCachedPublicPayload('public:customPage:all', 300, async () =>
      this.customPageProvider.getAll(),
    );
    const latestPage = (data || []).reduce((latest: any, page: any) => {
      if (!latest) {
        return page;
      }
      return new Date(page?.updatedAt || page?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? page
        : latest;
    }, null);
    this.setLastModified(res, latestPage?.updatedAt, latestPage?.createdAt);
    return {
      statusCode: 200,
      data,
    };
  }
  @Get('/customPage')
  async getOneByPath(@Query('path') path: string, @Res({ passthrough: true }) res?: Response) {
    const normalizedPath = normalizeCustomPageRoutePath(path);
    const data = await this.getCachedPublicPayload(
      `public:customPage:${normalizedPath}`,
      300,
      async () =>
      this.customPageProvider.getCustomPageByPath(path),
    );
    this.setLastModified(res, data?.updatedAt, data?.createdAt);

    return {
      statusCode: 200,
      data: {
        ...data,
        html: data?.html ? encode(data?.html) : '',
      },
    };
  }
  @Get('/article/:id')
  async getArticleByIdOrPathname(
    @Param('id') id: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const article = await this.articleProvider.getPublicArticleByIdOrPathname(id, 'public');
    this.setLastModified(res, article?.updatedAt, article?.createdAt);
    return {
      statusCode: 200,
      data: {
        article: this.toArticleShell(article as any),
      },
    };
  }

  @Get('/article/:id/nav')
  async getArticleNavByIdOrPathname(
    @Param('id') id: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.articleProvider.getArticleNavByIdOrPathname(id, 'public');
    this.setLastModified(res, data?.pre?.updatedAt, data?.next?.updatedAt);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/article/:id/engagement')
  async getArticleEngagement(@Param('id') id: string, @Res({ passthrough: true }) res?: Response) {
    const cacheKey = `public:article:engagement:${id}`;
    const payload = await this.getCachedPublicPayload(cacheKey, 60, async () => {
      const article = await this.articleProvider.getPublicArticleByIdOrPathname(id, 'list');
      const articlePath = `/post/${article.pathname || article.id}`;
      const [viewer, commentCount] = await Promise.all([
        this.visitProvider.getByArticleId(article.id),
        this.walineProvider.getCommentCount(articlePath),
      ]);

      return {
        __lastModified: this.getLatestTimestampCandidate(
          viewer?.lastVisitedTime,
          viewer?.updatedAt,
          viewer?.createdAt,
          article?.updatedAt,
          article?.createdAt,
        ),
        data: {
          viewer: Number(viewer?.viewer || 0),
          visited: Number(viewer?.visited || 0),
          commentCount: Number(commentCount || 0),
        },
      };
    });
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/article/:id/fragments')
  async getArticleFragments(
    @Param('id') id: string,
    @Query('limit') limit: string = '4',
    @Res({ passthrough: true }) res?: Response,
  ) {
    const size = Math.min(Math.max(parseInt(limit, 10) || 4, 1), 8);
    const cacheKey = `public:article:fragments:${id}:${size}`;
    const payload = await this.getCachedPublicPayload(cacheKey, 120, async () => {
      const article = await this.articleProvider.getPublicArticleByIdOrPathname(id, 'list');
      const articlePath = `/post/${article.pathname || article.id}`;
      const [related, latest, hot, commentCount] = await Promise.all([
        this.articleProvider.getRelatedPublicArticles(id, size),
        this.articleProvider.getLatestPublicArticles(size, article.id),
        this.articleProvider.getHotPublicArticles(size, article.id),
        this.walineProvider.getCommentCount(articlePath),
      ]);

      return {
        __lastModified: this.getLatestTimestampCandidate(
          article?.updatedAt,
          article?.createdAt,
          ...related.flatMap((item) => [item?.updatedAt, item?.createdAt]),
          ...latest.flatMap((item) => [item?.updatedAt, item?.createdAt]),
          ...hot.flatMap((item) => [item?.updatedAt, item?.createdAt]),
        ),
        data: {
          commentCount,
          related: related.map((item) => this.toArticleShell(item as any)),
          latest: latest.map((item) => this.toArticleShell(item as any)),
          hot: hot.map((item) => this.toArticleShell(item as any)),
        },
      };
    });
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/archive/summary')
  async getArchiveSummary(@Res({ passthrough: true }) res?: Response) {
    const payload = await this.getCachedPublicPayload('public:archive:summary', 300, async () => {
      const summary = await this.articleProvider.getArchiveSummary();
      return {
        __lastModified: this.getArchiveSummaryLastModified(summary),
        data: {
          totalArticles: summary.totalArticles,
          years: summary.years,
        },
      };
    });
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/archive/:year/:month/articles')
  async getArchiveMonthArticles(
    @Param('year') year: string,
    @Param('month') month: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const cacheKey = `public:archive:${year}:${month}`;
    const payload = await this.getCachedPublicPayload(cacheKey, 300, async () => {
      const result = await this.articleProvider.getArchiveMonthArticles(year, month);
      return {
        __lastModified: result.latestTimestamp,
        data: result.articles.map((article: any) => this.toArticleShell(article)),
      };
    });
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }
  @Post('/article/:id')
  async getArticleByIdOrPathnameWithPassword(
    @Param('id') id: number | string,
    @Body() body: { password: string },
  ) {
    const data = await this.articleProvider.getByIdWithPassword(id, body?.password);
    return {
      statusCode: 200,
      data: data,
    };
  }

  @Post('/article/:id/admin')
  async getArticleByIdOrPathnameWithAdminToken(
    @Param('id') id: number | string,
    @Body() body: { token: string },
  ) {
    // 仅允许超管登录会话 token，避免长期 API Token 落到前台公开解锁链
    const isValidToken = await this.tokenProvider.checkSuperAdminSessionToken(body?.token);
    if (!isValidToken) {
      return {
        statusCode: 401,
        data: null,
        message: 'Invalid token',
      };
    }

    // 如果token有效，直接获取文章内容（使用admin视图）
    const data = await this.articleProvider.getByIdOrPathname(id, 'admin');
    if (data) {
      // 移除密码字段，使用类型断言处理mongoose文档
      const articleData = (data as any)?._doc || data;
      return {
        statusCode: 200,
        data: { ...articleData, password: undefined },
      };
    }
    return {
      statusCode: 404,
      data: null,
      message: 'Article not found',
    };
  }

  @Post('/verify-admin-token')
  async verifyAdminToken(@Body() body: { token: string }) {
    const isValidToken = await this.tokenProvider.checkSuperAdminSessionToken(body?.token);
    return {
      statusCode: isValidToken ? 200 : 401,
      data: { valid: isValidToken },
      message: isValidToken ? 'Token is valid' : 'Invalid token',
    };
  }

  @Get('/search')
  async searchArticle(@Query('value') search: string) {
    const data = await this.articleProvider.searchByString(search, false);
    const limited = data.slice(0, 100);

    return {
      statusCode: 200,
      data: {
        total: data.length,
        data: this.articleProvider.toSearchResult(limited),
      },
    };
  }

  @Get('/search/all')
  async searchAllContent(@Query('value') search: string, @Query('limit') limit: string = '20') {
    const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const data = await this.searchIndexProvider.searchContent(search, size);

    return {
      statusCode: 200,
      data: {
        total: data.length,
        data,
      },
    };
  }
  @Post('/viewer')
  async addViewer(
    @Query('isNew') isNew: boolean,
    @Query('isNewByPath') isNewByPath: boolean,
    @Req() req: Request,
  ) {
    const refer = Array.isArray(req.headers.referer) ? req.headers.referer[0] : req.headers.referer;
    if (!refer) {
      this.logger.warn('viewer 统计缺少 referer，已跳过本次记录');
      return {
        statusCode: 200,
        data: null,
      };
    }
    let pathname = '/';
    try {
      pathname = decodeURIComponent(new URL(refer).pathname || '/');
    } catch (err) {
      this.logger.warn(`viewer 统计 referer 非法，已跳过本次记录: ${refer}`);
      return {
        statusCode: 200,
        data: null,
      };
    }
    const data = await this.metaProvider.addViewer(isNew, pathname, isNewByPath);
    return {
      statusCode: 200,
      data: data,
    };
  }

  @Get('/viewer')
  async getViewer(@Res({ passthrough: true }) res?: Response) {
    const [data, meta] = await Promise.all([
      this.metaProvider.getViewer(),
      this.metaProvider.getAll(),
    ]);
    this.setLastModified(res, (meta as any)?.updatedAt);
    return {
      statusCode: 200,
      data: data,
    };
  }

  @Get('/music/setting')
  async getMusicSetting(@Res({ passthrough: true }) res?: Response) {
    const payload = await this.getCachedPublicPayload('public:music:setting', 300, async () =>
      this.settingProvider.getMusicSettingRecord(),
    );
    this.setLastModified(res, (payload as any)?.updatedAt);
    return {
      statusCode: 200,
      data: (payload as any)?.value || payload,
    };
  }

  @Get('/music/list')
  async getMusicList(@Res({ passthrough: true }) res?: Response) {
    const data = await this.getCachedPublicPayload('public:music:list', 300, async () =>
      this.staticProvider.getAll('music', 'public'),
    );
    const latestItem = (data || []).reduce((latest: any, item: any) => {
      if (!latest) {
        return item;
      }
      return new Date(item?.updatedAt || item?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? item
        : latest;
    }, null);
    this.setLastModified(res, latestItem?.updatedAt, latestItem?.createdAt);
    return {
      statusCode: 200,
      data: data,
    };
  }

  @Get('/article/viewer/:id')
  async getViewerByArticleIdOrPathname(
    @Param('id') id: number | string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.visitProvider.getByArticleId(id);
    this.setLastModified(res, data?.lastVisitedTime, data?.createdAt);
    return {
      statusCode: 200,
      data: data,
    };
  }

  @Get('/tag-articles/:name')
  async getArticlesByTagName(
    @Param('name') name: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.tagProvider.getArticlesByTag(name, false);
    const latestArticle = (data || []).reduce((latest: any, article: any) => {
      if (!latest) {
        return article;
      }
      return new Date(article?.updatedAt || article?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? article
        : latest;
    }, null);
    this.setLastModified(res, latestArticle?.updatedAt, latestArticle?.createdAt);
    return {
      statusCode: 200,
      data: this.articleProvider
        .toPublic(data)
        .map((article) => this.toArticleShell(article as any)),
    };
  }
  @Get('article')
  async getByOption(
    @Query('page') page: number,
    @Query('pageSize') pageSize = 5,
    @Query('toListView') toListView = false,
    @Query('withPreviewContent') withPreviewContent = false,
    @Query('regMatch') regMatch = false,
    @Query('withWordCount') withWordCount = false,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('sortTop') sortTop?: SortOrder,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const safePage = this.normalizePositiveInt(page as any, 1, 10_000);
    const safePageSize = this.normalizePositiveInt(pageSize as any, 5, 100);
    const option = {
      page: safePage,
      pageSize: safePageSize,
      category,
      tags,
      toListView,
      withPreviewContent,
      regMatch,
      sortTop,
      sortCreatedAt,
      withWordCount,
    };
    // 三个 sort 是完全排他的。
    const data = await this.articleProvider.getByOption(option, true);
    const articles = Array.isArray(data?.articles)
      ? data.articles.map((article: any) => this.toArticleShell(article))
      : [];
    const latestArticle = (data?.articles || []).reduce((latest: any, article: any) => {
      if (!latest) {
        return article;
      }
      return new Date(article?.updatedAt || article?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? article
        : latest;
    }, null);
    this.setLastModified(res, latestArticle?.updatedAt, latestArticle?.createdAt);
    return {
      statusCode: 200,
      data: {
        ...data,
        articles,
      },
    };
  }
  @Get('timeline/summary')
  async getTimeLineSummary(@Res({ passthrough: true }) res?: Response) {
    const [data, articles] = await Promise.all([
      this.getCachedPublicPayload('public:timeline:summary', 300, async () =>
        this.articleProvider.getTimeLineSummary(),
      ),
      this.articleProvider.getAll('list', false, false),
    ]);
    const latestArticle = (articles || []).reduce((latest: any, article: any) => {
      if (!latest) {
        return article;
      }
      return new Date(article?.updatedAt || article?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? article
        : latest;
    }, null);
    this.setLastModified(res, latestArticle?.updatedAt, latestArticle?.createdAt);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('timeline/:year/articles')
  async getTimeLineArticlesByYear(
    @Param('year') year: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.getCachedPublicPayload(`public:timeline:${year}`, 300, async () =>
      this.articleProvider.getTimeLineArticlesByYear(year),
    );
    const latestArticle = (data || []).reduce((latest: any, article: any) => {
      if (!latest) {
        return article;
      }
      return new Date(article?.updatedAt || article?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? article
        : latest;
    }, null);
    this.setLastModified(res, latestArticle?.updatedAt, latestArticle?.createdAt);
    return {
      statusCode: 200,
      data: (data || []).map((article: any) => this.toArticleShell(article)),
    };
  }

  @Get('timeline')
  async getTimeLineInfo(@Res({ passthrough: true }) res?: Response) {
    const data = await this.getCachedPublicPayload('public:timeline', 300, async () =>
      this.articleProvider.getTimeLineInfo(),
    );
    const latestArticle = (Object.values(data || {}) as any[])
      .flat()
      .reduce((latest: any, article: any) => {
        if (!latest) {
          return article;
        }
        return new Date(article?.updatedAt || article?.createdAt).getTime() >
          new Date(latest?.updatedAt || latest?.createdAt).getTime()
          ? article
          : latest;
      }, null);
    this.setLastModified(res, latestArticle?.updatedAt, latestArticle?.createdAt);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('category/summary')
  async getCategorySummary(@Res({ passthrough: true }) res?: Response) {
    const [data, categories] = await Promise.all([
      this.getCachedPublicPayload('public:category:summary', 300, async () =>
        this.categoryProvider.getCategorySummaries(false),
      ),
      this.categoryProvider.getAllCategories(true),
    ]);
    const categoryList = Array.isArray(categories) ? categories : [];
    const latestCategory = categoryList.reduce((latest: any, category: any) => {
      if (!latest) {
        return category;
      }
      return new Date(category?.updatedAt || category?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? category
        : latest;
    }, null);
    this.setLastModified(res, latestCategory?.updatedAt, latestCategory?.createdAt);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('category/:name/archive/summary')
  async getCategoryArchiveSummary(
    @Param('name') name: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const categoryName = decodeURIComponent(name);
    const payload = await this.getCachedPublicPayload(
      `public:category:archive:summary:${categoryName}`,
      300,
      async () => {
        const summary = await this.articleProvider.getArchiveSummary({
          category: categoryName,
        });
        return {
          __lastModified: this.getArchiveSummaryLastModified(summary),
          data: {
            totalArticles: summary.totalArticles,
            years: summary.years,
          },
        };
      },
    );
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }

  @Get('category/:name/archive/:year/:month/articles')
  async getCategoryArchiveMonthArticles(
    @Param('name') name: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const categoryName = decodeURIComponent(name);
    const payload = await this.getCachedPublicPayload(
      `public:category:archive:${categoryName}:${year}:${month}`,
      300,
      async () => {
        const result = await this.articleProvider.getArchiveMonthArticles(year, month, {
          category: categoryName,
        });
        return {
          __lastModified: result.latestTimestamp,
          data: result.articles.map((article: any) => this.toArticleShell(article)),
        };
      },
    );
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }

  @Get('category/:name/articles')
  async getArticlesByCategoryName(
    @Param('name') name: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.categoryProvider.getArticlesByCategory(decodeURIComponent(name), false);
    const latestArticle = (data || []).reduce((latest: any, article: any) => {
      if (!latest) {
        return article;
      }
      return new Date(article?.updatedAt || article?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? article
        : latest;
    }, null);
    this.setLastModified(res, latestArticle?.updatedAt, latestArticle?.createdAt);
    return {
      statusCode: 200,
      data: (data || []).map((article: any) => this.toArticleShell(article)),
    };
  }

  @Get('category')
  async getArticlesByCategory(@Res({ passthrough: true }) res?: Response) {
    const data = await this.categoryProvider.getCategoriesWithArticle(false);
    const latestArticle = (Object.values(data || {}) as any[])
      .flat()
      .reduce((latest: any, article: any) => {
        if (!latest) {
          return article;
        }
        return new Date(article?.updatedAt || article?.createdAt).getTime() >
          new Date(latest?.updatedAt || latest?.createdAt).getTime()
          ? article
          : latest;
      }, null);
    this.setLastModified(res, latestArticle?.updatedAt, latestArticle?.createdAt);
    return {
      statusCode: 200,
      data,
    };
  }
  @Get('tags/hot')
  @ApiOperation({ summary: '获取热门标签' })
  async getHotTags(
    @Query('limit') limit: string = '20',
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.tagProvider.getHotTags(this.normalizePositiveInt(limit, 20, 50));
    const latestTag = (data || []).reduce((latest: any, tag: any) => {
      if (!latest) {
        return tag;
      }
      return new Date(tag?.updatedAt || tag?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? tag
        : latest;
    }, null);
    this.setLastModified(res, latestTag?.updatedAt, latestTag?.createdAt);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('tags/paginated')
  @ApiOperation({ summary: '分页获取标签列表（公共API）' })
  async getTagsPaginated(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '50',
    @Query('sortBy') sortBy: 'name' | 'articleCount' | 'createdAt' | 'updatedAt' = 'articleCount',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('search') search?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const safePage = this.normalizePositiveInt(page, 1, 10_000);
    const safePageSize = this.normalizePositiveInt(pageSize, 50, 100);
    const data = await this.tagProvider.getTagsPaginated(
      safePage,
      safePageSize,
      sortBy,
      sortOrder,
      search,
    );
    const latestTag = (data?.tags || []).reduce((latest: any, tag: any) => {
      if (!latest) {
        return tag;
      }
      return new Date(tag?.updatedAt || tag?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? tag
        : latest;
    }, null);
    this.setLastModified(res, latestTag?.updatedAt, latestTag?.createdAt);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('tags/all')
  async getArticlesByTag(@Res({ passthrough: true }) res?: Response) {
    const [data, records] = await Promise.all([
      this.tagProvider.getTagsWithArticle(false),
      this.tagProvider.getAllTagRecords(),
    ]);
    const latestTag = (records || []).reduce((latest: any, tag: any) => {
      if (!latest) {
        return tag;
      }
      return new Date(tag?.updatedAt || tag?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? tag
        : latest;
    }, null);
    this.setLastModified(res, latestTag?.updatedAt, latestTag?.createdAt);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('tag/:name/archive/summary')
  async getTagArchiveSummary(
    @Param('name') name: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const tagName = decodeURIComponent(name);
    const payload = await this.getCachedPublicPayload(
      `public:tag:archive:summary:${tagName}`,
      300,
      async () => {
        const summary = await this.articleProvider.getArchiveSummary({
          tag: tagName,
        });
        return {
          __lastModified: this.getArchiveSummaryLastModified(summary),
          data: {
            totalArticles: summary.totalArticles,
            years: summary.years,
          },
        };
      },
    );
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }

  @Get('tag/:name/archive/:year/:month/articles')
  async getTagArchiveMonthArticles(
    @Param('name') name: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const tagName = decodeURIComponent(name);
    const payload = await this.getCachedPublicPayload(
      `public:tag:archive:${tagName}:${year}:${month}`,
      300,
      async () => {
        const result = await this.articleProvider.getArchiveMonthArticles(year, month, {
          tag: tagName,
        });
        return {
          __lastModified: result.latestTimestamp,
          data: result.articles.map((article: any) => this.toArticleShell(article)),
        };
      },
    );
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/meta')
  async getBuildMeta(@Res({ passthrough: true }) res?: Response) {
    const cacheKey = 'public:meta';
    const cached = await this.cacheProvider.get(cacheKey);
    if (cached) {
      this.setLastModified(
        res,
        (cached as any)?.meta?.updatedAt,
        (cached as any)?.meta?.about?.updatedAt,
        (cached as any)?.meta?.siteInfo?.updatedAt,
      );
      return {
        statusCode: 200,
        data: cached,
      };
    }

    const [
      tags,
      meta,
      categories,
      menuSetting,
      totalArticles,
      totalWordCount,
      layoutSetting,
      socialsWithIcons,
    ] = await Promise.all([
      this.tagProvider.getAllTags(false),
      this.metaProvider.getAll(),
      this.categoryProvider.getAllCategories(false),
      this.settingProvider.getMenuSetting(),
      this.articleProvider.getTotalNum(false),
      this.metaProvider.getTotalWords(),
      this.settingProvider.getLayoutSetting(),
      this.metaProvider.getSocials(),
    ]);
    const metaDoc = (meta as any)?._doc || meta;
    const layoutRes = layoutSetting
      ? this.settingProvider.encodeLayoutSetting(layoutSetting)
      : null;

    const data = {
      version: version,
      tags,
      meta: {
        ...metaDoc,
        categories,
        socials: socialsWithIcons,
      },
      menus: menuSetting?.data || [],
      totalArticles,
      totalWordCount,
      ...(layoutRes ? { layout: layoutRes } : {}),
    };
    await this.cacheProvider.set(cacheKey, data, 30);
    this.setLastModified(
      res,
      data?.meta?.updatedAt,
      data?.meta?.about?.updatedAt,
      data?.meta?.siteInfo?.updatedAt,
    );
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/icon')
  async getAllIcons(@Res({ passthrough: true }) res?: Response) {
    const icons = await this.getCachedPublicPayload('public:icon:all', 300, async () =>
      this.iconProvider.getAllIcons(),
    );
    const latestIcon = (icons || []).reduce((latest: any, icon: any) => {
      if (!latest) {
        return icon;
      }
      return new Date(icon?.updatedAt || icon?.createdAt).getTime() >
        new Date(latest?.updatedAt || latest?.createdAt).getTime()
        ? icon
        : latest;
    }, null);
    this.setLastModified(res, latestIcon?.updatedAt, latestIcon?.createdAt);
    return {
      statusCode: 200,
      data: icons,
    };
  }

  @Get('/icon/:name')
  async getIconByName(@Param('name') name: string, @Res({ passthrough: true }) res?: Response) {
    try {
      const icon = await this.getCachedPublicPayload(`public:icon:${name}`, 300, async () =>
        this.iconProvider.getIconByName(name),
      );
      if (!icon) {
        return {
          statusCode: 404,
          message: '图标未找到',
        };
      }
      this.setLastModified(res, (icon as any)?.updatedAt, (icon as any)?.createdAt);
      return {
        statusCode: 200,
        data: icon,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @Get('/site-info')
  async getBasicSiteInfo(@Res({ passthrough: true }) res?: Response) {
    const payload = await this.getCachedPublicPayload('public:site-info', 300, async () => {
      const meta = await this.metaProvider.getAll();
      const siteInfo = (meta as any)?.siteInfo || {};
      return {
        __lastModified: (meta as any)?.updatedAt || siteInfo.updatedAt,
        data: {
          siteName: siteInfo.siteName,
          siteDesc: siteInfo.siteDesc,
          siteLogo: siteInfo.siteLogo,
          favicon: siteInfo.favicon,
          adminLogo: siteInfo.adminLogo || '',
          adminFavicon: siteInfo.adminFavicon || '',
          beianNumber: siteInfo.beianNumber,
          beianUrl: siteInfo.beianUrl,
          gaBeianNumber: siteInfo.gaBeianNumber,
          gaBeianUrl: siteInfo.gaBeianUrl,
          gaBeianLogoUrl: siteInfo.gaBeianLogoUrl,
          since: siteInfo.since,
          baseUrl: siteInfo.baseUrl,
        },
      };
    });
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/site-stats')
  async getSiteStats(@Res({ passthrough: true }) res?: Response) {
    const payload = await this.getCachedPublicPayload('public:site-stats', 300, async () => {
      const [postNum, categoryNames, tagNames, totalWordCount, meta] = await Promise.all([
        this.articleProvider.getTotalNum(false),
        this.categoryProvider.getAllCategories(false),
        this.tagProvider.getAllTags(false),
        this.metaProvider.getTotalWords(),
        this.metaProvider.getAll(),
      ]);

      return {
        __lastModified: this.getLatestTimestampCandidate(
          (meta as any)?.updatedAt,
          (meta as any)?.about?.updatedAt,
        ),
        data: {
          postNum,
          categoryNum: categoryNames.length,
          tagNum: tagNames.length,
          totalWordCount,
        },
      };
    });
    const data = this.unwrapCachedPayload(res, payload);

    return {
      statusCode: 200,
      data,
    };
  }
}
