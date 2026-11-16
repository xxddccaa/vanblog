import { Controller, Get, Optional, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { MetaProvider } from './provider/meta/meta.provider';
import { PublicMaskProvider } from './provider/public-mask/public-mask.provider';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly metaProvider: MetaProvider,
    @Optional() private readonly publicMaskProvider?: PublicMaskProvider,
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
    let favicon = String(siteInfo?.favicon || '').trim();
    if (favicon && this.publicMaskProvider) {
      // The redirect target is public; fall back to the default icon if it would
      // reveal a masked term.
      const masker = await this.publicMaskProvider.getMasker();
      if (masker.hasHit(favicon)) {
        favicon = '';
      }
    }

    res.redirect(favicon || '/admin/logo.svg');
  }
}
