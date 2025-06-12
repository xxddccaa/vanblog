import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TagDocument = Tag & Document;

@Schema()
export class Tag extends Document {
  @Prop({ index: true, unique: true })
  name: string;

  @Prop({ default: 0, index: true })
  articleCount: number;

  @Prop({ default: [], index: true })
  articleIds: number[];

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

export const TagSchema = SchemaFactory.createForClass(Tag);

// 创建复合索引以提高查询性能
TagSchema.index({ name: 1, articleCount: -1 });
TagSchema.index({ articleCount: -1, updatedAt: -1 }); 