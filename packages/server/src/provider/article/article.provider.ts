import { Inject, Injectable, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateArticleDto, SearchArticleOption, UpdateArticleDto } from 'src/types/article.dto';
import { Article, ArticleDocument } from 'src/scheme/article.schema';
import { parseImgLinksOfMarkdown } from 'src/utils/parseImgOfMarkdown';
import { wordCount } from 'src/utils/wordCount';
import { MetaProvider } from '../meta/meta.provider';
import { VisitProvider } from '../visit/visit.provider';
import { sleep } from 'src/utils/sleep';
import { CategoryDocument } from 'src/scheme/category.schema';

export type ArticleView = 'admin' | 'public' | 'list';

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
    const res = createdData.save();
    return res;
  }
  async searchArticlesByLink(link: string) {
    const artciles = await this.articleModel.find(
      {
        content: { $regex: link, $options: 'i' },
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
    const articles = await this.articleModel.find({
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
    let article = await this.getByPathName(pathname, 'list');
    if (!article) {
      // 这是通过 id 的吧，检查是否为有效数字
      const numericId = Number(pathname);
      if (!isNaN(numericId)) {
        article = await this.getById(numericId, 'list');
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
  }

  async updateViewer(id: number, isNew: boolean) {
    const article = await this.getById(id, 'list');
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
  }

  async getRecentVisitedArticles(num: number, view: ArticleView) {
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
      total = total + wordCount(a.content);
    });
    return total;
  }
  async getTotalNum(includeHidden: boolean) {
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
      .exec();
    return articles;
  }

  async getTimeLineInfo() {
    // 肯定是不需要具体内容的，一个列表就好了
    const articles = await this.articleModel
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
          ],
        },
        this.listView,
      )
      .sort({ createdAt: -1 })
      .exec();
    // 清洗一下数据。
    const dates = Array.from(new Set(articles.map((a) => a.createdAt.getFullYear())));
    const res: Record<string, Article[]> = {};
    dates.forEach((date) => {
      res[date] = articles.filter((a) => a.createdAt.getFullYear() == date);
    });
    return res;
  }
  async getByOption(
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
      if (option.sortTop == 'asc') {
        sort = { top: 1 };
      } else {
        sort = { top: -1 };
      }
    }
    if (option.sortViewer) {
      if (option.sortViewer == 'asc') {
        sort = { viewer: 1 };
      } else {
        sort = { viewer: -1 };
      }
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
    // console.log(JSON.stringify(query, null, 2));
    // console.log(JSON.stringify(sort, null, 2));
    let view: any = isPublic ? this.publicView : this.adminView;
    if (option.toListView) {
      view = this.listView;
    }
    if (option.withWordCount) {
      view = isPublic ? this.publicView : this.adminView;
    }
    let articlesQuery = this.articleModel.find(query, view).sort(sort);
    if (option.pageSize != -1 && !isPublic) {
      articlesQuery = articlesQuery
        .skip(option.pageSize * option.page - option.pageSize)
        .limit(option.pageSize);
    }

    let articles = await articlesQuery.exec();
    // public 下 包括所有的，
    if (isPublic && option.pageSize != -1) {
      // 把 top 的诺到前面去
      const topArticles = articles.filter((a: any) => {
        const top = a?._doc?.top || a?.top;
        return Boolean(top) && top != '';
      });
      const notTopArticles = articles.filter((a: any) => {
        const top = a?._doc?.top || a?.top;
        return !Boolean(top) || top == '';
      });
      const sortedTopArticles = topArticles.sort((a: any, b: any) => {
        const topA = a?._doc?.top || a?.top;
        const topB = b?._doc?.top || b?.top;
        if (topA > topB) {
          return -1;
        } else if (topB > topA) {
          return 1;
        } else {
          return 0;
        }
      });
      articles = [...sortedTopArticles, ...notTopArticles];
      const skip = option.pageSize * option.page - option.pageSize;
      const rawEnd = skip + option.pageSize;
      const end = rawEnd > articles.length - 1 ? articles.length : rawEnd;
      articles = articles.slice(skip, end);
    }
    // withWordCount 只会返回当前分页的文字数量

    const total = await this.articleModel.countDocuments(query).exec();
    // 过滤私有文章
    if (isPublic) {
      const tmpArticles: any[] = [];
      for (const a of articles) {
        //@ts-ignore
        const isPrivateInArticle = a?._doc?.private || a?.private;
        const category = await this.categoryModal.findOne({
          //@ts-ignore
          name: a?._doc?.category || a?.category,
        });
        const isPrivateInCategory = category?.private || false;
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
    } else {
      resData.articles = articles;
    }

    resData.total = total;
    return resData;
  }

  async getByIdOrPathname(id: string | number, view: ArticleView) {
    const articleByPathname = await this.getByPathName(String(id), view);

    if (articleByPathname) {
      return articleByPathname;
    }
    
    // 检查 id 是否可以转换为有效的数字
    const numericId = Number(id);
    if (isNaN(numericId)) {
      // 如果不是有效数字，返回 null
      return null;
    }
    
    return await this.getById(numericId, view);
  }

  async getByPathName(pathname: string, view: ArticleView): Promise<Article> {
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
      .exec();
  }

  async getById(id: number, view: ArticleView): Promise<Article> {
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
    const category =
      (await this.categoryModal.findOne({
        name: article.category,
      })) || ({} as any);

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
    } else {
      // 检查分类是不是加密了
      const category = await this.categoryModal.findOne({
        name: curArticle.category,
      });
      if (category && category.private) {
        curArticle.private = true;
        curArticle.content = undefined;
      }
    }
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
  async getPreArticleByArticle(article: Article, view: ArticleView, includeHidden?: boolean) {
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
    const $and: any = [
      {
        $or: [
          { content: { $regex: `${str}`, $options: 'i' } },
          { title: { $regex: `${str}`, $options: 'i' } },
          { category: { $regex: `${str}`, $options: 'i' } },
          { tags: { $regex: `${str}`, $options: 'i' } },
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
    const s = str.toLocaleLowerCase();
    const titleData = rawData.filter((each) => each.title.toLocaleLowerCase().includes(s));
    const contentData = rawData.filter((each) => each.content.toLocaleLowerCase().includes(s));
    const categoryData = rawData.filter((each) => each.category.toLocaleLowerCase().includes(s));
    const tagData = rawData.filter((each) =>
      each.tags.map((t) => t.toLocaleLowerCase()).includes(s),
    );
    const sortedData = [...titleData, ...contentData, ...tagData, ...categoryData];
    const resData = [];
    for (const e of sortedData) {
      if (!resData.includes(e)) {
        resData.push(e);
      }
    }
    return resData;
  }

  async findAll(): Promise<Article[]> {
    return this.articleModel.find({}).exec();
  }
  async deleteById(id: number) {
    const res = await this.articleModel.updateOne({ id }, { deleted: true }).exec();
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
    while (this.idLock) {
      await sleep(10);
    }
    this.idLock = true;
    // 只考虑正常范围的ID，忽略临时ID（50000+, 100000+等）
    const maxObj = await this.articleModel.find({ id: { $lt: 50000 } }).sort({ id: -1 }).limit(1);
    let res = 1;
    if (maxObj.length) {
      res = maxObj[0].id + 1;
    }
    this.idLock = false;
    return res;
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
      
      this.idLock = false;
      
      return {
        totalArticles: articles.length,
        updatedReferences,
        customPathArticles: customPathCount,
        message: '文章序号重排成功完成'
      };
      
    } catch (error) {
      this.idLock = false;
      console.error('文章序号重排失败:', error);
      throw new Error(`文章序号重排失败: ${error.message}`);
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
      this.idLock = false;
      
      return {
        fixedCount: negativeIdArticles.length,
        message: '负数ID修复成功完成'
      };
      
    } catch (error) {
      this.idLock = false;
      console.error('修复负数ID失败:', error);
      throw new Error(`修复负数ID失败: ${error.message}`);
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

      this.idLock = false;

      return {
        cleanedCount: cleanedCount,
        message: `成功清理 ${cleanedCount} 篇临时ID文章`
      };

    } catch (error) {
      this.idLock = false;
      console.error('清理临时ID失败:', error);
      throw new Error(`清理临时ID失败: ${error.message}`);
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

    console.log(`清理完成，共处理了 ${cleanedCount} 篇文章的重复路径名`);
    return { cleanedCount };
  }
}
