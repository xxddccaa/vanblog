import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Icon } from 'src/scheme/icon.schema';
import { IconDto, IconItem } from 'src/types/icon.dto';

@Injectable()
export class IconProvider {
  constructor(
    @InjectModel(Icon.name)
    private iconModel: Model<Icon>,
  ) {}

  async getAllIcons(): Promise<IconItem[]> {
    const icons = await this.iconModel.find().sort({ createdAt: -1 }).exec();
    return icons.map(icon => ({
      name: icon.name,
      type: icon.type,
      iconUrl: icon.iconUrl,
      iconUrlDark: icon.iconUrlDark,
      presetIconType: icon.presetIconType,
      description: icon.description,
      createdAt: icon.createdAt,
      updatedAt: icon.updatedAt,
    }));
  }

  async getIconsPaginated(page: number = 1, pageSize: number = 10): Promise<{
    icons: IconItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const skip = (page - 1) * pageSize;
    const [icons, total] = await Promise.all([
      this.iconModel.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      this.iconModel.countDocuments().exec(),
    ]);

    return {
      icons: icons.map(icon => ({
        name: icon.name,
        type: icon.type,
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
    const icon = await this.iconModel.findOne({ name }).exec();
    if (!icon) return null;

    return {
      name: icon.name,
      type: icon.type,
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedIcon = await icon.save();
    return {
      name: savedIcon.name,
      type: savedIcon.type,
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
    ).exec();

    if (!updatedIcon) {
      throw new Error(`图标 "${name}" 未找到`);
    }

    return {
      name: updatedIcon.name,
      type: updatedIcon.type,
      iconUrl: updatedIcon.iconUrl,
      iconUrlDark: updatedIcon.iconUrlDark,
      presetIconType: updatedIcon.presetIconType,
      description: updatedIcon.description,
      createdAt: updatedIcon.createdAt,
      updatedAt: updatedIcon.updatedAt,
    };
  }

  async deleteIcon(name: string): Promise<void> {
    const result = await this.iconModel.deleteOne({ name }).exec();
    if (result.deletedCount === 0) {
      throw new Error(`图标 "${name}" 未找到`);
    }
  }

  async deleteAllIcons(): Promise<void> {
    await this.iconModel.deleteMany({}).exec();
  }
} 