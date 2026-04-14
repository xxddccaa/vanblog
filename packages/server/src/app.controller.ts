import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { MetaProvider } from './provider/meta/meta.provider';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly metaProvider: MetaProvider,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('favicon.ico')
  async getFavicon(@Res() res: Response) {
    return this.redirectToFavicon(res);
  }

  @Get('static/img/favicon.ico')
  async getRewrittenFavicon(@Res() res: Response) {
    return this.redirectToFavicon(res);
  }

  private async redirectToFavicon(res: Response) {
    const siteInfo = await this.metaProvider.getSiteInfo();
    const favicon = String(siteInfo?.favicon || '').trim();

    res.redirect(favicon || '/admin/logo.svg');
  }
}
