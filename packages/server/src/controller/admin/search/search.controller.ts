import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { SearchIndexProvider } from 'src/provider/search-index/search-index.provider';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('search')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/search')
export class SearchController {
  constructor(private readonly searchIndexProvider: SearchIndexProvider) {}

  @Get('/all')
  async searchAllContent(@Query('value') search: string, @Query('limit') limit: string = '20') {
    const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const data = await this.searchIndexProvider.searchContent(search, size, 'admin');

    return {
      statusCode: 200,
      data: {
        total: data.length,
        data,
      },
    };
  }
}
