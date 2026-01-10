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

@ApiTags('mindmap')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/mindmap')
export class MindMapController {
  constructor(
    private readonly mindMapProvider: MindMapProvider,
  ) {}

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
      page,
      pageSize,
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
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:id')
  async delete(@Param('id') id: string) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止删除思维导图！',
      };
    }
    const data = await this.mindMapProvider.deleteById(id);
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

