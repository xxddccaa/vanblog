import {
  Body,
  Controller,
  Get,
  HttpCode,
  Optional,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CommentRequestService } from 'src/provider/comment/comment-request.service';
import { CommentProvider } from 'src/provider/comment/comment.provider';
import { PrivateSiteProvider } from 'src/provider/private-site/private-site.provider';
import { COMMENT_ACTOR_COOKIE } from 'src/types/comment.dto';
import {
  commentActorCookieOptions,
  createCommentActorToken,
  isSecureCommentRequest,
  readCommentActorToken,
} from 'src/utils/commentActor';

/** Responses that depend on the caller's cookies must never be shared by a cache. */
const setNoStore = (res?: Response) => {
  if (!res) return;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
};

/** Public comment API; the private-site middleware gates every route here. */
@ApiTags('public comment')
@Controller('/api/public/comment')
export class PublicCommentController {
  constructor(
    private readonly commentProvider: CommentProvider,
    private readonly requestService: CommentRequestService,
    @Optional() private readonly privateSiteProvider?: PrivateSiteProvider,
  ) {}

  /**
   * Counts a read against the visitor's budget. The website's own server-side
   * requests all come from one address, so they are exempt.
   */
  private async consumeRead(req: Request) {
    if (this.privateSiteProvider?.isInternalRequest(req)) return;
    await this.requestService.consume('readPerVisitorMinute', this.requestService.visitorKey(req));
  }

  @Get('/')
  async list(
    @Query('target') target: unknown,
    @Query('page') page: unknown,
    @Query('sort') sort: unknown,
    @Req() req: Request,
  ) {
    await this.consumeRead(req);
    const data = await this.commentProvider.listPublic({ target, page, sort });
    return { statusCode: 200, data };
  }

  @Get('/count')
  async count(@Query('targets') targets: unknown, @Req() req: Request) {
    await this.consumeRead(req);
    const data = await this.commentProvider.countPublic(targets);
    return { statusCode: 200, data };
  }

  @Get('/identity')
  async identity(@Req() req: Request, @Res({ passthrough: true }) res?: Response) {
    setNoStore(res);
    await this.commentProvider.assertCommentsEnabled();
    const admin = await this.requestService.getSuperAdmin(req);
    return {
      statusCode: 200,
      data: admin ? { admin: true, nick: admin.nick } : { admin: false },
    };
  }

  @Get('/liked')
  async liked(
    @Query('ids') ids: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    setNoStore(res);
    const data = await this.commentProvider.likedIds(ids, readCommentActorToken(req));
    return { statusCode: 200, data };
  }

  @Post('/')
  @HttpCode(200)
  async create(@Body() body: unknown, @Req() req: Request) {
    this.requestService.assertJson(req);
    this.requestService.assertSameOrigin(req);
    const admin = await this.requestService.getSuperAdmin(req);
    const data = await this.commentProvider.create(body, {
      admin,
      ip: this.requestService.requestIp(req),
      ua: this.requestService.userAgent(req),
      visitorKey: this.requestService.visitorKey(req),
    });
    return { statusCode: 200, data };
  }

  @Post('/:id/like')
  @HttpCode(200)
  async like(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    this.requestService.assertJson(req);
    this.requestService.assertSameOrigin(req);
    const existing = readCommentActorToken(req);
    const actorToken = existing || createCommentActorToken();
    const data = await this.commentProvider.toggleLike(id, {
      actorToken,
      visitorKey: this.requestService.visitorKey(req),
    });
    if (!existing && res) {
      // The identity is only issued once a like has actually been stored.
      res.cookie(
        COMMENT_ACTOR_COOKIE,
        actorToken,
        commentActorCookieOptions(isSecureCommentRequest(req)),
      );
    }
    return { statusCode: 200, data };
  }
}
