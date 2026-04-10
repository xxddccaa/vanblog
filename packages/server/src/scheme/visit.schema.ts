import { Prop, Schema, SchemaFactory } from 'src/storage/mongoose-compat';
import { Document } from 'src/storage/mongoose-compat';

export type VisitDocument = Visit & Document;

@Schema()
export class Visit extends Document {
  @Prop()
  visited: number;

  @Prop()
  viewer: number;

  @Prop({ index: true })
  date: string;

  @Prop({ index: true })
  pathname: string;

  @Prop({ index: true })
  lastVisitedTime: Date;

  @Prop({
    index: true,
    default: () => {
      return new Date();
    },
  })
  createdAt: Date;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
