import { Injectable, NotAcceptableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ArticleProvider } from '../article/article.provider';
import { CategoryDocument } from 'src/scheme/category.schema';
import { sleep } from 'src/utils/sleep';
import { UpdateCategoryDto, UpdateCategorySortDto } from 'src/types/category.dto';

@Injectable()
export class CategoryProvider {
  idLock = false;
  constructor(
    @InjectModel('Category') private categoryModal: Model<CategoryDocument>,
    private readonly articleProvider: ArticleProvider,
  ) {}
  async getCategoriesWithArticle(includeHidden: boolean) {
    const allArticles = await this.articleProvider.getAll('list', includeHidden);
    const categories = await this.getAllCategories();
    const data = {};
    categories.forEach((c) => {
      data[c] = [];
    });
    allArticles.forEach((a) => {
      data[a.category]?.push(a);
    });
    return data;
  }
  async getPieData() {
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
    const d = await this.categoryModal.find({}).sort({ sort: 1, id: 1 });
    if (!d || !d.length) {
      return [];
    }
    if (all) return d;
    else return d.map((item) => item.name);
  }

  async getArticlesByCategory(name: string, includeHidden: boolean) {
    const d = await this.getCategoriesWithArticle(includeHidden);
    return d[name] ?? [];
  }

  async addOne(name: string) {
    const existData = await this.categoryModal.findOne({
      name,
    });
    if (existData) {
      throw new NotAcceptableException('分类名重复，无法创建！');
    } else {
      // 获取当前最大排序值
      const maxSortCategory = await this.categoryModal.findOne({}).sort({ sort: -1 });
      const newSort = maxSortCategory ? maxSortCategory.sort + 1 : 0;
      
      await this.categoryModal.create({
        id: await this.getNewId(),
        name,
        type: 'category',
        private: false,
        sort: newSort,
      });
    }
  }

  async getNewId() {
    while (this.idLock) {
      await sleep(10);
    }
    this.idLock = true;
    const maxObj = await this.categoryModal.find({}).sort({ id: -1 }).limit(1);
    let res = 1;
    if (maxObj.length) {
      res = maxObj[0].id + 1;
    }
    this.idLock = false;
    return res;
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
  }

  async updateCategoryByName(name: string, dto: UpdateCategoryDto) {
    if (Object.keys(dto).length == 0) {
      throw new NotAcceptableException('无有效信息，无法修改！');
    }
    if (dto.name && name != dto.name) {
      const existData = await this.categoryModal.findOne({
        name: dto.name,
      });
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
    await this.categoryModal.updateOne(
      {
        name: name,
      },
      {
        ...dto,
      },
    );
  }

  async updateCategoriesSort(dto: UpdateCategorySortDto) {
    const { categories } = dto;
    
    for (const categoryUpdate of categories) {
      await this.categoryModal.updateOne(
        { name: categoryUpdate.name },
        { sort: categoryUpdate.sort }
      );
    }
  }

  // 初始化现有分类的排序字段
  async initializeCategoriesSort() {
    const categories = await this.categoryModal.find({}).sort({ id: 1 });
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      if (category.sort === undefined || category.sort === null) {
        await this.categoryModal.updateOne(
          { _id: category._id },
          { sort: i }
        );
      }
    }
  }
}
