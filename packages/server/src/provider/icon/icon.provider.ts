import { Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { Icon } from 'src/scheme/icon.schema';
import { IconDto, IconItem } from 'src/types/icon.dto';
import { StructuredDataService } from 'src/storage/structured-data.service';

@Injectable()
export class IconProvider {
  constructor(
    @InjectModel(Icon.name)
    private iconModel: Model<Icon>,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  async getAllIcons(usage?: 'nav' | 'social'): Promise<IconItem[]> {
    const pgIcons = await this.structuredDataService.listIcons(usage);
    if (pgIcons.length || this.structuredDataService.isInitialized()) {
      return pgIcons as any;
    }
    const filter = usage ? { usage } : {};
    const icons = await this.iconModel.find(filter).sort({ createdAt: -1 }).exec();
    return icons.map(icon => ({
      name: icon.name,
      type: icon.type,
      usage: icon.usage || 'social', // 向后兼容
      iconUrl: icon.iconUrl,
      iconUrlDark: icon.iconUrlDark,
      presetIconType: icon.presetIconType,
      description: icon.description,
      createdAt: icon.createdAt,
      updatedAt: icon.updatedAt,
    }));
  }

  async getIconsPaginated(page: number = 1, pageSize: number = 10, usage?: 'nav' | 'social'): Promise<{
    icons: IconItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const pgResult = await this.structuredDataService.getIconsPaginated(page, pageSize, usage);
    if (pgResult.icons.length || pgResult.total || this.structuredDataService.isInitialized()) {
      return {
        icons: pgResult.icons as any,
        total: pgResult.total,
        page,
        pageSize,
      };
    }
    const skip = (page - 1) * pageSize;
    const filter = usage ? { usage } : {};
    const [icons, total] = await Promise.all([
      this.iconModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      this.iconModel.countDocuments(filter).exec(),
    ]);

    return {
      icons: icons.map(icon => ({
        name: icon.name,
        type: icon.type,
        usage: icon.usage || 'social', // 向后兼容
        iconUrl: icon.iconUrl,
        iconUrlDark: icon.iconUrlDark,
        presetIconType: icon.presetIconType,
        description: icon.description,
        createdAt: icon.createdAt,
        updatedAt: icon.updatedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getIconByName(name: string): Promise<IconItem | null> {
    const pgIcon = await this.structuredDataService.getIconByName(name);
    if (pgIcon || this.structuredDataService.isInitialized()) {
      return pgIcon as any;
    }
    const icon = await this.iconModel.findOne({ name }).exec();
    if (!icon) return null;

    return {
      name: icon.name,
      type: icon.type,
      usage: icon.usage || 'social', // 向后兼容
      iconUrl: icon.iconUrl,
      iconUrlDark: icon.iconUrlDark,
      presetIconType: icon.presetIconType,
      description: icon.description,
      createdAt: icon.createdAt,
      updatedAt: icon.updatedAt,
    };
  }

  async createIcon(iconDto: IconDto): Promise<IconItem> {
    // 检查名称是否已存在
    const existingIcon = await this.iconModel.findOne({ name: iconDto.name }).exec();
    if (existingIcon) {
      throw new Error(`图标名称 "${iconDto.name}" 已存在`);
    }

    const icon = new this.iconModel({
      ...iconDto,
      usage: iconDto.usage || 'social', // 默认为social以保持兼容性
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedIcon = await icon.save();
    await this.structuredDataService.upsertIcon(savedIcon.toObject());
    return {
      name: savedIcon.name,
      type: savedIcon.type,
      usage: savedIcon.usage || 'social',
      iconUrl: savedIcon.iconUrl,
      iconUrlDark: savedIcon.iconUrlDark,
      presetIconType: savedIcon.presetIconType,
      description: savedIcon.description,
      createdAt: savedIcon.createdAt,
      updatedAt: savedIcon.updatedAt,
    };
  }

  async updateIcon(name: string, iconDto: Partial<IconDto>): Promise<IconItem> {
    const updatedIcon = await this.iconModel.findOneAndUpdate(
      { name },
      { ...iconDto, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedIcon) {
      throw new Error(`图标 "${name}" 未找到`);
    }
    await this.structuredDataService.upsertIcon(
      updatedIcon.toObject ? updatedIcon.toObject() : updatedIcon,
    );

    return {
      name: updatedIcon.name,
      type: updatedIcon.type,
      usage: updatedIcon.usage || 'social',
      iconUrl: updatedIcon.iconUrl,
      iconUrlDark: updatedIcon.iconUrlDark,
      presetIconType: updatedIcon.presetIconType,
      description: updatedIcon.description,
      createdAt: updatedIcon.createdAt,
      updatedAt: updatedIcon.updatedAt,
    };
  }

  async deleteIcon(name: string): Promise<void> {
    const result = await this.iconModel.deleteOne({ name });
    if (result.deletedCount === 0) {
      throw new Error(`图标 "${name}" 未找到`);
    }
    await this.structuredDataService.deleteIconByName(name);
  }

  async deleteAllIcons(): Promise<void> {
    await this.iconModel.deleteMany({});
    await this.structuredDataService.deleteAllIcons();
  }
} 
