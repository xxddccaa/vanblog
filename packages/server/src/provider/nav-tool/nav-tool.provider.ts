import { Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { NavTool } from 'src/scheme/nav-tool.schema';
import { NavCategory } from 'src/scheme/nav-category.schema';
import { CreateNavToolDto, UpdateNavToolDto, NavToolItem } from 'src/types/nav.dto';
import { StructuredDataService } from 'src/storage/structured-data.service';

@Injectable()
export class NavToolProvider {
  constructor(
    @InjectModel(NavTool.name)
    private navToolModel: Model<NavTool>,
    @InjectModel(NavCategory.name)
    private navCategoryModel: Model<NavCategory>,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  async getAllTools(): Promise<NavToolItem[]> {
    const pgTools = await this.structuredDataService.listNavTools();
    if (pgTools.length || this.structuredDataService.isInitialized()) {
      return pgTools as any;
    }
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
    const pgResult = await this.structuredDataService.getNavToolsPaginated(page, pageSize);
    if (pgResult.tools.length || pgResult.total || this.structuredDataService.isInitialized()) {
      return {
        tools: pgResult.tools as any,
        total: pgResult.total,
        page,
        pageSize,
      };
    }
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
    const pgTool = await this.structuredDataService.getNavToolById(id);
    if (pgTool || this.structuredDataService.isInitialized()) {
      return pgTool as any;
    }
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
    await this.structuredDataService.upsertNavTool(savedTool.toObject());
    return (await this.getToolById(savedTool._id.toString())) as NavToolItem;
  }

  async updateTool(id: string, toolDto: UpdateNavToolDto): Promise<NavToolItem> {
    const updatedTool = await this.navToolModel.findByIdAndUpdate(
      id,
      { ...toolDto, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedTool) {
      throw new Error(`工具 "${id}" 未找到`);
    }
    await this.structuredDataService.upsertNavTool(
      updatedTool.toObject ? updatedTool.toObject() : updatedTool,
    );
    return (await this.getToolById(updatedTool._id.toString())) as NavToolItem;
  }

  async deleteTool(id: string): Promise<void> {
    const result = await this.navToolModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new Error(`工具 "${id}" 未找到`);
    }
    await this.structuredDataService.deleteNavToolById(id);
  }

  async getToolsByCategory(categoryId: string): Promise<NavToolItem[]> {
    const pgTools = await this.structuredDataService.getNavToolsByCategory(categoryId);
    if (pgTools.length || this.structuredDataService.isInitialized()) {
      return pgTools as any;
    }
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
    await this.structuredDataService.refreshNavToolsFromRecordStore();
  }
} 
