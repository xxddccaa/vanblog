import { Prop, Schema, SchemaFactory } from 'src/storage/mongoose-compat';
import { Document } from 'src/storage/mongoose-compat';

export type DraftDocument = Draft & Document;

@Schema()
export class Draft extends Document {
  @Prop({ index: true, unique: true })
  id: number;

  @Prop({ index: true })
  title: string;

  @Prop({ default: '' })
  content: string;

  @Prop({ default: [], index: true })
  tags: string[];

  @Prop({ index: true })
  author: string;

  @Prop({ index: true })
  category: string;

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

export const DraftSchema = SchemaFactory.createForClass(Draft);
