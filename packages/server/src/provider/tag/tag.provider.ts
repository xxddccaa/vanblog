import { Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { Tag, TagDocument } from 'src/scheme/tag.schema';
import { ArticleProvider } from '../article/article.provider';
import { CacheProvider } from '../cache/cache.provider';
import { StructuredDataService } from 'src/storage/structured-data.service';

@Injectable()
export class TagProvider {
  constructor(
    private readonly articleProvider: ArticleProvider,
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
    private readonly cacheProvider: CacheProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  // 缓存键前缀
  private readonly CACHE_PREFIX = 'tag:';
  private readonly CACHE_TTL = 300; // 5分钟

  /**
   * 同步标签数据 - 从文章中提取标签并更新Tag表
   * 这个方法用于初始化或修复标签数据
   */
  async syncTagsFromArticles() {
    await this.structuredDataService.refreshArticlesFromRecordStore();
    await this.clearTagCache();
  }

  async invalidateCache() {
    await this.clearTagCache();
  }

  /**
   * 更新单个标签的文章关联
   */
  async updateTagForArticle(articleId: number, oldTags: string[], newTags: string[]) {
    const removedTags = oldTags.filter((tag) => !newTags.includes(tag));
    const addedTags = newTags.filter((tag) => !oldTags.includes(tag));

    const bulkOps = [];

    // 处理移除的标签
    for (const tagName of removedTags) {
      bulkOps.push({
        updateOne: {
          filter: { name: tagName },
          update: {
            $pull: { articleIds: articleId },
            $inc: { articleCount: -1 },
            $set: { updatedAt: new Date() },
          },
        },
      });
    }

    // 处理新增的标签
    for (const tagName of addedTags) {
      bulkOps.push({
        updateOne: {
          filter: { name: tagName },
          update: {
            $addToSet: { articleIds: articleId },
            $inc: { articleCount: 1 },
            $set: { updatedAt: new Date() },
            $setOnInsert: {
              name: tagName,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await this.tagModel.bulkWrite(bulkOps);
    }

    // 删除文章数为0的标签
    await this.tagModel.deleteMany({ articleCount: { $lte: 0 } });

    // 清除相关缓存
    await this.clearTagCache();
  }

  /**
   * 分页获取标签列表
   */
  async getTagsPaginated(
    page: number = 1,
    pageSize: number = 50,
    sortBy: 'name' | 'articleCount' | 'createdAt' | 'updatedAt' = 'articleCount',
    sortOrder: 'asc' | 'desc' = 'desc',
    search?: string,
  ) {
    const cacheKey = `${this.CACHE_PREFIX}paginated:${page}:${pageSize}:${sortBy}:${sortOrder}:${
      search || ''
    }`;
    const cached = await this.cacheProvider.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { tags, total } = await this.structuredDataService.getTagPage(
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
    );

    const result = {
      tags,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    await this.cacheProvider.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * 获取所有标签名称 - 用于兼容旧接口
   */
  async getAllTags(includeHidden: boolean = false): Promise<string[]> {
    const cacheKey = `${this.CACHE_PREFIX}all:${includeHidden}`;
    const cached = await this.cacheProvider.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.structuredDataService.listTagNames();
    await this.cacheProvider.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async getAllTagRecords() {
    return await this.structuredDataService.listTagRecords();
  }

  /**
   * 根据标签名获取文章列表
   */
  async getArticlesByTag(
    tagName: string,
    includeHidden: boolean = false,
    page?: number,
    pageSize?: number,
  ) {
    const tag = await this.structuredDataService.getTagByName(tagName);
    if (!tag || !tag.articleCount) {
      return [];
    }

    // 直接使用ArticleProvider的方法来查询文章
    const searchOption: any = {
      tags: tagName,
      page: page || 1,
      pageSize: pageSize || -1,
      toListView: true,
    };

    const result = await this.articleProvider.getByOption(searchOption, !includeHidden);
    return result.articles || [];
  }

  /**
   * 获取标签统计数据 - 用于图表显示
   */
  async getColumnData(topNum: number, includeHidden: boolean = false) {
    const cacheKey = `${this.CACHE_PREFIX}column:${topNum}:${includeHidden}`;
    const cached = await this.cacheProvider.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tags = await this.structuredDataService.getHotTags(topNum);

    const result = tags.map((tag) => ({
      type: tag.name,
      value: tag.articleCount,
    }));

    await this.cacheProvider.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * 重命名标签
   */
  async updateTagByName(oldName: string, newName: string) {
    // 检查新标签名是否已存在
    const existingTag = await this.structuredDataService.getTagByName(newName);
    if (existingTag && existingTag.name !== oldName) {
      throw new Error('新标签名已存在');
    }

    const tag = await this.structuredDataService.getTagByName(oldName);
    if (!tag) {
      throw new Error('标签不存在');
    }

    // 更新文章中的标签
    await this.articleProvider['articleModel'].updateMany(
      { tags: oldName },
      { $set: { 'tags.$': newName } },
    );
    await this.structuredDataService.renameTagInArticles(oldName, newName);

    await this.clearTagCache();
    return { message: '更新成功！', total: tag.articleCount };
  }

  /**
   * 删除标签
   */
  async deleteOne(name: string) {
    const tag = await this.structuredDataService.getTagByName(name);
    if (!tag) {
      throw new Error('标签不存在');
    }

    // 从所有文章中移除该标签
    await this.articleProvider['articleModel'].updateMany(
      { tags: name },
      { $pull: { tags: name } },
    );
    await this.structuredDataService.removeTagFromArticles(name);

    await this.clearTagCache();
    return { message: '删除成功！', total: tag.articleCount };
  }

  /**
   * 获取热门标签
   */
  async getHotTags(limit: number = 20) {
    const cacheKey = `${this.CACHE_PREFIX}hot:${limit}`;
    const cached = await this.cacheProvider.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tags = await this.structuredDataService.getHotTags(limit);

    await this.cacheProvider.set(cacheKey, tags, this.CACHE_TTL);
    return tags;
  }

  /**
   * 搜索标签
   */
  async searchTags(keyword: string, limit: number = 20) {
    return await this.structuredDataService.searchTags(keyword, limit);
  }

  /**
   * 清除标签相关缓存
   */
  private async clearTagCache() {
    await this.cacheProvider.delPattern(`${this.CACHE_PREFIX}*`);
  }

  // 为了兼容现有代码，保留旧方法
  async getTagsWithArticle(includeHidden: boolean) {
    const tags = await this.structuredDataService.listTagRecords();
    const result = {};

    for (const tag of tags) {
      const articles = await this.getArticlesByTag(tag.name, includeHidden);
      if (articles.length > 0) {
        result[tag.name] = articles;
      }
    }

    return result;
  }
}
