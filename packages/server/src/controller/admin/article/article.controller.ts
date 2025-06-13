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
import { TagProvider } from 'src/provider/tag/tag.provider';
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
    private readonly tagProvider: TagProvider,
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
    
    // 异步同步标签数据，不影响用户体验
    this.syncTagsAsync('文章更新');
    
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
    
    // 异步同步标签数据，不影响用户体验
    this.syncTagsAsync('文章创建');
    
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
    
    // 异步同步标签数据，不影响用户体验
    this.syncTagsAsync('文章删除');
    
    return {
      statusCode: 200,
      data,
    };
  }

  /**
   * 异步同步标签数据，不阻塞主要操作
   */
  private syncTagsAsync(operation: string) {
    // 使用 setTimeout 确保异步执行，不影响主要业务流程
    setTimeout(async () => {
      try {
        await this.tagProvider.syncTagsFromArticles();
        // 触发标签相关页面的ISR更新
        this.isrProvider.activeUrl('/tag', false);
        this.isrProvider.activePath('tag');
        console.log(`[${operation}] 标签数据同步完成`);
      } catch (error) {
        // 确保标签同步失败不会影响主要流程
        console.error(`[${operation}] 标签数据同步失败:`, error.message);
        console.error('标签同步错误详情:', error.stack);
      }
    }, 500); // 增加延迟到500ms，确保主要操作完全完成
  }
}
