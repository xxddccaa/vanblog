import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SortOrder } from 'src/types/sort';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { CategoryProvider } from 'src/provider/category/category.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { TagProvider } from 'src/provider/tag/tag.provider';
import { VisitProvider } from 'src/provider/visit/visit.provider';
import { version } from 'src/utils/loadConfig';
import { CustomPageProvider } from 'src/provider/customPage/customPage.provider';
import { encode } from 'js-base64';
import { TokenProvider } from 'src/provider/token/token.provider';
import { IconProvider } from 'src/provider/icon/icon.provider';

@ApiTags('public')
@Controller('/api/public/')
export class PublicController {
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly tagProvider: TagProvider,
    private readonly metaProvider: MetaProvider,
    private readonly visitProvider: VisitProvider,
    private readonly settingProvider: SettingProvider,
    private readonly customPageProvider: CustomPageProvider,
    private readonly tokenProvider: TokenProvider,
    private readonly iconProvider: IconProvider,
  ) {}
  @Get('/customPage/all')
  async getAll() {
    return {
      statusCode: 200,
      data: await this.customPageProvider.getAll(),
    };
  }
  @Get('/customPage')
  async getOneByPath(@Query('path') path: string) {
    const data = await this.customPageProvider.getCustomPageByPath(path);

    return {
      statusCode: 200,
      data: {
        ...data,
        html: data?.html ? encode(data?.html) : '',
      },
    };
  }
  @Get('/article/:id')
  async getArticleByIdOrPathname(@Param('id') id: string) {
    const data = await this.articleProvider.getByIdOrPathnameWithPreNext(id, 'public');
    return {
      statusCode: 200,
      data: data,
    };
  }
  @Post('/article/:id')
  async getArticleByIdOrPathnameWithPassword(
    @Param('id') id: number | string,
    @Body() body: { password: string },
  ) {
    const data = await this.articleProvider.getByIdWithPassword(id, body?.password);
    return {
      statusCode: 200,
      data: data,
    };
  }

  @Post('/article/:id/admin')
  async getArticleByIdOrPathnameWithAdminToken(
    @Param('id') id: number | string,
    @Body() body: { token: string },
  ) {
    // 验证token是否有效
    const isValidToken = await this.tokenProvider.checkToken(body?.token);
    if (!isValidToken) {
      return {
        statusCode: 401,
        data: null,
        message: 'Invalid token',
      };
    }

    // 如果token有效，直接获取文章内容（使用admin视图）
    const data = await this.articleProvider.getByIdOrPathname(id, 'admin');
    if (data) {
      // 移除密码字段，使用类型断言处理mongoose文档
      const articleData = (data as any)?._doc || data;
      return {
        statusCode: 200,
        data: { ...articleData, password: undefined },
      };
    }
    return {
      statusCode: 404,
      data: null,
      message: 'Article not found',
    };
  }

  @Get('/search')
  async searchArticle(@Query('value') search: string) {
    const data = await this.articleProvider.searchByString(search, false);

    return {
      statusCode: 200,
      data: {
        total: data.length,
        data: this.articleProvider.toSearchResult(data),
      },
    };
  }
  @Post('/viewer')
  async addViewer(
    @Query('isNew') isNew: boolean,
    @Query('isNewByPath') isNewByPath: boolean,
    @Req() req: Request,
  ) {
    const refer = req.headers.referer;
    const url = new URL(refer);
    if (!url.pathname || url.pathname == '') {
      console.log('没找到 refer:', req.headers);
    }
    const data = await this.metaProvider.addViewer(
      isNew,
      decodeURIComponent(url.pathname),
      isNewByPath,
    );
    return {
      statusCode: 200,
      data: data,
    };
  }

  @Get('/viewer')
  async getViewer() {
    const data = await this.metaProvider.getViewer();
    return {
      statusCode: 200,
      data: data,
    };
  }
  @Get('/article/viewer/:id')
  async getViewerByArticleIdOrPathname(@Param('id') id: number | string) {
    const data = await this.visitProvider.getByArticleId(id);
    return {
      statusCode: 200,
      data: data,
    };
  }

  @Get('/tag/:name')
  async getArticlesByTagName(@Param('name') name: string) {
    const data = await this.tagProvider.getArticlesByTag(name, false);
    return {
      statusCode: 200,
      data: this.articleProvider.toPublic(data),
    };
  }
  @Get('article')
  async getByOption(
    @Query('page') page: number,
    @Query('pageSize') pageSize = 5,
    @Query('toListView') toListView = false,
    @Query('regMatch') regMatch = false,
    @Query('withWordCount') withWordCount = false,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('sortTop') sortTop?: SortOrder,
  ) {
    const option = {
      page: parseInt(page as any),
      pageSize: parseInt(pageSize as any),
      category,
      tags,
      toListView,
      regMatch,
      sortTop,
      sortCreatedAt,
      withWordCount,
    };
    // 三个 sort 是完全排他的。
    const data = await this.articleProvider.getByOption(option, true);
    return {
      statusCode: 200,
      data,
    };
  }
  @Get('timeline')
  async getTimeLineInfo() {
    const data = await this.articleProvider.getTimeLineInfo();
    return {
      statusCode: 200,
      data,
    };
  }
  @Get('category')
  async getArticlesByCategory() {
    const data = await this.categoryProvider.getCategoriesWithArticle(false);
    return {
      statusCode: 200,
      data,
    };
  }
  @Get('tag')
  async getArticlesByTag() {
    const data = await this.tagProvider.getTagsWithArticle(false);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/meta')
  async getBuildMeta() {
    const tags = await this.tagProvider.getAllTags(false);
    const meta = await this.metaProvider.getAll();
    const metaDoc = (meta as any)?._doc || meta;
    const categories = await this.categoryProvider.getAllCategories(false);
    const { data: menus } = await this.settingProvider.getMenuSetting();
    const totalArticles = await this.articleProvider.getTotalNum(false);
    const totalWordCount = await this.metaProvider.getTotalWords();
    const LayoutSetting = await this.settingProvider.getLayoutSetting();
    const LayoutRes = this.settingProvider.encodeLayoutSetting(LayoutSetting);
    
    // 获取包含图标数据的社交信息
    const socialsWithIcons = await this.metaProvider.getSocials();
    
    const data = {
      version: version,
      tags,
      meta: {
        ...metaDoc,
        categories,
        socials: socialsWithIcons, // 使用包含图标数据的社交信息
      },
      menus,
      totalArticles,
      totalWordCount,
      ...(LayoutSetting ? { layout: LayoutRes } : {}),
    };
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/icon')
  async getAllIcons() {
    const icons = await this.iconProvider.getAllIcons();
    return {
      statusCode: 200,
      data: icons,
    };
  }

  @Get('/icon/:name')
  async getIconByName(@Param('name') name: string) {
    try {
      const icon = await this.iconProvider.getIconByName(name);
      if (!icon) {
        return {
          statusCode: 404,
          message: '图标未找到',
        };
      }
      return {
        statusCode: 200,
        data: icon,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: error.message,
      };
    }
  }
}
