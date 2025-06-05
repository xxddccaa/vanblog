import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SortOrder } from 'src/types/sort';
import { MomentProvider } from 'src/provider/moment/moment.provider';

@ApiTags('public moment')
@Controller('/api/public/moment')
export class PublicMomentController {
  constructor(private readonly momentProvider: MomentProvider) {}

  @Get('/')
  async getByOption(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize = 10,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const option = {
      page: parseInt(page as any),
      pageSize: parseInt(pageSize as any),
      sortCreatedAt,
      startTime,
      endTime,
    };
    const data = await this.momentProvider.getByOption(option, true);
    return {
      statusCode: 200,
      data,
    };
  }
} 