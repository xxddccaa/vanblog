import { Injectable, NotAcceptableException } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { ArticleProvider } from '../article/article.provider';
import { CategoryDocument } from 'src/scheme/category.schema';
import { UpdateCategoryDto, UpdateCategorySortDto } from 'src/types/category.dto';
import { StructuredDataService } from 'src/storage/structured-data.service';

@Injectable()
export class CategoryProvider {
  constructor(
    @InjectModel('Category') private categoryModal: Model<CategoryDocument>,
    private readonly articleProvider: ArticleProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  private async getCategoryByName(name: string) {
    const category = await this.structuredDataService.getCategoryByName(name);
    if (category || this.structuredDataService.isInitialized()) {
      return category as any;
    }
    return await this.categoryModal.findOne({ name }).lean().exec();
  }

  private toCategorySnapshot(category: any) {
    return {
      ...(category?._doc || category || {}),
      ...(category || {}),
    };
  }

  async getCategoriesWithArticle(includeHidden: boolean) {
    const categories = await this.getAllCategories();
    const data = {};
    categories.forEach((c) => {
      data[c] = [];
    });
    for (const category of categories) {
      data[category] = await this.getArticlesByCategory(category, includeHidden);
    }
    return data;
  }

  async getCategorySummaries(includeHidden: boolean) {
    const summaries = await this.structuredDataService.getCategoryArticleSummaries(includeHidden);
    if (summaries.length || this.structuredDataService.isInitialized()) {
      return summaries;
    }
    const allArticles = await this.articleProvider.getAll('list', includeHidden);
    const categories = await this.getAllCategories();
    const countMap = new Map<string, number>();
    categories.forEach((category) => {
      countMap.set(category, 0);
    });
    allArticles.forEach((article) => {
      if (!article.category) {
        return;
      }
      countMap.set(article.category, (countMap.get(article.category) || 0) + 1);
    });
    return categories.map((name) => ({
      name,
      articleCount: countMap.get(name) || 0,
    }));
  }
  async getPieData() {
    const pgResult = await this.structuredDataService.getCategoryDistribution(true);
    if (pgResult.length || this.structuredDataService.isInitialized()) {
      return pgResult;
    }
    const oldData = await this.getCategoriesWithArticle(true);
    const categories = Object.keys(oldData);
    if (!categories || categories.length < 0) {
      return [];
    }
    const res = [];
    categories.forEach((c) => {
      res.push({
        type: c,
        value: oldData[c].length || 0,
      });
    });
    return res;
  }

  async getAllCategories(all?: boolean) {
    const pgCategories = await this.structuredDataService.listCategories();
    if (pgCategories.length || this.structuredDataService.isInitialized()) {
      if (all) return pgCategories as any;
      return pgCategories.map((item: any) => item.name);
    }
    const d = await this.categoryModal.find({}).sort({ sort: 1, id: 1 }).lean();
    if (!d || !d.length) {
      return [];
    }
    if (all) return d;
    else return d.map((item) => item.name);
  }

  async getArticlesByCategory(name: string, includeHidden: boolean) {
    const articles = await this.structuredDataService.getArticlesByCategory(name, includeHidden);
    if (articles.length || this.structuredDataService.isInitialized()) {
      return articles as any;
    }
    const allArticles = await this.articleProvider.getAll('list', includeHidden);
    return allArticles.filter((article) => article.category === name);
  }

  async addOne(name: string) {
    // 验证分类名称不能为空或只包含空格
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new NotAcceptableException('分类名称不能为空或只包含空格！');
    }

    // 使用trim后的名称
    const trimmedName = name.trim();

    const existData = await this.getCategoryByName(trimmedName);
    if (existData) {
      throw new NotAcceptableException('分类名重复，无法创建！');
    } else {
      const categories = await this.getAllCategories(true);
      const newSort = categories.length
        ? Math.max(...categories.map((item: any) => Number(item?.sort || 0))) + 1
        : 0;

      const created = await this.categoryModal.create({
        id: await this.getNewId(),
        name: trimmedName,
        type: 'category',
        private: false,
        sort: newSort,
      });
      await this.structuredDataService.upsertCategory(created.toObject());
    }
  }

  async getNewId() {
    return await this.structuredDataService.nextCategoryId();
  }

  async deleteOne(name: string) {
    // 先检查一下有没有这个分类的文章
    const d = await this.getArticlesByCategory(name, true);
    if (d && d.length) {
      throw new NotAcceptableException('分类已有文章，无法删除！');
    }
    await this.categoryModal.deleteOne({
      name,
    });
    await this.structuredDataService.deleteCategoryByName(name);
  }

