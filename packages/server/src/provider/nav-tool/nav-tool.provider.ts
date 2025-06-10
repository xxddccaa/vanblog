import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NavTool } from 'src/scheme/nav-tool.schema';
import { NavCategory } from 'src/scheme/nav-category.schema';
import { CreateNavToolDto, UpdateNavToolDto, NavToolItem } from 'src/types/nav.dto';

@Injectable()
export class NavToolProvider {
  constructor(
    @InjectModel(NavTool.name)
    private navToolModel: Model<NavTool>,
    @InjectModel(NavCategory.name)
    private navCategoryModel: Model<NavCategory>,
  ) {}

  async getAllTools(): Promise<NavToolItem[]> {
    const tools = await this.navToolModel.find().sort({ sort: 1, createdAt: -1 }).exec();
    const categories = await this.navCategoryModel.find().exec();
    
    return tools.map(tool => {
      const category = categories.find(cat => cat._id.toString() === tool.categoryId);
      return {
        _id: tool._id.toString(),
        name: tool.name,
        url: tool.url,
        logo: tool.logo,
        categoryId: tool.categoryId,
        categoryName: category?.name,
        description: tool.description,
        sort: tool.sort,
        hide: tool.hide,
        useCustomIcon: tool.useCustomIcon,
        customIcon: tool.customIcon,
        createdAt: tool.createdAt,
        updatedAt: tool.updatedAt,
      };
    });
  }

  async getToolsPaginated(page: number = 1, pageSize: number = 10): Promise<{
    tools: NavToolItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const skip = (page - 1) * pageSize;
    const [tools, total] = await Promise.all([
      this.navToolModel.find().sort({ sort: 1, createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      this.navToolModel.countDocuments().exec(),
    ]);

    const categories = await this.navCategoryModel.find().exec();

    return {
      tools: tools.map(tool => {
        const category = categories.find(cat => cat._id.toString() === tool.categoryId);
        return {
          _id: tool._id.toString(),
          name: tool.name,
          url: tool.url,
          logo: tool.logo,
          categoryId: tool.categoryId,
          categoryName: category?.name,
          description: tool.description,
          sort: tool.sort,
          hide: tool.hide,
          useCustomIcon: tool.useCustomIcon,
          customIcon: tool.customIcon,
          createdAt: tool.createdAt,
          updatedAt: tool.updatedAt,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async getToolById(id: string): Promise<NavToolItem | null> {
    const tool = await this.navToolModel.findById(id).exec();
    if (!tool) return null;

    const category = await this.navCategoryModel.findById(tool.categoryId).exec();

    return {
      _id: tool._id.toString(),
      name: tool.name,
      url: tool.url,
      logo: tool.logo,
      categoryId: tool.categoryId,
      categoryName: category?.name,
      description: tool.description,
      sort: tool.sort,
      hide: tool.hide,
      useCustomIcon: tool.useCustomIcon,
      customIcon: tool.customIcon,
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
    };
  }

  async createTool(toolDto: CreateNavToolDto): Promise<NavToolItem> {
    const tool = new this.navToolModel({
      ...toolDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedTool = await tool.save();
    const category = await this.navCategoryModel.findById(savedTool.categoryId).exec();

    return {
      _id: savedTool._id.toString(),
      name: savedTool.name,
      url: savedTool.url,
      logo: savedTool.logo,
      categoryId: savedTool.categoryId,
      categoryName: category?.name,
      description: savedTool.description,
      sort: savedTool.sort,
      hide: savedTool.hide,
      useCustomIcon: savedTool.useCustomIcon,
      customIcon: savedTool.customIcon,
      createdAt: savedTool.createdAt,
      updatedAt: savedTool.updatedAt,
    };
  }

  async updateTool(id: string, toolDto: UpdateNavToolDto): Promise<NavToolItem> {
    const updatedTool = await this.navToolModel.findByIdAndUpdate(
      id,
      { ...toolDto, updatedAt: new Date() },
      { new: true }
    ).exec();

    if (!updatedTool) {
      throw new Error(`工具 "${id}" 未找到`);
    }

    const category = await this.navCategoryModel.findById(updatedTool.categoryId).exec();

    return {
      _id: updatedTool._id.toString(),
      name: updatedTool.name,
      url: updatedTool.url,
      logo: updatedTool.logo,
      categoryId: updatedTool.categoryId,
      categoryName: category?.name,
      description: updatedTool.description,
      sort: updatedTool.sort,
      hide: updatedTool.hide,
      useCustomIcon: updatedTool.useCustomIcon,
      customIcon: updatedTool.customIcon,
      createdAt: updatedTool.createdAt,
      updatedAt: updatedTool.updatedAt,
    };
  }

  async deleteTool(id: string): Promise<void> {
    const result = await this.navToolModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new Error(`工具 "${id}" 未找到`);
    }
  }

  async getToolsByCategory(categoryId: string): Promise<NavToolItem[]> {
    const tools = await this.navToolModel.find({ categoryId }).sort({ sort: 1, createdAt: -1 }).exec();
    const category = await this.navCategoryModel.findById(categoryId).exec();

    return tools.map(tool => ({
      _id: tool._id.toString(),
      name: tool.name,
      url: tool.url,
      logo: tool.logo,
      categoryId: tool.categoryId,
      categoryName: category?.name,
      description: tool.description,
      sort: tool.sort,
      hide: tool.hide,
      useCustomIcon: tool.useCustomIcon,
      customIcon: tool.customIcon,
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
    }));
  }

  async updateToolsSort(tools: Array<{ id: string; sort: number }>): Promise<void> {
    const bulkOps = tools.map(tool => ({
      updateOne: {
        filter: { _id: tool.id },
        update: { sort: tool.sort, updatedAt: new Date() }
      }
    }));

    await this.navToolModel.bulkWrite(bulkOps);
  }
} 