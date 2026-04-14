import { Controller, Get, HttpException, Param, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { CustomPageProvider } from 'src/provider/customPage/customPage.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { checkFolder } from 'src/utils/checkFolder';
import { normalizeCustomPageRoutePath, splitCustomPageRoutePath } from 'src/utils/customPagePath';

@ApiTags('c')
@Controller('c')
export class PublicCustomPageController {
  constructor(
    private readonly customPageProvider: CustomPageProvider,
    private readonly staticProvider: StaticProvider,
  ) {}

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
    if (!pathSegments.length) {
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
      res.send(cur.html);
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
