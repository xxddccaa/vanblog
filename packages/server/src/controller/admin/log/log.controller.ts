import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { LogProvider } from 'src/provider/log/log.provider';
import { EventType } from 'src/provider/log/types';
import { ApiToken } from 'src/provider/swagger/token';
@ApiTags('log')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/log')
export class LogController {
  constructor(private readonly logProvider: LogProvider) {}

  private normalizePositiveInt(value: number | string | undefined, fallback: number, max: number) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  @Get()
  async get(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
    @Query('event') event: EventType,
  ) {
    const safePage = this.normalizePositiveInt(page, 1, 100000);
    const safePageSize = this.normalizePositiveInt(pageSize, 20, 200);
    const data = await this.logProvider.searchLog(safePage, safePageSize, event);
    return {
      statusCode: 200,
      data,
    };
  }
}
