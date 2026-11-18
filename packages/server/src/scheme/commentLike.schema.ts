import { Prop, Schema, SchemaFactory } from 'src/storage/mongoose-compat';
import { Document } from 'src/storage/mongoose-compat';

export type CommentLikeDocument = CommentLike & Document;

/**
 * One like from one anonymous browser identity.
 *
 * The record id (`_id`) must be `${commentId}:${actorHash}`. Because records
 * are upserted by id, liking twice writes the same row and stays idempotent.
 * `actorHash` is an HMAC of the random COMMENT_ACTOR_COOKIE value; the cookie
 * itself and the visitor IP are never stored here.
 */
@Schema()
export class CommentLike extends Document {
  @Prop({ required: true, index: true })
  commentId: number;

  @Prop({ required: true })
  actorHash: string;

  @Prop({
    default: () => {
      return new Date();
    },
  })
  createdAt: Date;
}

export const CommentLikeSchema = SchemaFactory.createForClass(CommentLike);

export const commentLikeRecordId = (commentId: number, actorHash: string) =>
  `${commentId}:${actorHash}`;
