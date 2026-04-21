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
import { CreateDocumentDto, UpdateDocumentDto, MoveDocumentDto } from 'src/types/document.dto';
import { SortOrder } from 'src/types/sort';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { DocumentProvider } from 'src/provider/document/document.provider';
import { config } from 'src/config';
import { ApiToken } from 'src/provider/swagger/token';
import { SearchIndexProvider } from 'src/provider/search-index/search-index.provider';
import { AiQaProvider } from 'src/provider/ai-qa/ai-qa.provider';

@ApiTags('document')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/document')
export class DocumentController {
  constructor(
    private readonly documentProvider: DocumentProvider,
    private readonly searchIndexProvider: SearchIndexProvider,
    private readonly aiQaProvider: AiQaProvider,
  ) {}

  private syncAiQaAsync(task: Promise<any>, reason: string) {
    void task.catch((error) => {
      console.error(`[AI问答] ${reason} 失败:`, error?.message || error);
    });
  }

  private normalizePositiveInt(value: string | number | undefined, fallback: number, max: number) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  @Get('/')
  async getByOption(
    @Query('page') page: number,
    @Query('pageSize') pageSize = 5,
    @Query('toListView') toListView = false,
    @Query('title') title?: string,
    @Query('library_id') library_id?: number,
    @Query('parent_id') parent_id?: number,
    @Query('type') type?: 'library' | 'document',
    @Query('author') author?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const option = {
      page: this.normalizePositiveInt(page, 1, 100000),
      pageSize: this.normalizePositiveInt(pageSize, 5, 100),
      title,
      library_id,
      parent_id,
      type,
      author,
      sortCreatedAt,
      startTime,
      endTime,
      toListView,
    };
    const data = await this.documentProvider.getByOption(option);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/search')
  async searchDocument(@Query('value') search: string) {
    const data = await this.documentProvider.searchByString(search);
    return {
      statusCode: 200,
      data: {
        total: data.length,
        data: data,
      },
    };
  }

  @Get('/tree')
  async getDocumentTree(@Query('library_id') libraryId?: number) {
    const data = await this.documentProvider.getDocumentTree(libraryId);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/libraries')
  async getLibraries() {
    const data = await this.documentProvider.getLibraries();
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/library/:id')
  async getDocumentsByLibrary(@Param('id') id: number) {
    const libraryId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!libraryId) {
      return {
        statusCode: 400,
        message: '文档库 ID 无效',
      };
    }
    const data = await this.documentProvider.getDocumentsByLibrary(libraryId);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/library/:id/export')
  async exportLibraryDocuments(@Param('id') id: number) {
    const libraryId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!libraryId) {
      return {
        statusCode: 400,
        message: '文档库 ID 无效',
      };
    }
    const data = await this.documentProvider.exportLibraryDocuments(libraryId);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/:id')
  async getOne(@Param('id') id: number) {
    const documentId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!documentId) {
      return {
        statusCode: 400,
        message: '文档 ID 无效',
      };
    }
    const data = await this.documentProvider.findById(documentId);
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:id')
  async update(@Param('id') id: number, @Body() updateDto: UpdateDocumentDto) {
    const documentId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!documentId) {
      return {
        statusCode: 400,
        message: '文档 ID 无效',
      };
    }
    const data = await this.documentProvider.updateById(documentId, updateDto);
    this.searchIndexProvider.generateSearchIndex('更新私密文档触发搜索索引同步', 500);
    this.syncAiQaAsync(this.aiQaProvider.syncDocumentById(documentId, 'document-update'), '私密文档更新同步 AI 问答知识');
    return {
      statusCode: 200,
      data,
    };
  }

  @Post()
  async create(@Req() req: any, @Body() createDto: CreateDocumentDto) {
    const author = req?.user?.nickname || undefined;
    if (!createDto.author) {
      createDto.author = author;
    }
    const data = await this.documentProvider.create(createDto);
    this.searchIndexProvider.generateSearchIndex('创建私密文档触发搜索索引同步', 500);
    this.syncAiQaAsync(this.aiQaProvider.syncDocumentById(data.id, 'document-create'), '私密文档创建同步 AI 问答知识');
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:id/move')
  async move(@Param('id') id: number, @Body() moveDto: MoveDocumentDto) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止移动文档！',
      };
    }

    const documentId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!documentId) {
      return {
        statusCode: 400,
        message: '文档 ID 无效',
      };
    }

    const data = await this.documentProvider.moveDocument(documentId, moveDto);
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:id')
  async delete(@Param('id') id: number) {
    const documentId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!documentId) {
      return {
        statusCode: 400,
        message: '文档 ID 无效',
      };
    }
    const data = await this.documentProvider.deleteById(documentId);
    this.searchIndexProvider.generateSearchIndex('删除私密文档触发搜索索引同步', 500);
    this.syncAiQaAsync(this.aiQaProvider.deleteDocumentTreeByRootId(documentId, 'document-delete'), '私密文档删除同步 AI 问答知识');
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/:id/convert-to-draft')
  async convertToDraft(@Param('id') id: number, @Body() body: { category: string }) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止此操作！',
      };
    }

    const documentId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!documentId) {
      return {
        statusCode: 400,
        message: '文档 ID 无效',
      };
    }

    const data = await this.documentProvider.convertToDraft(documentId, body.category);
    this.searchIndexProvider.generateSearchIndex('文档转草稿触发搜索索引同步', 500);
    this.syncAiQaAsync(this.aiQaProvider.deleteSource('document', String(documentId), 'document-convert-to-draft-delete'), '文档转草稿后移除文档知识');
    this.syncAiQaAsync(this.aiQaProvider.syncDraftById(data.id, 'document-convert-to-draft-create'), '文档转草稿后同步草稿知识');
    return {
      statusCode: 200,
      data,
    };
  }
}
