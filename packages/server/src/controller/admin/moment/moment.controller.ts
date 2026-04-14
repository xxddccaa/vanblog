import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { config } from 'src/config';
import { CreateMomentDto, UpdateMomentDto } from 'src/types/moment.dto';
import { SortOrder } from 'src/types/sort';
import { MomentProvider } from 'src/provider/moment/moment.provider';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('moment')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/moment')
export class MomentController {
  constructor(
    private readonly momentProvider: MomentProvider,
    private readonly isrProvider: ISRProvider,
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
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const option = {
      page: this.normalizePositiveInt(page, 1, 100000),
      pageSize: this.normalizePositiveInt(pageSize, 10, 100),
      sortCreatedAt,
      startTime,
      endTime,
    };
    const data = await this.momentProvider.getByOption(option, false);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/:id')
  async getOneById(@Param('id') id: string) {
    const momentId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!momentId) {
      return {
        statusCode: 400,
        message: '动态 ID 无效',
      };
    }
    const data = await this.momentProvider.getById(momentId, 'admin');
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:id')
  async update(@Param('id') id: number, @Body() updateDto: UpdateMomentDto) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改动态！',
      };
    }
    const momentId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!momentId) {
      return {
        statusCode: 400,
        message: '动态 ID 无效',
      };
    }
    const data = await this.momentProvider.updateById(momentId, updateDto);
    this.isrProvider.activeAll('更新动态触发增量渲染！');
    return {
      statusCode: 200,
      data,
    };
  }

  @Post()
  async create(@Body() createDto: CreateMomentDto) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止创建动态！',
      };
    }
    const data = await this.momentProvider.create(createDto);
    this.isrProvider.activeAll('创建动态触发增量渲染！');
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:id')
  async delete(@Param('id') id: number) {
    if (config?.demo == true || config?.demo == 'true') {
      return { statusCode: 401, message: '演示站禁止删除动态！' };
    }
    const momentId = this.normalizePositiveInt(id, 0, Number.MAX_SAFE_INTEGER);
    if (!momentId) {
      return {
        statusCode: 400,
        message: '动态 ID 无效',
      };
    }
    await this.momentProvider.deleteById(momentId);
    this.isrProvider.activeAll('删除动态触发增量渲染！');
    return {
      statusCode: 200,
      data: { success: true },
    };
  }
}
