import {
  Controller,
  Inject,
  Optional,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CommentImageProvider } from 'src/provider/comment/comment-image.provider';
import {
  CommentImageMultipartInterceptor,
  CommentImageUploadGuard,
} from 'src/provider/comment/comment-image-upload.guard';
import { commentError } from 'src/provider/comment/comment-request.service';
import {
  COMMENT_TARGET_RESOLVER,
  CommentImageResult,
  CommentTargetResolver,
} from 'src/types/comment.dto';

/**
 * Visitor image upload for the comment editor. Guard order matters: the
 * same-origin check, upload switch and rate limits run before the multipart
 * body is read; the target and the image itself are validated afterwards.
 */
@ApiTags('public comment')
@Controller('/api/public/comment')
export class CommentImageController {
  constructor(
    // Optional so the app still boots without the core provider; uploads then fail closed.
    @Optional()
    @Inject(COMMENT_TARGET_RESOLVER)
    private readonly targetResolver: CommentTargetResolver | null,
    private readonly imageProvider: CommentImageProvider,
  ) {}

  @Post('/image')
  @UseGuards(CommentImageUploadGuard)
  @UseInterceptors(CommentImageMultipartInterceptor)
  async upload(
    @Req() req: Request,
    @UploadedFile() file?: { buffer?: Buffer },
  ): Promise<{ statusCode: number; data: CommentImageResult }> {
    const target = (req.body as Record<string, unknown> | undefined)?.target;
    if (!this.targetResolver) {
      throw commentError(404, 'COMMENT_TARGET_UNAVAILABLE', 'Comments are not available');
    }
    await this.targetResolver.resolvePublicTarget(
      typeof target === 'string' ? target.trim() : target,
    );
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw commentError(400, 'COMMENT_IMAGE_INVALID', 'An image file is required');
    }
    const data = await this.imageProvider.store(file.buffer);
    return { statusCode: 200, data };
  }
}