  async updateCategoryByName(name: string, dto: UpdateCategoryDto) {
    if (Object.keys(dto).length == 0) {
      throw new NotAcceptableException('无有效信息，无法修改！');
    }

    // 如果要修改名称，验证新名称不能为空或只包含空格
    if (dto.name !== undefined) {
      if (!dto.name || typeof dto.name !== 'string' || dto.name.trim().length === 0) {
        throw new NotAcceptableException('分类名称不能为空或只包含空格！');
      }
      // 使用trim后的名称
      dto.name = dto.name.trim();
    }

    if (dto.name && name != dto.name) {
      const existData = await this.getCategoryByName(dto.name);
      if (existData) {
        throw new NotAcceptableException('分类名重复，无法修改！');
      }
      // 先修改文章分类
      const articles = await this.getArticlesByCategory(name, true);
      if (articles && articles.length) {
        for (const article of articles) {
          await this.articleProvider.updateById(article.id, {
            category: dto.name,
          });
        }
      }
    }
    const currentCategory = await this.getCategoryByName(name);
    await this.categoryModal.updateOne(
      {
        name: name,
      },
      {
        ...dto,
      },
    );
    if (currentCategory) {
      await this.structuredDataService.upsertCategory({
        ...(currentCategory?._doc || currentCategory),
        ...currentCategory,
        ...dto,
        name: dto.name || currentCategory.name,
      });
    }
  }

  async updateCategoriesSort(dto: UpdateCategorySortDto) {
    const { categories } = dto;

    // 验证 categories 是否存在且为数组
    if (!categories || !Array.isArray(categories)) {
      throw new NotAcceptableException('categories must be a valid array');
    }

    // 验证数组不为空
    if (categories.length === 0) {
      throw new NotAcceptableException('categories array cannot be empty');
    }

    const normalizedUpdates = categories.map((categoryUpdate) => {
      // 验证每个分类项的格式
      if (
        !categoryUpdate ||
        typeof categoryUpdate.name !== 'string' ||
        typeof categoryUpdate.sort !== 'number'
      ) {
        throw new NotAcceptableException(
          'Invalid category format: each category must have a valid name (string) and sort (number)',
        );
      }

      // 验证分类名称不能为空或只包含空格
      const trimmedName = categoryUpdate.name.trim();
      if (trimmedName.length === 0) {
        throw new NotAcceptableException('分类名称不能为空或只包含空格！');
      }

      return {
        name: trimmedName,
        sort: categoryUpdate.sort,
      };
    });

    const categorySnapshot = await this.getAllCategories(true);
    const categoryMap = new Map<string, any>(
      (categorySnapshot as any[]).map((item) => {
        const snapshot = this.toCategorySnapshot(item);
        return [snapshot.name, snapshot];
      }),
    );
    const nextSnapshots: any[] = [];

    for (const categoryUpdate of normalizedUpdates) {
      const existing = categoryMap.get(categoryUpdate.name);
      if (existing) {
        const nextSnapshot = {
          ...existing,
          sort: categoryUpdate.sort,
        };
        categoryMap.set(categoryUpdate.name, nextSnapshot);
        nextSnapshots.push(nextSnapshot);
      }
    }

    await Promise.all(
      normalizedUpdates.map((categoryUpdate) =>
        this.categoryModal.updateOne({ name: categoryUpdate.name }, { sort: categoryUpdate.sort }),
      ),
    );
    await Promise.all(
      nextSnapshots.map((snapshot) => this.structuredDataService.upsertCategory(snapshot)),
    );
  }

  // 初始化现有分类的排序字段
  async initializeCategoriesSort() {
    const categories = (await this.getAllCategories(true)).map((item: any) =>
      this.toCategorySnapshot(item),
    );
    const categoriesNeedingSort = categories
      .map((category, index) => ({
        currentSort: category.sort,
        nextSnapshot: {
          ...category,
          sort: category.sort ?? index,
        },
      }))
      .filter((category) => category.currentSort === undefined || category.currentSort === null);

    await Promise.all(
      categoriesNeedingSort.map((category) =>
        this.categoryModal.updateOne(
          { name: category.nextSnapshot.name },
          { sort: category.nextSnapshot.sort },
        ),
      ),
    );
    await Promise.all(
      categoriesNeedingSort.map((category) =>
        this.structuredDataService.upsertCategory(category.nextSnapshot),
      ),
    );
  }
}
