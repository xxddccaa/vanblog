import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NavCategory } from 'src/scheme/nav-category.schema';
import { NavTool } from 'src/scheme/nav-tool.schema';
import { CreateNavCategoryDto, UpdateNavCategoryDto, NavCategoryItem } from 'src/types/nav.dto';

@Injectable()
export class NavCategoryProvider {
  constructor(
    @InjectModel(NavCategory.name)
    private navCategoryModel: Model<NavCategory>,
    @InjectModel(NavTool.name)
    private navToolModel: Model<NavTool>,
  ) {}

  async getAllCategories(): Promise<NavCategoryItem[]> {
    const categories = await this.navCategoryModel.find().sort({ sort: 1, createdAt: -1 }).exec();
    
    // 计算每个分类下的工具数量
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const toolCount = await this.navToolModel.countDocuments({ categoryId: category._id.toString() }).exec();
        return {
          _id: category._id.toString(),
          name: category.name,
          description: category.description,
          sort: category.sort,
          hide: category.hide,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          toolCount,
        };
      })
    );

    return categoriesWithCount;
  }

  async getCategoriesPaginated(page: number = 1, pageSize: number = 10): Promise<{
    categories: NavCategoryItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const skip = (page - 1) * pageSize;
    const [categories, total] = await Promise.all([
      this.navCategoryModel.find().sort({ sort: 1, createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      this.navCategoryModel.countDocuments().exec(),
    ]);

    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const toolCount = await this.navToolModel.countDocuments({ categoryId: category._id.toString() }).exec();
        return {
          _id: category._id.toString(),
          name: category.name,
          description: category.description,
          sort: category.sort,
          hide: category.hide,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          toolCount,
        };
      })
    );

    return {
      categories: categoriesWithCount,
      total,
      page,
      pageSize,
    };
  }

  async getCategoryById(id: string): Promise<NavCategoryItem | null> {
    const category = await this.navCategoryModel.findById(id).exec();
    if (!category) return null;

    const toolCount = await this.navToolModel.countDocuments({ categoryId: id }).exec();

    return {
      _id: category._id.toString(),
      name: category.name,
      description: category.description,
      sort: category.sort,
      hide: category.hide,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      toolCount,
    };
  }

  async createCategory(categoryDto: CreateNavCategoryDto): Promise<NavCategoryItem> {
    // 检查名称是否已存在
    const existingCategory = await this.navCategoryModel.findOne({ name: categoryDto.name }).exec();
    if (existingCategory) {
      throw new Error(`分类名称 "${categoryDto.name}" 已存在`);
    }

    const category = new this.navCategoryModel({
      ...categoryDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedCategory = await category.save();
    return {
      _id: savedCategory._id.toString(),
      name: savedCategory.name,
      description: savedCategory.description,
      sort: savedCategory.sort,
      hide: savedCategory.hide,
      createdAt: savedCategory.createdAt,
      updatedAt: savedCategory.updatedAt,
      toolCount: 0,
    };
  }

  async updateCategory(id: string, categoryDto: UpdateNavCategoryDto): Promise<NavCategoryItem> {
    // 如果更新名称，检查新名称是否已存在
    if (categoryDto.name) {
      const existingCategory = await this.navCategoryModel.findOne({ 
        name: categoryDto.name, 
        _id: { $ne: id } 
      }).exec();
      if (existingCategory) {
        throw new Error(`分类名称 "${categoryDto.name}" 已存在`);
      }
    }

    const updatedCategory = await this.navCategoryModel.findByIdAndUpdate(
      id,
      { ...categoryDto, updatedAt: new Date() },
      { new: true }
    ).exec();

    if (!updatedCategory) {
      throw new Error(`分类 "${id}" 未找到`);
    }

    const toolCount = await this.navToolModel.countDocuments({ categoryId: id }).exec();

    return {
      _id: updatedCategory._id.toString(),
      name: updatedCategory.name,
      description: updatedCategory.description,
      sort: updatedCategory.sort,
      hide: updatedCategory.hide,
      createdAt: updatedCategory.createdAt,
      updatedAt: updatedCategory.updatedAt,
      toolCount,
    };
  }

  async deleteCategory(id: string): Promise<void> {
    // 检查分类下是否有工具
    const toolCount = await this.navToolModel.countDocuments({ categoryId: id }).exec();
    if (toolCount > 0) {
      throw new Error(`无法删除分类，该分类下还有 ${toolCount} 个工具`);
    }

    const result = await this.navCategoryModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new Error(`分类 "${id}" 未找到`);
    }
  }

  async updateCategoriesSort(categories: Array<{ id: string; sort: number }>): Promise<void> {
    const bulkOps = categories.map(category => ({
      updateOne: {
        filter: { _id: category.id },
        update: { sort: category.sort, updatedAt: new Date() }
      }
    }));

    await this.navCategoryModel.bulkWrite(bulkOps);
  }
} 