import { Prop, Schema, SchemaFactory } from 'src/storage/mongoose-compat';
import { Document } from 'src/storage/mongoose-compat';
import { Permission } from 'src/types/access/access';
export type UserType = 'admin' | 'collaborator';
export type UserDocument = User & Document;

@Schema()
export class User extends Document {
  @Prop({ index: true, unique: true })
  id: number;

  @Prop({ index: true })
  name: string;

  @Prop()
  password: string;

  @Prop({
    default: () => {
      return new Date();
    },
  })
  createdAt: Date;

  @Prop({ index: true })
  type: UserType;

  @Prop()
  nickname?: string;

  @Prop()
  permissions?: Permission[];

  @Prop({ index: true })
  salt: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
