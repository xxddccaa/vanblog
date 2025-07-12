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
import { ApiTags } from '@nestjs/swagger';
import { CreateDraftDto, PublishDraftDto, UpdateDraftDto } from 'src/types/draft.dto';
import { SortOrder } from 'src/types/sort';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { DraftProvider } from 'src/provider/draft/draft.provider';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { config } from 'src/config';
import { PipelineProvider } from 'src/provider/pipeline/pipeline.provider';
import { ApiToken } from 'src/provider/swagger/token';
import { TagProvider } from 'src/provider/tag/tag.provider';
import { DocumentProvider } from 'src/provider/document/document.provider';

@ApiTags('draft')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/draft')
export class DraftController {
  constructor(
    private readonly draftProvider: DraftProvider,
    private readonly articleProvider: ArticleProvider,
    private readonly isrProvider: ISRProvider,
    private readonly pipelineProvider: PipelineProvider,
    private readonly tagProvider: TagProvider,
    private readonly documentProvider: DocumentProvider,
  ) {}

  @Get('/')
  async getByOption(
    @Query('page') page: number,
    @Query('pageSize') pageSize = 5,
    @Query('toListView') toListView = false,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('title') title?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const option = {
      page,
      pageSize,
      category,
      tags,
      title,
      sortCreatedAt,
      startTime,
      endTime,
      toListView,
    };
    const data = await this.draftProvider.getByOption(option);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/search')
  async searchDraft(@Query('value') search: string) {
    const data = await this.draftProvider.searchByString(search);
    return {
      statusCode: 200,
      data: {
        total: data.length,
        data: data.map(draft => ({
          id: draft.id,
          title: draft.title,
          category: draft.category,
          tags: draft.tags,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
        })),
      },
    };
  }

  @Get('/:id')
  async getOne(@Param('id') id: number) {
    const data = await this.draftProvider.findById(id);
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:id')
  async update(@Param('id') id: number, @Body() updateDto: UpdateDraftDto) {
    const result = await this.pipelineProvider.dispatchEvent('beforeUpdateDraft', updateDto);
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      const lastOuput = lastResult.output;
      if (lastOuput) {
        updateDto = lastOuput;
      }
    }
    const data = await this.draftProvider.updateById(id, updateDto);
    const updated = await this.draftProvider.findById(id);
    this.pipelineProvider.dispatchEvent('afterUpdateDraft', updated);
    return {
      statusCode: 200,
      data,
    };
  }

  @Post()
  async create(@Req() req: any, @Body() createDto: CreateDraftDto) {
    const author = req?.user?.nickname || undefined;
    if (!createDto.author) {
      createDto.author = author;
    }
    const result = await this.pipelineProvider.dispatchEvent('beforeUpdateDraft', createDto);
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      const lastOuput = lastResult.output;
      if (lastOuput) {
        createDto = lastOuput;
      }
    }
    const data = await this.draftProvider.create(createDto);
    this.pipelineProvider.dispatchEvent('afterUpdateDraft', data);
    return {
      statusCode: 200,
      data,
    };
  }
  @Post('/publish')
  async publish(@Query('id') id: number, @Body() publishDto: PublishDraftDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止发布草稿！',
      };
    }
    
    // 验证自定义路径名不能为纯数字
    if (publishDto.pathname && /^\d+$/.test(publishDto.pathname.trim())) {
      return {
        statusCode: 400,
        message: '自定义路径名不能为纯数字，避免与文章ID冲突',
      };
    }
    
    // 验证自定义路径名的唯一性
    if (publishDto.pathname && publishDto.pathname.trim()) {
      // 检查是否已有文章使用了相同的自定义路径名
      const existingArticleByPathname = await this.articleProvider.getByPathName(publishDto.pathname.trim(), 'admin');
      if (existingArticleByPathname) {
        return {
          statusCode: 400,
          message: `自定义路径名 "${publishDto.pathname.trim()}" 已被其他文章使用，请使用不同的路径名`,
        };
      }
    }
    
    const result = await this.pipelineProvider.dispatchEvent('beforeUpdateArticle', publishDto);
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      const lastOuput = lastResult.output;
      if (lastOuput) {
        publishDto = lastOuput;
      }
    }
    const data = await this.draftProvider.publish(id, publishDto);
    this.isrProvider.activeAll('发布草稿触发增量渲染！');
    this.pipelineProvider.dispatchEvent('afterUpdateArticle', data);
    
    // 异步同步标签数据，不影响用户体验
    this.syncTagsAsync('草稿发布');
    
    return {
      statusCode: 200,
      data,
    };
  }
  @Delete('/:id')
  async delete(@Param('id') id: number) {
    const toDeleteDraft = await this.draftProvider.findById(id);
    const data = await this.draftProvider.deleteById(id);
    this.pipelineProvider.dispatchEvent('deleteDraft', toDeleteDraft);
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

  @Post('/:id/convert-to-document')
  async convertToDocument(@Param('id') id: number, @Body() body: { libraryId: number; parentId?: number }) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止此操作！',
      };
    }
    
    // 获取要转换的草稿
    const draft = await this.draftProvider.getById(id);
    if (!draft) {
      return {
        statusCode: 404,
        message: '草稿不存在',
      };
    }

    // 创建文档
    const documentData = {
      title: draft.title,
      content: draft.content,
      author: draft.author,
      library_id: body.libraryId,
      parent_id: body.parentId || null,
      type: 'document' as 'document',
    };

    const document = await this.documentProvider.create(documentData);

    // 删除原草稿
    await this.draftProvider.deleteById(id);

    return {
      statusCode: 200,
      data: document,
    };
  }
}
