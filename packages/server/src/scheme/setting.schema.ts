import { Prop, Schema, SchemaFactory } from 'src/storage/mongoose-compat';
import { Document, SchemaTypes } from 'src/storage/mongoose-compat';
import { SettingType, SettingValue } from 'src/types/setting.dto';

export type SettingDocument = Setting & Document;

@Schema()
export class Setting extends Document {
  @Prop({ default: 'static', index: true, unique: true })
  type: SettingType;

  @Prop({ type: SchemaTypes.Mixed })
  value: SettingValue;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
