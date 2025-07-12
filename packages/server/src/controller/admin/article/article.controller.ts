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

  @Get('/search')
  async searchArticle(@Query('value') search: string) {
    const data = await this.articleProvider.searchByString(search, true);
    return {
      statusCode: 200,
      data: {
        total: data.length,
        data: this.articleProvider.toSearchResult(data),
      },
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
    
    // 验证自定义路径名不能为纯数字
    if (updateArticleDto.pathname && /^\d+$/.test(updateArticleDto.pathname.trim())) {
      return {
        statusCode: 400,
        message: '自定义路径名不能为纯数字，避免与文章ID冲突',
      };
    }
    
    // 验证自定义路径名的唯一性
    if (updateArticleDto.pathname && updateArticleDto.pathname.trim()) {
      const existingArticle = await this.articleProvider.getByPathName(updateArticleDto.pathname.trim(), 'admin');
      if (existingArticle && existingArticle.id !== id) {
        return {
          statusCode: 400,
          message: `自定义路径名 "${updateArticleDto.pathname.trim()}" 已被其他文章使用，请使用不同的路径名`,
        };
      }
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
    
    // 验证自定义路径名不能为纯数字
    if (createArticleDto.pathname && /^\d+$/.test(createArticleDto.pathname.trim())) {
      return {
        statusCode: 400,
        message: '自定义路径名不能为纯数字，避免与文章ID冲突',
      };
    }
    
    // 验证自定义路径名的唯一性
    if (createArticleDto.pathname && createArticleDto.pathname.trim()) {
      const existingArticle = await this.articleProvider.getByPathName(createArticleDto.pathname.trim(), 'admin');
      if (existingArticle) {
        return {
          statusCode: 400,
          message: `自定义路径名 "${createArticleDto.pathname.trim()}" 已被其他文章使用，请使用不同的路径名`,
        };
      }
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
    
    // 获取删除前的文章信息
    const beforeObj = await this.articleProvider.getById(id, 'admin');
    const data = await this.articleProvider.deleteById(id);
    
    // 删除文章后使用全量渲染，因为可能影响其他文章的链接
    this.isrProvider.activeAll('文章删除', undefined, { forceActice: true });
    
    // 异步同步标签数据，不影响用户体验
    this.syncTagsAsync('文章删除');
    
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/reorder')
  async reorderArticles() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    try {
      const data = await this.articleProvider.reorderArticleIds();
      
      // 触发全量ISR更新，因为文章ID都变了
      this.isrProvider.activeAll('文章重排', undefined, { forceActice: true });
      
      // 异步同步标签数据
      this.syncTagsAsync('文章重排');
      
      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: `文章重排失败: ${error.message}`,
      };
    }
  }

  @Post('/fix-negative-ids')
  async fixNegativeIds() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    try {
      const data = await this.articleProvider.fixNegativeIds();
      
      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: `修复负数ID失败: ${error.message}`,
      };
    }
  }

  @Post('/cleanup-temp-ids')
  async cleanupTempIds() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    try {
      const data = await this.articleProvider.cleanupTempIds();
      
      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: `清理临时ID失败: ${error.message}`,
      };
    }
  }

  @Post('/cleanup-duplicate-pathnames')
  async cleanupDuplicatePathnames() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    try {
      const data = await this.articleProvider.cleanupDuplicatePathnames();
      
      return {
        statusCode: 200,
        data,
        message: `已清理 ${data.cleanedCount} 篇文章的重复路径名`,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: `清理重复路径名失败: ${error.message}`,
      };
    }
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
