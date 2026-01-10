import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MindMapDocument = MindMap & Document;

@Schema()
export class MindMap {
  @Prop({ required: true })
  title: string;

  @Prop({ type: String, default: '' })
  content: string; // JSON字符串，存储思维导图数据

  @Prop()
  author: string;

  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: Number, default: 0 })
  viewer: number; // 浏览量

  @Prop({ type: Boolean, default: false })
  deleted: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const MindMapSchema = SchemaFactory.createForClass(MindMap);

