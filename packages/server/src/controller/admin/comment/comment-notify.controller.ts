import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { config } from 'src/config';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { CommentNotifyProvider } from 'src/provider/comment/comment-notify.provider';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('comment')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/comment/notify')
export class CommentNotifyController {
  constructor(private readonly notifyProvider: CommentNotifyProvider) {}

  /** Sends a test email synchronously with the stored SMTP setting. */
  @Post('/test')
  async sendTest(@Body() body: { to?: unknown }) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    await this.notifyProvider.sendTestMail(body?.to);
    return {
      statusCode: 200,
      data: { sent: true },
    };
  }
}
