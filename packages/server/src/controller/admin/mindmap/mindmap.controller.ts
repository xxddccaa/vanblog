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
import { CreateMindMapDto, UpdateMindMapDto } from 'src/types/mindmap.dto';
import { SortOrder } from 'src/types/sort';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { MindMapProvider } from 'src/provider/mindmap/mindmap.provider';
import { config } from 'src/config';
import { ApiToken } from 'src/provider/swagger/token';
import { SearchIndexProvider } from 'src/provider/search-index/search-index.provider';

@ApiTags('mindmap')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/mindmap')
export class MindMapController {
  constructor(
    private readonly mindMapProvider: MindMapProvider,
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
    @Query('pageSize') pageSize = 10,
    @Query('title') title?: string,
    @Query('author') author?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const option = {
      page: this.normalizePositiveInt(page, 1, 100000),
      pageSize: this.normalizePositiveInt(pageSize, 10, 100),
      title,
      author,
      sortCreatedAt,
      startTime,
      endTime,
    };
    const data = await this.mindMapProvider.getByOption(option);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/search')
  async searchMindMap(@Query('value') search: string) {
    const data = await this.mindMapProvider.searchByString(search);
    return {
      statusCode: 200,
      data: {
        total: data.length,
        data: data,
      },
    };
  }

  @Get('/:id')
  async getOne(@Param('id') id: string) {
    const data = await this.mindMapProvider.findById(id);
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateMindMapDto) {
    const data = await this.mindMapProvider.updateById(id, updateDto);
    this.searchIndexProvider.generateSearchIndex('更新思维导图触发搜索索引同步', 500);
    return {
      statusCode: 200,
      data,
    };
  }

  @Post()
  async create(@Req() req: any, @Body() createDto: CreateMindMapDto) {
    const author = req?.user?.nickname || undefined;
    if (!createDto.author) {
      createDto.author = author;
    }
    const data = await this.mindMapProvider.create(createDto);
    this.searchIndexProvider.generateSearchIndex('创建思维导图触发搜索索引同步', 500);
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:id')
  async delete(@Param('id') id: string) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止删除思维导图！',
      };
    }
    const data = await this.mindMapProvider.deleteById(id);
    this.searchIndexProvider.generateSearchIndex('删除思维导图触发搜索索引同步', 500);
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/:id/view')
  async incrementView(@Param('id') id: string) {
    await this.mindMapProvider.incrementViewer(id);
    return {
      statusCode: 200,
      data: 'success',
    };
  }
}
