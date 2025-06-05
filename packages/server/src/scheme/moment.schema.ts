import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MomentDocument = Moment & Document;

@Schema()
export class Moment extends Document {
  @Prop({ index: true, unique: true })
  id: number;

  @Prop({ required: true })
  content: string;

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

export const MomentSchema = SchemaFactory.createForClass(Moment); 