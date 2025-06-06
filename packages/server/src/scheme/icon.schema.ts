import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Icon extends Document {
  @Prop({ required: true, unique: true })
  name: string; // 图标名称，如 "wechat-qr-1"

  @Prop({ required: true })
  type: 'preset' | 'custom'; // 预设图标或自定义图标

  @Prop()
  iconUrl: string; // 图标URL（浅色主题）

  @Prop()
  iconUrlDark?: string; // 图标URL（深色主题，可选）

  @Prop()
  presetIconType?: string; // 预设图标类型（如果是预设图标）

  @Prop()
  description?: string; // 图标描述

  @Prop({
    default: () => {
      return new Date();
    },
  })
  createdAt: Date;

  @Prop({
    default: () => {
      return new Date();
    },
  })
  updatedAt: Date;
}

export const IconSchema = SchemaFactory.createForClass(Icon); 