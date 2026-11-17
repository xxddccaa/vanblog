import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { config } from 'src/config';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { CommentRequestService } from 'src/provider/comment/comment-request.service';
import { CommentProvider } from 'src/provider/comment/comment.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { ApiToken } from 'src/provider/swagger/token';

const isDemoSite = () => config?.demo == true || config?.demo == 'true';

const DEMO_BLOCKED = { statusCode: 401, message: '演示站禁止修改评论！' };

/** Comment moderation; super admin only (see superAdminOnlyRoutePrefixes). */
@ApiTags('comment')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/comment')
export class CommentController {
  constructor(
    private readonly commentProvider: CommentProvider,
    private readonly settingProvider: SettingProvider,
    private readonly requestService: CommentRequestService,
  ) {}

  @Get('/')
  async list(@Query() query: Record<string, unknown>) {
    const data = await this.commentProvider.listAdmin(query || {});
    return { statusCode: 200, data };
  }

  @Get('/stats')
  async stats() {
    const data = await this.commentProvider.getStats();
    return { statusCode: 200, data };
  }

  @Get('/setting')
  async getSetting() {
    const data = await this.settingProvider.getAdminCommentSetting();
    return { statusCode: 200, data };
  }

  @Put('/setting')
  async updateSetting(@Body() body: unknown) {
    if (isDemoSite()) return DEMO_BLOCKED;
    const data = await this.settingProvider.updateCommentSetting(body);
    this.commentProvider.afterSettingChanged();
    return { statusCode: 200, data };
  }

  @Post('/batch')
  @HttpCode(200)
  async batch(@Body() body: unknown) {
    if (isDemoSite()) return DEMO_BLOCKED;
    const data = await this.commentProvider.batch(body);
    return { statusCode: 200, data };
  }

  @Patch('/:id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    if (isDemoSite()) return DEMO_BLOCKED;
    const data = await this.commentProvider.updateAdmin(id, body);
    return { statusCode: 200, data };
  }

  @Delete('/:id/purge')
  async purge(@Param('id') id: string) {
    if (isDemoSite()) return DEMO_BLOCKED;
    const data = await this.commentProvider.purge(id);
    return { statusCode: 200, data };
  }

  @Delete('/:id')
  async remove(@Param('id') id: string) {
    if (isDemoSite()) return DEMO_BLOCKED;
    const data = await this.commentProvider.softDelete(id);
    return { statusCode: 200, data };
  }

  @Post('/:id/reply')
  @HttpCode(200)
  async reply(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    if (isDemoSite()) return DEMO_BLOCKED;
    const user: any = (req as any).user || {};
    const admin = await this.requestService.getSuperAdmin(req);
    const nick = String(admin?.nick || user.nickname || user.name || '').trim();
    const data = await this.commentProvider.replyAsAdmin(id, body, {
      nick,
      ip: this.requestService.requestIp(req),
      ua: this.requestService.userAgent(req),
    });
    return { statusCode: 200, data };
  }
}
