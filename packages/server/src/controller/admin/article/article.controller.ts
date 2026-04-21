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
import { AiQaProvider } from 'src/provider/ai-qa/ai-qa.provider';
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
    private readonly aiQaProvider: AiQaProvider,
  ) {}

  private normalizePositiveInt(value: string | number | undefined, fallback: number, max: number) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  private syncAiQaAsync(task: Promise<any>, reason: string) {
    void task.catch((error) => {
      console.error(`[AI问答] ${reason} 失败:`, error?.message || error);
    });
  }

  private sanitizeArticlePayloadForRequester(request: any, payload: any) {
    if (request?.user?.id === 0 || !payload) {
      return payload;
    }

    if (Array.isArray(payload?.articles)) {
      return {
        ...payload,
        articles: payload.articles.map((article: any) => ({
          ...(article || {}),
          password: undefined,
        })),
      };
    }

    return {
      ...(payload || {}),
      password: undefined,
    };
  }

  @Get('/')
  async getByOption(
    @Req() req: any,
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
      page: this.normalizePositiveInt(page, 1, 100000),
      pageSize: this.normalizePositiveInt(pageSize, 5, 100),
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
      data: this.sanitizeArticlePayloadForRequester(req, data),
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
  async getOneByIdOrPathname(@Req() req: any, @Param('id') id: string) {
    const data = await this.articleProvider.getByIdOrPathname(id, 'admin');
    return {
      statusCode: 200,
      data: this.sanitizeArticlePayloadForRequester(req, data),
    };
  }

  @Put('/:id')
  async updateArticle(@Param('id') id: number, @Body() updateArticleDto: UpdateArticleDto) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    const articleId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!articleId) {
      return {
        statusCode: 400,
        message: '文章 ID 无效',
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
      const existingArticle = await this.articleProvider.getByPathName(
        updateArticleDto.pathname.trim(),
        'admin',
      );
      if (existingArticle && existingArticle.id !== articleId) {
        return {
          statusCode: 400,
          message: `自定义路径名 "${updateArticleDto.pathname.trim()}" 已被其他文章使用，请使用不同的路径名`,
        };
      }
    }

    // 获取更新前的文章信息，用于增量渲染比较
    const beforeObj = await this.articleProvider.getById(articleId, 'admin');
    const data = await this.articleProvider.updateById(articleId, updateArticleDto);

    // 使用精确的增量渲染，而不是全量渲染
    this.isrProvider.activeArticleById(articleId, 'update', beforeObj);

    this.refreshTagPagesAsync('文章更新');
    this.syncAiQaAsync(this.aiQaProvider.syncArticleById(articleId, 'article-update'), '文章更新同步 AI 问答知识');

    return {
      statusCode: 200,
      data,
    };
  }

  @Post()
  async createArticle(@Body() createArticleDto: CreateArticleDto) {
    if (config?.demo == true || config?.demo == 'true') {
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
      const existingArticle = await this.articleProvider.getByPathName(
        createArticleDto.pathname.trim(),
        'admin',
      );
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

    this.refreshTagPagesAsync('文章创建');
    this.syncAiQaAsync(this.aiQaProvider.syncArticleById(data.id, 'article-create'), '文章创建同步 AI 问答知识');

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
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    const articleId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!articleId) {
      return {
        statusCode: 400,
        message: '文章 ID 无效',
      };
    }

    // 获取删除前的文章信息
    const beforeObj = await this.articleProvider.getById(articleId, 'admin');
    const data = await this.articleProvider.deleteById(articleId);

    // 删除文章后按受影响页面做定向刷新，避免整站缓存联动失效
    this.isrProvider.activeArticleById(articleId, 'delete', beforeObj);

    this.refreshTagPagesAsync('文章删除');
    this.syncAiQaAsync(this.aiQaProvider.deleteSource('article', String(articleId), 'article-delete'), '文章删除同步 AI 问答知识');

    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/reorder')
  async reorderArticles() {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    try {
      const data = await this.articleProvider.reorderArticleIds();

      // 触发全量ISR更新，因为文章ID都变了
      this.isrProvider.activeAll('文章重排', undefined, { forceActice: true });

      this.refreshTagPagesAsync('文章重排');

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
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    try {
      const data = await this.articleProvider.fixNegativeIds();
      this.isrProvider.activeAll('修复负数文章 ID 触发增量渲染！', undefined, {
        forceActice: true,
      });

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
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    try {
      const data = await this.articleProvider.cleanupTempIds();
      this.isrProvider.activeAll('清理临时文章 ID 触发增量渲染！', undefined, {
        forceActice: true,
      });

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
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    try {
      const data = await this.articleProvider.cleanupDuplicatePathnames();
      this.isrProvider.activeAll('清理重复路径名触发增量渲染！', undefined, {
        forceActice: true,
      });

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
   * 标签数据已在主流程更新，这里只做标签页 ISR 刷新
   */
  private refreshTagPagesAsync(operation: string) {
    setTimeout(async () => {
      try {
        this.isrProvider.activeUrl('/tag', false);
        this.isrProvider.activePath('tag');
        console.log(`[${operation}] 标签页刷新已触发`);
      } catch (error) {
        console.error(`[${operation}] 标签页刷新失败:`, error.message);
        console.error('标签页刷新错误详情:', error.stack);
      }
    }, 500);
  }
}
