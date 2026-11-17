import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import multer from 'multer';
import { Observable } from 'rxjs';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { COMMENT_LIMITS } from 'src/types/comment.dto';
import { CommentRequestService, commentError } from './comment-request.service';

/** Request property set by the guard: who is uploading. */
export const COMMENT_IMAGE_UPLOADER = Symbol('comment-image-uploader');

export interface CommentImageUploader {
  admin: boolean;
}

/** Multipart limits: one small file plus the `target` field, nothing else. */
export const COMMENT_IMAGE_MULTIPART_LIMITS = {
  fileSize: COMMENT_LIMITS.imageMaxBytes,
  files: 1,
  fields: 4,
  parts: 6,
  fieldNameSize: 32,
  fieldSize: 256,
  headerPairs: 20,
} as const;

/**
 * Runs before the multipart body is parsed, so rejected requests never get a
 * buffer allocated: same-origin check, the visitor upload switch and the rate
 * limits. A logged-in super admin bypasses the switch and the limits.
 */
@Injectable()
export class CommentImageUploadGuard implements CanActivate {
  constructor(
    private readonly requestService: CommentRequestService,
    private readonly settingProvider: SettingProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    this.requestService.assertSameOrigin(req);
    const admin = Boolean(await this.requestService.getSuperAdmin(req));
    if (!admin) {
      const setting = await this.settingProvider.getCommentSetting();
      if (setting.allowVisitorImage === false) {
        throw commentError(403, 'COMMENT_IMAGE_DISABLED', 'Visitor image uploads are disabled');
      }
      const visitor = this.requestService.visitorKey(req);
      await this.requestService.consume('imagePerVisitorHour', visitor);
      await this.requestService.consume('imagePerVisitorDay', visitor);
      await this.requestService.consume('imageGlobalHour', 'global');
    }
    const uploader: CommentImageUploader = { admin };
    (req as any)[COMMENT_IMAGE_UPLOADER] = uploader;
    return true;
  }
}

/** Maps multer and busboy failures to coded comment errors. */
export function mapMultipartError(error: any): HttpException {
  if (error instanceof HttpException) return error;
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return commentError(413, 'COMMENT_IMAGE_TOO_LARGE', 'The image file is too large');
  }
  return commentError(400, 'COMMENT_IMAGE_INVALID', 'The upload could not be read');
}

const parseSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { ...COMMENT_IMAGE_MULTIPART_LIMITS },
}).single('file');

/**
 * Parses `multipart/form-data` with a memory storage and tight limits. Used
 * instead of FileInterceptor so limit errors carry comment error codes.
 */
@Injectable()
export class CommentImageMultipartInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    await new Promise<void>((resolve, reject) => {
      parseSingleImage(req, res, (error?: unknown) => {
        if (error) reject(mapMultipartError(error));
        else resolve();
      });
    });
    return next.handle();
  }
}
