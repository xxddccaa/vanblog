import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class NavTool extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  logo: string; // 图标URL或图标名称

  @Prop({ required: true })
  categoryId: string; // 分类ID

  @Prop()
  description: string;

  @Prop({ default: 0 })
  sort: number;

  @Prop({ default: false })
  hide: boolean;

  @Prop({ default: false })
  useCustomIcon: boolean; // 是否使用自定义图标

  @Prop()
  customIcon: string; // 自定义图标URL

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const NavToolSchema = SchemaFactory.createForClass(NavTool); 