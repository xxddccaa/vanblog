import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongoDocument } from 'mongoose';

@Schema()
export class Document extends MongoDocument {
  @Prop({ index: true, unique: true })
  id: number;

  @Prop({ index: true })
  title: string;

  @Prop({ default: '' })
  content: string;

  @Prop({ index: true })
  author: string;

  @Prop({ index: true, default: null })
  parent_id: number; // 父文档ID，null表示根节点

  @Prop({ index: true, default: null })
  library_id: number; // 所属文档库ID，null表示这是一个文档库

  @Prop({ index: true, enum: ['library', 'document'], default: 'document' })
  type: string; // library: 文档库, document: 文档

  @Prop({ default: [] })
  path: number[]; // 文档路径，用于层级导航

  @Prop({ default: 0 })
  sort_order: number; // 排序顺序

  @Prop({ default: false, index: true })
  deleted: boolean;

  @Prop({
    index: true,
    default: () => {
      return new Date();
    },
  })
  createdAt: Date;

  @Prop({
    index: true,
    default: () => {
      return new Date();
    },
  })
  updatedAt: Date;
}

export type DocumentDocument = Document & MongoDocument;
export const DocumentSchema = SchemaFactory.createForClass(Document); 