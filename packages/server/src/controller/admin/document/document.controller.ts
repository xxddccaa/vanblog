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

@ApiTags('document')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/document')
export class DocumentController {
  constructor(
    private readonly documentProvider: DocumentProvider,
    private readonly searchIndexProvider: SearchIndexProvider,
  ) {}

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
    const data = await this.documentProvider.getDocumentsByLibrary(id);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/library/:id/export')
  async exportLibraryDocuments(@Param('id') id: number) {
    const data = await this.documentProvider.exportLibraryDocuments(id);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/:id')
  async getOne(@Param('id') id: number) {
    const data = await this.documentProvider.findById(id);
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:id')
  async update(@Param('id') id: number, @Body() updateDto: UpdateDocumentDto) {
    const data = await this.documentProvider.updateById(id, updateDto);
    this.searchIndexProvider.generateSearchIndex('更新私密文档触发搜索索引同步', 500);
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
    
    const data = await this.documentProvider.moveDocument(id, moveDto);
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:id')
  async delete(@Param('id') id: number) {
    const data = await this.documentProvider.deleteById(id);
    this.searchIndexProvider.generateSearchIndex('删除私密文档触发搜索索引同步', 500);
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
    
    const data = await this.documentProvider.convertToDraft(id, body.category);
    this.searchIndexProvider.generateSearchIndex('文档转草稿触发搜索索引同步', 500);
    return {
      statusCode: 200,
      data,
    };
  }
} 
