import { Injectable } from '@nestjs/common';
import { CommentLifecycleHooks } from 'src/types/comment.dto';

/**
 * Default CommentLifecycleHooks used when no notification module is bound to
 * COMMENT_LIFECYCLE_HOOKS. The core provider injects the token optionally and
 * falls back to this class, so it never needs a null check.
 */
@Injectable()
export class NoopCommentLifecycleHooks implements CommentLifecycleHooks {
  afterCreate(): void {
    // Intentionally empty.
  }

  afterApprove(): void {
    // Intentionally empty.
  }
}
