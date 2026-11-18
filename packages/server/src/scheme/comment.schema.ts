import { Prop, Schema, SchemaFactory } from 'src/storage/mongoose-compat';
import { Document } from 'src/storage/mongoose-compat';
import type { CommentStatus, CommentTargetType } from 'src/types/comment.dto';

export type CommentDocument = Comment & Document;

/**
 * Stored comment. The record id (`_id`) is a random UUID; `id` is the public
 * numeric id reserved from the `vanblog_comments_id_seq` sequence.
 * See CommentRecord in src/types/comment.dto.ts for field semantics.
 */
@Schema()
export class Comment extends Document {
  @Prop({ index: true, unique: true })
  id: number;

  @Prop({ required: true, index: true })
  targetType: CommentTargetType;

  @Prop({ required: true, index: true })
  targetId: string;

  @Prop({ default: null, index: true })
  parentId: number | null;

  @Prop({ default: null, index: true })
  rootId: number | null;

  @Prop({ default: null })
  replyToNick: string | null;

  @Prop({ default: '' })
  nick: string;

  @Prop({ default: '' })
  mail: string;

  @Prop({ default: '' })
  link: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, index: true, default: 'pending' })
  status: CommentStatus;

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ default: false })
  pinned: boolean;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: '' })
  ip: string;

  @Prop({ default: '' })
  ua: string;

  @Prop({ default: '' })
  location: string;

  @Prop({ default: '' })
  browser: string;

  @Prop({ default: '' })
  os: string;

  @Prop({ default: () => [] })
  images: string[];

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

export const CommentSchema = SchemaFactory.createForClass(Comment);
