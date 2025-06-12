import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { config } from 'src/config';
import { CreateArticleDto, UpdateArticleDto } from 'src/types/article.dto';
import { SortOrder } from 'src/types/sort';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { PipelineProvider } from 'src/provider/pipeline/pipeline.provider';
import { ApiToken } from 'src/provider/swagger/token';
@ApiTags('article')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/article')
export class ArticleController {
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly isrProvider: ISRProvider,
    private readonly pipelineProvider: PipelineProvider,
  ) {}

  @Get('/')
  async getByOption(
    @Query('page') page: number,
    @Query('pageSize') pageSize = 5,
    @Query('toListView') toListView = false,
    @Query('regMatch') regMatch = true,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('title') title?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('sortTop') sortTop?: SortOrder,
    @Query('sortViewer') sortViewer?: SortOrder,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const option = {
      page: parseInt(page as any),
      pageSize: parseInt(pageSize as any),
      category,
      tags,
      title,
      sortCreatedAt,
      sortTop,
      startTime,
      endTime,
      toListView,
      regMatch,
      sortViewer,
    };
    const data = await this.articleProvider.getByOption(option, false);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/:id')
  async getOneByIdOrPathname(@Param('id') id: string) {
    const data = await this.articleProvider.getByIdOrPathname(id, 'admin');
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:id')
  async updateArticle(@Param('id') id: number, @Body() updateArticleDto: UpdateArticleDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    // 获取更新前的文章信息，用于增量渲染比较
    const beforeObj = await this.articleProvider.getById(id, 'admin');
    const data = await this.articleProvider.updateById(id, updateArticleDto);
    
    // 使用精确的增量渲染，而不是全量渲染
    this.isrProvider.activeArticleById(id, 'update', beforeObj);
    return {
      statusCode: 200,
      data,
    };
  }

  @Post()
  async createArticle(@Body() createArticleDto: CreateArticleDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.articleProvider.create(createArticleDto);
    
    // 使用精确的增量渲染，而不是全量渲染
    this.isrProvider.activeArticleById(data.id, 'create');
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('searchByLink')
  async searchArtcilesByLink(@Body() searchDto: { link: string }) {
    const data = await this.articleProvider.searchArticlesByLink(searchDto?.link || '');
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:id')
  async deleteArticle(@Param('id') id: number) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    // 获取删除前的文章信息，用于增量渲染
    const beforeObj = await this.articleProvider.getById(id, 'admin');
    const data = await this.articleProvider.deleteById(id);
    
    // 使用精确的增量渲染，而不是全量渲染
    this.isrProvider.activeArticleById(id, 'delete', beforeObj);
    return {
      statusCode: 200,
      data,
    };
  }
}
