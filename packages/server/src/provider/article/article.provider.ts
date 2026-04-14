import { Inject, Injectable, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { CreateArticleDto, SearchArticleOption, UpdateArticleDto } from 'src/types/article.dto';
import { Article, ArticleDocument } from 'src/scheme/article.schema';
import { parseImgLinksOfMarkdown } from 'src/utils/parseImgOfMarkdown';
import { wordCount } from 'src/utils/wordCount';
import { MetaProvider } from '../meta/meta.provider';
import { VisitProvider } from '../visit/visit.provider';
import { sleep } from 'src/utils/sleep';
import { CategoryDocument } from 'src/scheme/category.schema';
import { buildArticlePreview } from 'src/utils/articlePreview';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { escapeRegExp } from 'src/utils/escapeRegExp';

export type ArticleView = 'admin' | 'public' | 'list';

export interface ArchiveSummaryMonth {
  month: string;
  articleCount: number;
}

export interface ArchiveSummaryYear {
  year: string;
  articleCount: number;
  months: ArchiveSummaryMonth[];
}

export interface ArchiveSummaryPayload {
  totalArticles: number;
  years: ArchiveSummaryYear[];
  latestTimestamp?: string | null;
}

@Injectable()
export class ArticleProvider {
  idLock = false;
  constructor(
    @InjectModel('Article')
    private articleModel: Model<ArticleDocument>,
    @InjectModel('Category') private categoryModal: Model<CategoryDocument>,
    @Inject(forwardRef(() => MetaProvider))
    private readonly metaProvider: MetaProvider,
    private readonly visitProvider: VisitProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}
  publicView = {
    title: 1,
    content: 1,
    tags: 1,
    category: 1,
    updatedAt: 1,
    createdAt: 1,
    lastVisitedTime: 1,
    id: 1,
    top: 1,
    _id: 0,
    viewer: 1,
    visited: 1,
    private: 1,
    hidden: 1,
    author: 1,
    copyright: 1,
    pathname: 1,
  };

  adminView = {
    title: 1,
    content: 1,
    tags: 1,
    category: 1,
    lastVisitedTime: 1,
    updatedAt: 1,
    createdAt: 1,
    id: 1,
    top: 1,
    hidden: 1,
    password: 1,
    private: 1,
    _id: 0,
    viewer: 1,
    visited: 1,
    author: 1,
    copyright: 1,
    pathname: 1,
  };

  listView = {
    title: 1,
    tags: 1,
    category: 1,
    updatedAt: 1,
    lastVisitedTime: 1,
    createdAt: 1,
    id: 1,
    top: 1,
    hidden: 1,
    private: 1,
    _id: 0,
    viewer: 1,
    visited: 1,
    author: 1,
    copyright: 1,
    pathname: 1,
  };

  overviewView = {
    ...this.listView,
    content: 1,
  };

  toPublic(oldArticles: Article[]) {
    return oldArticles.map((item) => {
      return {
        title: item.title,
        content: item.content,
        tags: item.tags,
        category: item.category,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        id: item.id,
        top: item.top,
      };
    });
  }

  private projectArticleForView(article: any, view: ArticleView) {
    if (!article) {
      return article;
    }
    const payload = { ...(article?._doc || article) };
    if (view === 'list') {
      delete payload.content;
      delete payload.password;
    }
    if (view === 'public') {
      delete payload.password;
    }
    return payload;
  }

  private trimArticleList<T extends { id: number }>(articles: T[], limit: number, excludeId?: number) {
    return articles.filter((article) => article.id !== excludeId).slice(0, limit);
  }

  private async applyPublicPrivacyToArticles(articles: any[]) {
    if (!Array.isArray(articles) || articles.length === 0) {
      return [];
    }

    const categoryNames = [
      ...new Set(
        articles
          .map((article) => article?._doc?.category || article?.category)
          .filter(Boolean),
      ),
    ];
    let categoryDocs = await this.structuredDataService.getCategoriesByNames(categoryNames);
    if (!categoryDocs.length && !this.structuredDataService.isInitialized()) {
      categoryDocs = await this.categoryModal
        .find({ name: { $in: categoryNames } })
        .lean()
        .exec();
    }
    const categoryPrivateMap = new Map(categoryDocs.map((category: any) => [category.name, Boolean(category?.private)]));

    return articles.map((article) => {
      const payload = { ...(article?._doc || article) };
      const isPrivateInArticle = Boolean(payload.private);
      const isPrivateInCategory = Boolean(categoryPrivateMap.get(payload.category));
      delete payload.password;

      if (isPrivateInArticle || isPrivateInCategory) {
        return {
          ...payload,
          content: undefined,
          private: true,
        };
      }

      return payload;
    });
  }

  private matchesSanitizedSearch(article: any, search: string) {
    if (!search) {
      return true;
    }

    const haystacks = [
      article?.title,
      article?.content,
      article?.category,
      ...(Array.isArray(article?.tags) ? article.tags : []),
    ]
      .filter(Boolean)
      .map((item) => String(item).toLocaleLowerCase());

    return haystacks.some((item) => item.includes(search));
  }

  private async getCategoryByName(name?: string) {
    if (!name) {
      return null;
    }
    const category = await this.structuredDataService.getCategoryByName(name);
    if (category || this.structuredDataService.isInitialized()) {
      return category as any;
    }
    return await this.categoryModal.findOne({ name }).lean().exec();
  }

  async create(
    createArticleDto: CreateArticleDto,
    skipUpdateWordCount?: boolean,
    id?: number,
  ): Promise<Article> {
    const createdData = new this.articleModel(createArticleDto);
    const newId = id || (await this.getNewId());
    createdData.id = newId;
    if (!skipUpdateWordCount) {
      this.metaProvider.updateTotalWords('新建文章');
    }
    const res = await createdData.save();
    await this.structuredDataService.upsertArticle(res.toObject());
    return res;
  }
  async searchArticlesByLink(link: string) {
    const normalizedLink = String(link || '').trim().toLowerCase();
    if (!normalizedLink) {
      return [];
    }
    const pgArticles = await this.structuredDataService.listArticles({
      includeHidden: true,
      includeDelete: false,
    });
    if (pgArticles.length || this.structuredDataService.isInitialized()) {
      return pgArticles
        .filter((article) => (article.content || '').toLowerCase().includes(normalizedLink))
        .map((article) => this.projectArticleForView(article, 'list')) as any;
    }
    const safePattern = escapeRegExp(normalizedLink);
    const artciles = await this.articleModel.find(
      {
        content: { $regex: safePattern, $options: 'i' },
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
      this.listView,
    );
    return artciles;
  }
  async getAllImageLinks() {
    const res = [];
    const pgArticles = await this.structuredDataService.listArticles({
      includeHidden: true,
      includeDelete: false,
    });
    const articles =
      pgArticles.length || this.structuredDataService.isInitialized()
        ? (pgArticles as any)
        : await this.articleModel.find({
            $or: [
              {
                deleted: false,
              },
              {
                deleted: { $exists: false },
              },
            ],
          });
    for (const article of articles) {
      const eachLinks = parseImgLinksOfMarkdown(article.content || '');
      res.push({
        articleId: article.id,
        title: article.title,
        links: eachLinks,
      });
    }
    return res;
  }

  async updateViewerByPathname(pathname: string, isNew: boolean) {
    let article = await this.getByPathName(pathname, 'admin');
    if (!article) {
      // 这是通过 id 的吧，检查是否为有效数字
      const numericId = Number(pathname);
      if (!isNaN(numericId)) {
        article = await this.getById(numericId, 'admin');
      }
      if (!article) {
        return;
      }
    }
    const oldViewer = article.viewer || 0;
    const oldVIsited = article.visited || 0;
    const newViewer = oldViewer + 1;
    const newVisited = isNew ? oldVIsited + 1 : oldVIsited;
    const nowTime = new Date();
    await this.articleModel.updateOne(
      { id: article.id },
      { visited: newVisited, viewer: newViewer, lastVisitedTime: nowTime },
    );
    await this.structuredDataService.upsertArticle({
      ...(article?._doc || article),
      visited: newVisited,
      viewer: newViewer,
      lastVisitedTime: nowTime,
    });
  }

  async updateViewer(id: number, isNew: boolean) {
    const article = await this.getById(id, 'admin');
    if (!article) {
      return;
    }
    const oldViewer = article.viewer || 0;
    const oldVIsited = article.visited || 0;
    const newViewer = oldViewer + 1;
    const newVisited = isNew ? oldVIsited + 1 : oldVIsited;
    const nowTime = new Date();
    await this.articleModel.updateOne(
      { id: id },
      { visited: newVisited, viewer: newViewer, lastVisitedTime: nowTime },
    );
    await this.structuredDataService.upsertArticle({
      ...(article?._doc || article),
      visited: newVisited,
      viewer: newViewer,
      lastVisitedTime: nowTime,
    });
  }

  async getRecentVisitedArticles(num: number, view: ArticleView) {
    const articles = await this.structuredDataService.getRecentVisitedArticles(num);
    if (articles.length) {
      return articles.map((article) => this.projectArticleForView(article, view));
    }
    return await this.articleModel
      .find(
        {
          lastVisitedTime: { $exists: true },
          $or: [
            {
              deleted: false,
            },
            {
              deleted: { $exists: false },
            },
          ],
        },
        this.getView(view),
      )
      .sort({ lastVisitedTime: -1 })
      .limit(num);
  }

  async getTopViewer(view: ArticleView, num: number) {
    const articles = await this.structuredDataService.getTopViewerArticles(num);
    if (articles.length) {
      return articles.map((article) => this.projectArticleForView(article, view));
    }
    return await this.articleModel
      .find(
        {
          viewer: { $ne: 0, $exists: true },
          $or: [
            {
              deleted: false,
            },
            {
              deleted: { $exists: false },
            },
          ],
        },
        this.getView(view),
      )
      .sort({ viewer: -1 })
      .limit(num);
  }
  async getTopVisited(view: ArticleView, num: number) {
    const articles = await this.structuredDataService.getTopVisitedArticles(num);
    if (articles.length) {
      return articles.map((article) => this.projectArticleForView(article, view));
    }
    return await this.articleModel
      .find(
        {
          viewer: { $ne: 0, $exists: true },
          $or: [
            {
              deleted: false,
            },
            {
              deleted: { $exists: false },
            },
          ],
        },
        this.getView(view),
      )
      .sort({ visited: -1 })
      .limit(num);
  }

  async washViewerInfoByVisitProvider() {
    // 用 visitProvider 里面的数据洗一下 article 的。
    const articles = await this.getAll('list', true);
    for (const a of articles) {
      const visitData = await this.visitProvider.getByArticleId(a.id);
      if (visitData) {
        const updateDto = {
          viewer: visitData.viewer,
          visited: visitData.visited,
        };
        await this.updateById(a.id, updateDto);
      }
    }
  }

  async washViewerInfoToVisitProvider() {
    // 用 visitProvider 里面的数据洗一下 article 的。
    const articles = await this.getAll('list', true);
    for (const a of articles) {
      await this.visitProvider.rewriteToday(`/post/${a.id}`, a.viewer, a.visited);
    }
  }

  async importArticles(articles: Article[]) {
    // 先获取一遍新的 id
    // for (let i = 0; i < articles.length; i++) {
    //   const newId = await this.getNewId();
    //   articles[i].id = newId;
    // }

    // id 相同就合并，以导入的优先
    for (const a of articles) {
      const { id, ...createDto } = a;
      const oldArticle = await this.getById(id, 'admin');
      if (oldArticle) {
        this.updateById(
          oldArticle.id,
          {
            ...createDto,
            deleted: false,
            updatedAt: oldArticle.updatedAt || oldArticle.createdAt,
          },
          true,
        );
      } else {
        await this.create(
          {
            ...createDto,
            updatedAt: createDto.updatedAt || createDto.createdAt || new Date(),
          },
          true,
          id,
        );
      }
    }
    this.metaProvider.updateTotalWords('导入文章');
  }

  async countTotalWords() {
    //! 默认不保存 hidden 文章的！
    let total = 0;
    const $and: any = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
      {
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      },
    ];
    const articles = await this.articleModel
      .find({
        $and,
      })
      .exec();
    articles.forEach((a) => {
      total = total + wordCount(a?.content);
    });
    return total;
  }
  async getTotalNum(includeHidden: boolean) {
    const total = await this.structuredDataService.getTotalArticles(includeHidden);
    if (total || this.structuredDataService.isInitialized()) {
      return total;
    }
    const $and: any = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }
    return await this.articleModel
      .countDocuments({
        $and,
      });
  }

  getView(view: ArticleView) {
    let thisView: any = this.adminView;
    switch (view) {
      case 'admin':
        thisView = this.adminView;
        break;
      case 'list':
        thisView = this.listView;
        break;
      case 'public':
        thisView = this.publicView;
    }
    return thisView;
  }

  async getAll(
    view: ArticleView,
    includeHidden: boolean,
    includeDelete?: boolean,
  ): Promise<Article[]> {
    const pgArticles = await this.structuredDataService.listArticles({
      includeHidden,
      includeDelete,
    });
    if (pgArticles.length || this.structuredDataService.isInitialized()) {
      return pgArticles.map((article) => this.projectArticleForView(article, view)) as any;
    }
    const thisView: any = this.getView(view);
    const $and: any = [];
    if (!includeDelete) {
      $and.push({
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      });
    }
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }

    const articles = await this.articleModel
      .find(
        $and.length > 0
          ? {
              $and,
            }
          : undefined,
        thisView,
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return articles as any;
  }

  async getLatestPublicArticles(limit: number = 5, excludeId?: number) {
    const { articles } = await this.getByOption(
      {
        page: 1,
        pageSize: Math.max(limit + (excludeId ? 1 : 0), limit),
        regMatch: false,
        toListView: true,
      },
      true,
    );
    return this.trimArticleList(articles, limit, excludeId);
  }

  async getHotPublicArticles(limit: number = 5, excludeId?: number) {
    const { articles } = await this.getByOption(
      {
        page: 1,
        pageSize: Math.max(limit + (excludeId ? 1 : 0), limit),
        regMatch: false,
        toListView: true,
        sortViewer: 'desc',
      },
      true,
    );
    return this.trimArticleList(articles, limit, excludeId);
  }

  async getRelatedPublicArticles(id: string | number, limit: number = 5) {
    const current = await this.getPublicArticleByIdOrPathname(id, 'list');
    const { articles } = await this.getByOption(
      {
        page: 1,
        pageSize: -1,
        regMatch: false,
        toListView: true,
      },
      true,
    );
    const currentTags = new Set(current.tags || []);

    const scored = articles
      .filter((article) => article.id !== current.id)
      .map((article: any) => {
        const articleTags = article.tags || [];
        const overlapCount = articleTags.filter((tag: string) => currentTags.has(tag)).length;
        const categoryScore = article.category === current.category ? 3 : 0;
        const tagScore = overlapCount * 2;
        const viewerScore = Math.min(Number(article.viewer || 0), 500) / 500;
        const totalScore = categoryScore + tagScore + viewerScore;

        return {
          article,
          totalScore,
        };
      })
      .filter((item) => item.totalScore > 0)
      .sort((left, right) => {
        if (right.totalScore !== left.totalScore) {
          return right.totalScore - left.totalScore;
        }
        return new Date(right.article.createdAt).getTime() - new Date(left.article.createdAt).getTime();
      })
      .map((item) => item.article)
      .slice(0, limit);

    if (scored.length >= limit) {
      return scored;
    }

    const fallback = articles.filter((article) => article.id !== current.id);
    return [...scored, ...this.trimArticleList(fallback, limit, current.id).filter((item) => !scored.includes(item))]
      .slice(0, limit);
  }

  async getTimeLineInfo() {
    const grouped = await this.structuredDataService.getTimelineArticlesGrouped(false);
    if (Object.keys(grouped).length || this.structuredDataService.isInitialized()) {
      return Object.fromEntries(
        Object.entries(grouped).map(([year, articles]) => [
          year,
          ((articles as Article[]) || []).map((article) => this.projectArticleForView(article, 'list')),
        ]),
      );
    }

    const articles = await this.getAll('list', false);
    const years = Array.from(new Set(articles.map((a) => a.createdAt.getFullYear()))).sort(
      (a: number, b: number) => b - a,
    );
    const res: Record<string, Article[]> = {};
    years.forEach((year) => {
      res[String(year)] = articles.filter((a) => a.createdAt.getFullYear() === year);
    });
    return res;
  }

  async getTimeLineSummary() {
    const summary = await this.structuredDataService.getTimelineSummary(false);
    if (summary.length || this.structuredDataService.isInitialized()) {
      return summary;
    }

    const articles = await this.getAll('list', false);
    const yearMap = new Map<number, number>();
    articles.forEach((article) => {
      const year = article.createdAt.getFullYear();
      yearMap.set(year, (yearMap.get(year) || 0) + 1);
    });

    return Array.from(yearMap.entries())
      .map(([year, articleCount]) => ({
        year: String(year),
        articleCount,
      }))
      .sort((a, b) => parseInt(b.year, 10) - parseInt(a.year, 10));
  }

  async getTimeLineArticlesByYear(year: string) {
    const numericYear = parseInt(year, 10);
    if (isNaN(numericYear)) {
      return [];
    }

    const start = new Date(numericYear, 0, 1);
    const end = new Date(numericYear + 1, 0, 1);

    const result = await this.structuredDataService.queryArticles(
      {
        page: 1,
        pageSize: -1,
        regMatch: false,
        startTime: start.toISOString(),
        endTime: new Date(end.getTime() - 1).toISOString(),
        toListView: true,
      },
      true,
    );
    if (result.articles.length || this.structuredDataService.isInitialized()) {
      return result.articles.map((article) => this.projectArticleForView(article, 'list')) as any;
    }
    return await this.articleModel
      .find(
        {
          $and: [
            {
              $or: [
                {
                  deleted: false,
                },
                {
                  deleted: { $exists: false },
                },
              ],
            },
            {
              $or: [
                {
                  hidden: false,
                },
                {
                  hidden: { $exists: false },
                },
              ],
            },
            {
              createdAt: {
                $gte: start,
                $lt: end,
              },
            },
          ],
        },
        this.listView,
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async getArchiveSummary(filter?: { category?: string; tag?: string }): Promise<ArchiveSummaryPayload> {
    const summary = await this.structuredDataService.getArchiveSummary(false, filter);
    if (summary.years.length || this.structuredDataService.isInitialized()) {
      return summary;
    }

    const allArticles = await this.getAll('list', false);
    const filteredArticles = allArticles.filter((article) => {
      if (filter?.category && article.category !== filter.category) {
        return false;
      }
      if (filter?.tag && !(article.tags || []).includes(filter.tag)) {
        return false;
      }
      return true;
    });
    const yearMap = new Map<string, ArchiveSummaryYear>();
    let latestTimestamp: string | null = null;

    for (const article of filteredArticles) {
      const createdAt = new Date(article.createdAt);
      const year = String(createdAt.getFullYear());
      const month = String(createdAt.getMonth() + 1).padStart(2, '0');

      if (!yearMap.has(year)) {
        yearMap.set(year, {
          year,
          articleCount: 0,
          months: [],
        });
      }

      const yearEntry = yearMap.get(year);
      yearEntry.articleCount += 1;
      const monthEntry = yearEntry.months.find((item) => item.month === month);
      if (monthEntry) {
        monthEntry.articleCount += 1;
      } else {
        yearEntry.months.push({
          month,
          articleCount: 1,
        });
      }

      const articleTimestamp = new Date(article.updatedAt || article.createdAt).getTime();
      const currentLatest = latestTimestamp ? new Date(latestTimestamp).getTime() : NaN;
      if (!Number.isNaN(articleTimestamp) && (Number.isNaN(currentLatest) || articleTimestamp > currentLatest)) {
        latestTimestamp = new Date(articleTimestamp).toISOString();
      }
    }

    const years = [...yearMap.values()]
      .map((year) => ({
        ...year,
        months: [...year.months].sort((left, right) => parseInt(right.month, 10) - parseInt(left.month, 10)),
      }))
      .sort((left, right) => parseInt(right.year, 10) - parseInt(left.year, 10));

    return {
      totalArticles: filteredArticles.length,
      years,
      latestTimestamp,
    };
  }

  async getArchiveMonthArticles(
    year: string,
    month: string,
    filter?: { category?: string; tag?: string },
  ) {
    const result = await this.structuredDataService.getArchiveMonthArticles(year, month, false, filter);
    if (result.articles.length || this.structuredDataService.isInitialized()) {
      return {
        latestTimestamp: result.latestTimestamp,
        articles: result.articles.map((article: any) => this.projectArticleForView(article, 'list')) as Article[],
      };
    }

    const numericYear = parseInt(year, 10);
    const numericMonth = parseInt(month, 10);
    if (
      Number.isNaN(numericYear) ||
      Number.isNaN(numericMonth) ||
      numericMonth < 1 ||
      numericMonth > 12
    ) {
      return {
        latestTimestamp: null,
        articles: [],
      };
    }

    const allArticles = await this.getAll('list', false);
    const filteredArticles = allArticles
      .filter((article) => {
        const createdAt = new Date(article.createdAt);
        if (
          createdAt.getUTCFullYear() !== numericYear ||
          createdAt.getUTCMonth() + 1 !== numericMonth
        ) {
          return false;
        }
        if (filter?.category && article.category !== filter.category) {
          return false;
        }
        if (filter?.tag && !(article.tags || []).includes(filter.tag)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    const latestTimestamp = filteredArticles
      .map((article) => new Date(article.updatedAt || article.createdAt).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((left, right) => right - left)[0];

    return {
      latestTimestamp: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
      articles: filteredArticles,
    };
  }

  async getPublicSearchIndexArticles(): Promise<Article[]> {
    const { articles } = await this.getByOption(
      {
        page: 1,
        pageSize: -1,
        regMatch: false,
      },
      true,
    );
    return articles;
  }

  async getByOption(
    option: SearchArticleOption,
    isPublic: boolean,
  ): Promise<{ articles: Article[]; total: number; totalWordCount?: number }> {
    const pgResult = await this.structuredDataService.queryArticles(option, isPublic);
    let articles: any[] = pgResult.articles;
    const total = pgResult.total;

    if (!articles.length && !total && !this.structuredDataService.isInitialized()) {
      return await this.getByOptionFallback(option, isPublic);
    }
    // 过滤私有文章
    if (isPublic) {
      const categoryNames = [
        ...new Set(
          articles
            .map((a: any) => a?._doc?.category || a?.category)
            .filter(Boolean),
        ),
      ];
      let categoriesDocs = await this.structuredDataService.getCategoriesByNames(categoryNames);
      if (!categoriesDocs.length && !this.structuredDataService.isInitialized()) {
        categoriesDocs = await this.categoryModal
          .find({ name: { $in: categoryNames } })
          .lean()
          .exec();
      }
      const categoryPrivateMap = new Map(
        categoriesDocs.map((c) => [c.name, c?.private || false]),
      );

      const tmpArticles: any[] = [];
      for (const a of articles) {
        //@ts-ignore
        const isPrivateInArticle = a?._doc?.private || a?.private;
        //@ts-ignore
        const categoryName = a?._doc?.category || a?.category;
        const isPrivateInCategory = categoryPrivateMap.get(categoryName) || false;
        const isPrivate = isPrivateInArticle || isPrivateInCategory;
        if (isPrivate) {
          tmpArticles.push({
            //@ts-ignore
            ...(a?._doc || a),
            content: undefined,
            password: undefined,
            private: true,
          });
        } else {
          tmpArticles.push({
            //@ts-ignore
            ...(a?._doc || a),
          });
        }
      }
      articles = tmpArticles;
    }
    if (option.withPreviewContent && !option.withWordCount) {
      articles = articles.map((article: any) => {
        if (article.private) {
          return {
            ...article,
            content: undefined,
          };
        }

        return {
          ...article,
          content: buildArticlePreview(article.content || ''),
        };
      });
    }
    const resData: any = {};
    if (option.withWordCount) {
      let totalWordCount = 0;
      articles.forEach((a) => {
        totalWordCount = totalWordCount + wordCount(a?.content || '');
      });
      resData.totalWordCount = totalWordCount;
    }
    if (option.withWordCount && option.toListView) {
      // 重置视图
      resData.articles = articles.map((a: any) => ({
        ...(a?._doc || a),
        content: undefined,
        password: undefined,
      }));
    } else if (option.toListView && !option.withPreviewContent) {
      resData.articles = articles.map((article: any) => this.projectArticleForView(article, 'list'));
    } else if (isPublic) {
      resData.articles = articles.map((article: any) => this.projectArticleForView(article, 'public'));
    } else {
      resData.articles = articles;
    }

    resData.total = total;
    return resData;
  }

  private async getByOptionFallback(
    option: SearchArticleOption,
    isPublic: boolean,
  ): Promise<{ articles: Article[]; total: number; totalWordCount?: number }> {
    const query: any = {};
    const $and: any = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];
    const and = [];
    let sort: any = { createdAt: -1 };
    if (isPublic) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }

    if (option.sortTop) {
      sort = { top: option.sortTop == 'asc' ? 1 : -1 };
    }
    if (option.sortViewer) {
      sort = { viewer: option.sortViewer == 'asc' ? 1 : -1 };
    }
    if (option.sortCreatedAt) {
      if (option.sortCreatedAt == 'asc') {
        sort = { createdAt: 1 };
      }
    }
    if (option.tags) {
      const tags = option.tags.split(',');
      const or: any = [];
      tags.forEach((t) => {
        if (option.regMatch) {
          or.push({
            tags: { $regex: `${t}`, $options: 'i' },
          });
        } else {
          or.push({
            tags: t,
          });
        }
      });
      and.push({ $or: or });
    }
    if (option.category) {
      if (option.regMatch) {
        and.push({
          category: { $regex: `${option.category}`, $options: 'i' },
        });
      } else {
        and.push({
          category: option.category,
        });
      }
    }
    if (option.title) {
      and.push({
        title: { $regex: `${option.title}`, $options: 'i' },
      });
    }
    if (option.startTime || option.endTime) {
      const obj: any = {};
      if (option.startTime) {
        obj['$gte'] = new Date(option.startTime);
      }
      if (option.endTime) {
        obj['$lte'] = new Date(option.endTime);
      }
      $and.push({ createdAt: obj });
    }
    if (and.length) {
      $and.push({ $and: and });
    }
    query.$and = $and;
    let view: any = isPublic ? this.publicView : this.adminView;
    if (option.toListView) {
      view = this.listView;
    }
    if (option.withPreviewContent) {
      view = this.overviewView;
    }
    if (option.withWordCount) {
      view = isPublic ? this.publicView : this.adminView;
    }

    let articles: any[];
    if (option.pageSize !== -1 && isPublic) {
      const pageSize = option.pageSize;
      const page = option.page;
      const globalSkip = pageSize * (page - 1);
      const pinnedArticles = await this.articleModel
        .find({ $and: [...$and, { top: { $gt: 0 } }] }, view)
        .sort({ top: -1 })
        .lean()
        .exec();
      const numPinned = pinnedArticles.length;
      let result: any[] = [];
      if (globalSkip < numPinned) {
        result = pinnedArticles.slice(globalSkip, Math.min(numPinned, globalSkip + pageSize));
      }
      const nonPinnedNeeded = pageSize - result.length;
      if (nonPinnedNeeded > 0) {
        const nonPinnedSkip = Math.max(0, globalSkip - numPinned);
        const nonPinnedArticles = await this.articleModel
          .find({ $and: [...$and, { top: { $lte: 0 } }] }, view)
          .sort(sort)
          .skip(nonPinnedSkip)
          .limit(nonPinnedNeeded)
          .lean()
          .exec();
        result = [...result, ...nonPinnedArticles];
      }
      articles = result;
    } else if (option.pageSize !== -1 && !isPublic) {
      articles = await this.articleModel
        .find(query, view)
        .sort(sort)
        .skip(option.pageSize * option.page - option.pageSize)
        .limit(option.pageSize)
        .lean()
        .exec();
    } else {
      articles = await this.articleModel.find(query, view).sort(sort).lean().exec();
    }
    const total = await this.articleModel.countDocuments(query).exec();
    if (option.withPreviewContent && !option.withWordCount) {
      articles = articles.map((article: any) => {
        if (article.private) {
          return {
            ...article,
            content: undefined,
          };
        }
        return {
          ...article,
          content: buildArticlePreview(article.content || ''),
        };
      });
    }
    const resData: any = {};
    if (option.withWordCount) {
      let totalWordCount = 0;
      articles.forEach((a) => {
        totalWordCount = totalWordCount + wordCount(a?.content || '');
      });
      resData.totalWordCount = totalWordCount;
    }
    if (option.withWordCount && option.toListView) {
      resData.articles = articles.map((a: any) => ({
        ...(a?._doc || a),
        content: undefined,
        password: undefined,
      }));
    } else {
      resData.articles = articles;
    }
    resData.total = total;
    return resData;
  }

  async getByIdOrPathname(id: string | number, view: ArticleView) {
    const idString = String(id);
    // 先尝试通过 pathname 查找
    const articleByPathname = await this.getByPathName(idString, view);

    if (articleByPathname) {
      return articleByPathname;
    }
    
    // 检查 id 是否可以转换为有效的数字
    const numericId = Number(idString);
    if (isNaN(numericId)) {
      // 如果不是有效数字，说明传入的是 pathname，但找不到对应的文章
      return null;
    }
    
    // 通过 ID 查找文章
    const articleById = await this.getById(numericId, view);
    
    // 如果通过 ID 找到了文章，需要验证：
    // 1. 如果传入的 id 是数字字符串（如 "123"），说明是通过 ID 访问，直接返回
    // 2. 如果传入的 id 不是数字字符串（如 "my-article"），说明是通过 pathname 访问
    //    此时如果文章有 pathname 且与传入的不匹配，说明是旧的 pathname，应该返回 null
    if (articleById) {
      const isNumericInput = /^\d+$/.test(idString.trim());
      
      // 如果不是纯数字输入（说明是 pathname），但文章有 pathname 且不匹配，返回 null
      if (!isNumericInput && articleById.pathname && articleById.pathname !== idString) {
        // 这是旧的 pathname，应该返回 null 使旧路径失效
        return null;
      }
      
      // 其他情况都返回找到的文章
      return articleById;
    }
    
    return null;
  }

  async getByPathName(pathname: string, view: ArticleView): Promise<Article> {
    const article = await this.structuredDataService.getArticleByPathname(pathname);
    if (article) {
      return this.projectArticleForView(article, view);
    }
    const $and: any = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];

    return await this.articleModel
      .findOne(
        {
          pathname: decodeURIComponent(pathname),
          $and,
        },
        this.getView(view),
      )
      .lean()
      .exec();
  }

  async getById(id: number, view: ArticleView): Promise<Article> {
    const article = await this.structuredDataService.getArticleById(id);
    if (article) {
      return this.projectArticleForView(article, view);
    }
    const $and: any = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];

    return await this.articleModel
      .findOne(
        {
          id,
          $and,
        },
        this.getView(view),
      )
      .lean()
      .exec();
  }
  async getByIdWithPassword(id: number | string, password: string): Promise<any> {
    const article: any = await this.getByIdOrPathname(id, 'admin');
    if (!password) {
      return null;
    }
    if (!article) {
      return null;
    }
    if (article.hidden) {
      const siteInfo = await this.metaProvider.getSiteInfo();
      if (!siteInfo?.allowOpenHiddenPostByUrl || siteInfo?.allowOpenHiddenPostByUrl == 'false') {
        return null;
      }
    }
    const category = ((await this.getCategoryByName(article.category)) || {}) as any;

    const categoryPassword = category.private ? category.password : undefined;
    const targetPassword = categoryPassword ? categoryPassword : article.password;
    if (!targetPassword || targetPassword == '') {
      return { ...(article?._doc || article), password: undefined };
    } else {
      if (targetPassword == password) {
        return { ...(article?._doc || article), password: undefined };
      } else {
        return null;
      }
    }
  }
  async getByIdOrPathnameWithPreNext(id: string | number, view: ArticleView) {
    const curArticle = await this.getPublicArticleByIdOrPathname(id, view);
    const res: any = { article: curArticle };
    // 找它的前一个和后一个。
    const preArticle = await this.getPreArticleByArticle(curArticle, 'list');
    const nextArticle = await this.getNextArticleByArticle(curArticle, 'list');
    if (preArticle) {
      res.pre = preArticle;
    }
    if (nextArticle) {
      res.next = nextArticle;
    }
    return res;
  }

  async getPublicArticleByIdOrPathname(id: string | number, view: ArticleView) {
    const curArticle = await this.getByIdOrPathname(id, view);
    if (!curArticle) {
      throw new NotFoundException('找不到文章');
    }

    if (curArticle.hidden) {
      const siteInfo = await this.metaProvider.getSiteInfo();
      if (!siteInfo?.allowOpenHiddenPostByUrl || siteInfo?.allowOpenHiddenPostByUrl == 'false') {
        throw new NotFoundException('该文章是隐藏文章！');
      }
    }
    if (curArticle.private) {
      curArticle.content = undefined;
      return curArticle;
    }

    // 检查分类是不是加密了
    const category = await this.getCategoryByName(curArticle.category);
    if (category && category.private) {
      curArticle.private = true;
      curArticle.content = undefined;
    }

    return curArticle;
  }

  async getArticleNavByIdOrPathname(id: string | number, view: ArticleView) {
    const curArticle = await this.getByIdOrPathname(id, view);
    if (!curArticle) {
      throw new NotFoundException('找不到文章');
    }

    const preArticle = await this.getPreArticleByArticle(curArticle, 'list');
    const nextArticle = await this.getNextArticleByArticle(curArticle, 'list');

    return {
      pre: preArticle || null,
      next: nextArticle || null,
    };
  }
  async getPreArticleByArticle(article: Article, view: ArticleView, includeHidden?: boolean) {
    const pgArticle = await this.structuredDataService.getAdjacentArticle(article, 'prev', Boolean(includeHidden));
    if (pgArticle || this.structuredDataService.isInitialized()) {
      return pgArticle ? (this.projectArticleForView(pgArticle, view) as any) : null;
    }
    const $and: any = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
      { createdAt: { $lt: article.createdAt } },
    ];
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }
    const result = await this.articleModel
      .find(
        {
          $and,
        },
        this.getView(view),
      )
      .sort({ createdAt: -1 })
      .limit(1);
    if (result.length) {
      return result[0];
    }
    return null;
  }
  async getNextArticleByArticle(article: Article, view: ArticleView, includeHidden?: boolean) {
    const pgArticle = await this.structuredDataService.getAdjacentArticle(article, 'next', Boolean(includeHidden));
    if (pgArticle || this.structuredDataService.isInitialized()) {
      return pgArticle ? (this.projectArticleForView(pgArticle, view) as any) : null;
    }
    const $and: any = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
      { createdAt: { $gt: article.createdAt } },
    ];
    if (!includeHidden) {
      $and.push({
        $or: [
          {
            hidden: false,
          },
          {
            hidden: { $exists: false },
          },
        ],
      });
    }
    const result = await this.articleModel
      .find(
        {
          $and,
        },
        this.getView(view),
      )
      .sort({ createdAt: 1 })
      .limit(1);
    if (result.length) {
      return result[0];
    }
    return null;
  }

  async findOneByTitle(title: string): Promise<Article> {
    const article = await this.structuredDataService.getArticleByTitle(title);
    if (article) {
      return article as any;
    }
    return this.articleModel.findOne({ title }).exec();
  }

  toSearchResult(articles: Article[]) {
    return articles.map((each) => ({
      title: each.title,
      id: each.id,
      category: each.category,
      tags: each.tags,
      updatedAt: each.updatedAt,
      createdAt: each.createdAt,
    }));
  }

  async searchByString(str: string, includeHidden: boolean): Promise<Article[]> {
    const normalizedSearch = String(str || '').trim().toLocaleLowerCase();
    if (!normalizedSearch) {
      return [];
    }
    const pgResults = await this.structuredDataService.searchArticles(str, includeHidden);
    let sortedData: any[];

    if (pgResults.length || this.structuredDataService.isInitialized()) {
      sortedData = pgResults as any;
    } else {
      const safePattern = escapeRegExp(normalizedSearch);
      const $and: any = [
        {
          $or: [
            { content: { $regex: safePattern, $options: 'i' } },
            { title: { $regex: safePattern, $options: 'i' } },
            { category: { $regex: safePattern, $options: 'i' } },
            { tags: { $regex: safePattern, $options: 'i' } },
          ],
        },
        {
          $or: [
            {
              deleted: false,
            },
            {
              deleted: { $exists: false },
            },
          ],
        },
      ];
      if (!includeHidden) {
        $and.push({
          $or: [
            {
              hidden: false,
            },
            {
              hidden: { $exists: false },
            },
          ],
        });
      }
      const rawData = await this.articleModel
        .find({
          $and,
        })
        .exec();
      const titleData = rawData.filter((each) => each.title.toLocaleLowerCase().includes(normalizedSearch));
      const contentData = rawData.filter((each) => each.content.toLocaleLowerCase().includes(normalizedSearch));
      const categoryData = rawData.filter((each) => each.category.toLocaleLowerCase().includes(normalizedSearch));
      const tagData = rawData.filter((each) =>
        each.tags.map((t) => t.toLocaleLowerCase()).includes(normalizedSearch),
      );
      sortedData = [...titleData, ...contentData, ...tagData, ...categoryData];
    }

    if (!includeHidden) {
      sortedData = await this.applyPublicPrivacyToArticles(sortedData);
      sortedData = sortedData.filter((article) => this.matchesSanitizedSearch(article, normalizedSearch));
    }

    const resData = [];
    for (const e of sortedData) {
      if (!resData.includes(e)) {
        resData.push(e);
      }
    }
    return resData;
  }

  async findAll(): Promise<Article[]> {
    const articles = await this.structuredDataService.listArticles({
      includeHidden: true,
      includeDelete: true,
    });
    if (articles.length || this.structuredDataService.isInitialized()) {
      return articles as any;
    }
    return this.articleModel.find({}).exec();
  }
  async deleteById(id: number) {
    const originalArticle = await this.getById(id, 'admin');
    const res = await this.articleModel.updateOne({ id }, { deleted: true });
    if (originalArticle) {
      await this.structuredDataService.upsertArticle({
        ...(originalArticle?._doc || originalArticle),
        deleted: true,
        updatedAt: new Date(),
      });
    }
    this.metaProvider.updateTotalWords('删除文章');
    return res;
  }

  async updateById(id: number, updateArticleDto: UpdateArticleDto, skipUpdateWordCount?: boolean) {
    // 获取原始文章以比较标签变化
    const originalArticle = await this.getById(id, 'admin');
    
    const updateData = { ...updateArticleDto, updatedAt: new Date() };
    if (!skipUpdateWordCount) {
      this.metaProvider.updateTotalWords('修改文章');
    }
    
    const result = await this.articleModel.updateOne({ id }, updateData);
    if (originalArticle) {
      await this.structuredDataService.upsertArticle({
        ...(originalArticle?._doc || originalArticle),
        ...updateData,
      });
    }
    
    // 如果标签发生变化，更新Tag表
    if (updateArticleDto.tags !== undefined && originalArticle) {
      const oldTags = originalArticle.tags || [];
      const newTags = updateArticleDto.tags || [];
      
      // 只有当标签真正发生变化时才更新
      const tagsChanged = JSON.stringify(oldTags.sort()) !== JSON.stringify(newTags.sort());
      if (tagsChanged) {
        // 注入TagProvider进行标签更新（需要在constructor中注入）
        // 这里先注释掉，避免循环依赖
        // await this.tagProvider.updateTagForArticle(id, oldTags, newTags);
      }
    }
    
    return result;
  }

  async getNewId() {
    return await this.structuredDataService.nextArticleId();
  }

  private async refreshStructuredArticles(reason: string) {
    await this.structuredDataService.refreshArticlesFromRecordStore(reason);
  }

  /**
   * 文章序号重排 - 将所有文章按创建时间顺序重新分配ID
   * 改进版：使用更安全的ID重分配策略，包括自定义路径文章
   */
  async reorderArticleIds() {
    // 设置全局锁，防止并发操作
    while (this.idLock) {
      await sleep(10);
    }
    this.idLock = true;

    try {
      console.log('开始执行文章序号重排...');
      
      // 1. 获取所有非删除的文章，按创建时间升序排列
      const articles = await this.articleModel
        .find({
          $or: [
            { deleted: false },
            { deleted: { $exists: false } }
          ]
        })
        .sort({ createdAt: 1 })
        .exec();

      if (articles.length === 0) {
        this.idLock = false;
        return {
          totalArticles: 0,
          updatedReferences: 0,
          customPathArticles: 0,
          message: '没有找到需要重排的文章'
        };
      }

      // 2. 重新设计：所有文章都参与ID重排，但自定义路径文章保持其pathname
      const idMapping = new Map<number, number>();
      const reorderItems = [];
      
      // 所有文章都按创建时间顺序分配新ID
      let newId = 1;
      for (const article of articles) {
        idMapping.set(article.id, newId);
        reorderItems.push({
          oldId: article.id,
          newId: newId,
          hasCustomPath: !!article.pathname,
          pathname: article.pathname,
          article: article
        });
        newId++;
      }

      const customPathCount = reorderItems.filter(item => item.hasCustomPath).length;
      console.log(`准备重排 ${articles.length} 篇文章，其中 ${customPathCount} 篇有自定义路径`);

      // 3. 预检查：确保目标ID范围是安全的
      console.log('预检查：验证目标ID范围...');
      const maxTargetId = articles.length;
      const conflictingArticles = await this.articleModel
        .find({
          id: { $lte: maxTargetId },
          _id: { $nin: articles.map(a => a._id) } // 排除当前要重排的文章
        })
        .exec();
      
      if (conflictingArticles.length > 0) {
        console.log(`发现 ${conflictingArticles.length} 篇可能冲突的文章，先将它们移动到安全位置`);
        const SAFE_ID_START = 50000;
        for (let i = 0; i < conflictingArticles.length; i++) {
          await this.articleModel.updateOne(
            { id: conflictingArticles[i].id },
            { 
              id: SAFE_ID_START + i,
              updatedAt: new Date()
            }
          );
          console.log(`移动冲突文章: ${conflictingArticles[i].id} -> ${SAFE_ID_START + i}`);
        }
      }

      // 4. 更新文章内容中的引用链接
      let updatedReferences = 0;
      const linkRegex = /\/post\/(\d+)/g;
      
      for (const article of articles) {
        let contentChanged = false;
        let newContent = article.content;
        
        // 替换文章内容中的引用链接
        newContent = newContent.replace(linkRegex, (match: string, oldIdStr: string) => {
          const oldReferencedId = parseInt(oldIdStr, 10);
          const newReferencedId = idMapping.get(oldReferencedId);
          
          if (newReferencedId && newReferencedId !== oldReferencedId) {
            contentChanged = true;
            updatedReferences++;
            console.log(`更新引用链接: ${match} -> /post/${newReferencedId} (在文章 ${article.id} 中)`);
            return `/post/${newReferencedId}`;
          }
          return match;
        });
        
        // 如果内容有变化，更新文章
        if (contentChanged) {
          await this.articleModel.updateOne(
            { id: article.id },
            { 
              content: newContent,
              updatedAt: new Date()
            }
          );
        }
      }

      // 5. 更安全的ID重分配策略
      // 使用临时ID范围，确保不会与目标ID冲突
      const TEMP_ID_OFFSET = 100000;
      
      console.log('第一阶段：将所有文章移动到临时ID范围...');
      // 第一阶段：所有参与重排的文章移动到临时ID
      for (let i = 0; i < reorderItems.length; i++) {
        const item = reorderItems[i];
        await this.articleModel.updateOne(
          { id: item.oldId },
          { 
            id: TEMP_ID_OFFSET + i, // 使用索引作为临时ID，避免冲突
            updatedAt: new Date()
          }
        );
        console.log(`移动到临时ID: ${item.oldId} -> ${TEMP_ID_OFFSET + i}`);
      }
      
      console.log('第二阶段：将文章移动到最终ID...');
      // 第二阶段：从临时ID移动到最终ID
      for (let i = 0; i < reorderItems.length; i++) {
        const item = reorderItems[i];
        await this.articleModel.updateOne(
          { id: TEMP_ID_OFFSET + i },
          { 
            id: item.newId,
            updatedAt: new Date()
          }
        );
        console.log(`移动到最终ID: ${TEMP_ID_OFFSET + i} -> ${item.newId}`);
      }

      // 6. 清理移动到安全位置的冲突文章
      console.log('清理冲突文章...');
      if (conflictingArticles.length > 0) {
        const SAFE_ID_START = 50000;
        for (let i = 0; i < conflictingArticles.length; i++) {
          const safeId = SAFE_ID_START + i;
          await this.articleModel.deleteOne({ id: safeId });
          console.log(`删除冲突文章: ID ${safeId}`);
        }
      }

      // 7. 记录重排结果
      console.log('文章序号重排完成');
      console.log('提示: 文章ID变更后，可能需要手动清理浏览量统计缓存');
      
      await this.refreshStructuredArticles('article-reorder');
      
      return {
        totalArticles: articles.length,
        updatedReferences,
        customPathArticles: customPathCount,
        message: '文章序号重排成功完成'
      };
      
    } catch (error) {
      console.error('文章序号重排失败:', error);
      throw new Error(`文章序号重排失败: ${error.message}`);
    } finally {
      this.idLock = false;
    }
  }

  /**
   * 修复负数ID - 将负数ID修正为正数
   */
  async fixNegativeIds() {
    // 设置全局锁，防止并发操作
    while (this.idLock) {
      await sleep(10);
    }
    this.idLock = true;

    try {
      console.log('开始修复负数ID...');
      
      // 查找所有负数ID的文章
      const negativeIdArticles = await this.articleModel
        .find({ id: { $lt: 0 } })
        .sort({ id: 1 })
        .exec();

      if (negativeIdArticles.length === 0) {
        this.idLock = false;
        return {
          fixedCount: 0,
          message: '没有找到负数ID的文章'
        };
      }

      console.log(`找到 ${negativeIdArticles.length} 篇负数ID文章`);

      // 获取当前最大的正数ID
      const maxPositiveIdResult = await this.articleModel
        .find({ id: { $gt: 0 } })
        .sort({ id: -1 })
        .limit(1);
      
      let nextId = maxPositiveIdResult.length > 0 ? maxPositiveIdResult[0].id + 1 : 1;

      // 将负数ID改为正数ID
      for (const article of negativeIdArticles) {
        await this.articleModel.updateOne(
          { id: article.id },
          { 
            id: nextId,
            updatedAt: new Date()
          }
        );
        console.log(`修复文章ID: ${article.id} -> ${nextId} (${article.title})`);
        nextId++;
      }

      console.log('负数ID修复完成');
      await this.refreshStructuredArticles('article-fix-negative-ids');
      
      return {
        fixedCount: negativeIdArticles.length,
        message: '负数ID修复成功完成'
      };
      
    } catch (error) {
      console.error('修复负数ID失败:', error);
      throw new Error(`修复负数ID失败: ${error.message}`);
    } finally {
      this.idLock = false;
    }
  }

  /**
   * 清理临时ID - 删除ID在50000+范围的文章
   */
  async cleanupTempIds() {
    // 设置全局锁，防止并发操作
    while (this.idLock) {
      await sleep(10);
    }
    this.idLock = true;

    try {
      console.log('开始清理临时ID文章...');
      
      // 查找所有临时ID的文章（50000+）
      const tempIdArticles = await this.articleModel
        .find({ id: { $gte: 50000 } })
        .exec();

      if (tempIdArticles.length === 0) {
        this.idLock = false;
        return {
          cleanedCount: 0,
          message: '没有找到需要清理的临时ID文章'
        };
      }

      console.log(`找到 ${tempIdArticles.length} 篇临时ID文章`);

      // 删除所有临时ID文章
      let cleanedCount = 0;
      for (const article of tempIdArticles) {
        await this.articleModel.deleteOne({ id: article.id });
        console.log(`删除临时ID文章: ${article.id} - ${article.title}`);
        cleanedCount++;
      }

      await this.refreshStructuredArticles('article-cleanup-temp-ids');

      return {
        cleanedCount: cleanedCount,
        message: `成功清理 ${cleanedCount} 篇临时ID文章`
      };

    } catch (error) {
      console.error('清理临时ID失败:', error);
      throw new Error(`清理临时ID失败: ${error.message}`);
    } finally {
      this.idLock = false;
    }
  }

  async cleanupDuplicatePathnames() {
    console.log('开始清理重复的自定义路径名...');
    
    // 获取所有有自定义路径名的文章
    const articlesWithPathname = await this.articleModel
      .find({ 
        pathname: { $exists: true, $ne: '' },
        $and: [
          {
            $or: [
              { deleted: false },
              { deleted: { $exists: false } },
            ],
          },
        ],
      })
      .sort({ createdAt: 1 }) // 按创建时间排序，保留较早的文章
      .exec();

    if (articlesWithPathname.length === 0) {
      console.log('没有找到带有自定义路径名的文章');
      return { cleanedCount: 0 };
    }

    // 按路径名分组
    const pathnameGroups = new Map<string, any[]>();
    for (const article of articlesWithPathname) {
      const pathname = article.pathname.trim();
      if (!pathnameGroups.has(pathname)) {
        pathnameGroups.set(pathname, []);
      }
      pathnameGroups.get(pathname)!.push(article);
    }

    let cleanedCount = 0;
    
    // 处理每个路径名组
    for (const [pathname, articles] of pathnameGroups) {
      if (articles.length > 1) {
        console.log(`发现重复路径名 "${pathname}"，共 ${articles.length} 篇文章`);
        
        // 保留第一篇（最早创建的），清除其他文章的自定义路径名
        for (let i = 1; i < articles.length; i++) {
          const article = articles[i];
          await this.articleModel.updateOne(
            { id: article.id },
            { $unset: { pathname: '' } }
          );
          console.log(`  清除了文章 ID ${article.id} ("${article.title}") 的重复路径名`);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      await this.refreshStructuredArticles('article-cleanup-duplicate-pathnames');
    }
    console.log(`清理完成，共处理了 ${cleanedCount} 篇文章的重复路径名`);
    return { cleanedCount };
  }
}
