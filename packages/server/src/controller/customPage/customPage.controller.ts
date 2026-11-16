import { Controller, Get, HttpException, Optional, Param, Req, Res } from '@nestjs/common';
import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { CustomPageProvider } from 'src/provider/customPage/customPage.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { checkFolder } from 'src/utils/checkFolder';
import { normalizeCustomPageRoutePath, splitCustomPageRoutePath } from 'src/utils/customPagePath';
import { PublicMaskProvider } from 'src/provider/public-mask/public-mask.provider';
import { PUBLIC_STATIC_MAX_MASKED_BYTES } from 'src/provider/public-mask/public-static.middleware';
import {
  INACTIVE_PUBLIC_MASKER,
  isMaskableTextFile,
  maskTextFileContent,
  PublicMasker,
} from 'src/utils/publicMask';

@ApiTags('c')
@Controller('c')
export class PublicCustomPageController {
  constructor(
    private readonly customPageProvider: CustomPageProvider,
    private readonly staticProvider: StaticProvider,
    @Optional() private readonly publicMaskProvider?: PublicMaskProvider,
  ) {}

  /** Sends a masked text asset of a folder page. Returns false when it is not text. */
  private async sendMaskedAsset(
    absPath: string,
    masker: PublicMasker,
    req: Request,
    res: Response,
  ) {
    if (!masker.active || !isMaskableTextFile(absPath)) {
      return false;
    }
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(absPath);
    } catch {
      return false;
    }
    if (!stat.isFile()) {
      return false;
    }
    if (stat.size > PUBLIC_STATIC_MAX_MASKED_BYTES) {
      res.status(404).send('未找到该页面！');
      return true;
    }
    const content = await fs.promises.readFile(absPath, 'utf8');
    const masked = this.publicMaskProvider.maskCached(
      masker,
      `customPage:${absPath}:${stat.mtimeMs}:${stat.size}`,
      content,
      (text) => maskTextFileContent(text, absPath, masker),
    );
    const etag = `"${createHash('sha1').update(masked).digest('hex')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.type(path.extname(absPath));
    if (String(req.headers['if-none-match'] || '').includes(etag)) {
      res.status(304).end();
      return true;
    }
    res.status(200).send(masked);
    return true;
  }

  @Get('/*pathname')
  async getPageContent(
    @Param('pathname') pathname: string | string[],
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const requestedPath = normalizeCustomPageRoutePath(
      Array.isArray(pathname) ? pathname.join('/') : pathname,
    );
    const pathSegments = splitCustomPageRoutePath(requestedPath);
    // Custom pages write to the raw response, so masking happens here rather than in
    // the public interceptor. Throws 503 when masking rules cannot compile.
    const masker = this.publicMaskProvider
      ? await this.publicMaskProvider.getMasker()
      : INACTIVE_PUBLIC_MASKER;
    if (!pathSegments.length || masker.hasHit(requestedPath)) {
      res.status(404);
      throw new HttpException('未找到该页面！', 404);
    }

    let cur = await this.customPageProvider.getCustomPageByPath(requestedPath);
    let folderRoutePath = cur?.type === 'folder' ? requestedPath : null;
    let relativeAssetPath = '';

    if (!cur) {
      for (let index = pathSegments.length - 1; index >= 1; index--) {
        const candidate = `/${pathSegments.slice(0, index).join('/')}`;
        const page = await this.customPageProvider.getCustomPageByPath(candidate);
        if (page?.type === 'folder') {
          cur = page;
          folderRoutePath = candidate;
          relativeAssetPath = pathSegments.slice(index).join('/');
          break;
        }
      }
    }

    if (!cur) {
      res.status(404);
      throw new HttpException('未找到该页面！', 404);
    }
    if (cur.type == 'file' && !cur.html) {
      res.status(404);
      throw new HttpException('未找到该页面！', 404);
    } else if (cur.type == 'file' && cur.html) {
      res.status(200);
      res.send(
        masker.active
          ? this.publicMaskProvider.maskCached(
              masker,
              `customPage:${cur.path}:${cur.updatedAt || ''}`,
              cur.html,
            )
          : cur.html,
      );
      return;
    } else if (cur.type == 'folder') {
      const reqPath = req.path || req.url;
      if (!relativeAssetPath && !reqPath.endsWith('/')) {
        res.redirect(302, `${reqPath}/`);
        return;
      }

      let assetPath = relativeAssetPath;
      if (!assetPath) {
        assetPath = 'index.html';
      } else {
        const lastString = assetPath.split('/').pop() || '';
        if (!lastString.includes('.')) {
          const directoryPath = this.staticProvider.resolveCustomPageAssetPath(
            folderRoutePath || requestedPath,
            assetPath,
          );
          if (checkFolder(directoryPath)) {
            res.redirect(302, `${reqPath}/`);
            return;
          }
        }
      }

      const absPath = this.staticProvider.resolveCustomPageAssetPath(
        folderRoutePath || requestedPath,
        assetPath,
      );
      if (await this.sendMaskedAsset(absPath, masker, req, res)) {
        return;
      }
      res.sendFile(absPath, (error) => {
        if (error) {
          const statusCode = (error as any)?.statusCode || 404;
          if (!res.headersSent) {
            res.status(statusCode).send('未找到该页面！');
          }
          return;
        }
      });
      return;
    }
    res.status(404);
    throw new HttpException('未找到该页面！', 404);
  }
}

@Controller('custom')
export class PublicOldCustomPageRedirectController {
  @Get('/*pathname')
  async redirect(@Res() res: Response, @Req() req: Request) {
    const newUrl = req.url.replace('/custom/', '/c/');
    res.redirect(301, newUrl);
    return;
  }
}
