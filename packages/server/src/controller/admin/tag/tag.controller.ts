import { Controller, Delete, Get, Param, Put, Query, UseGuards, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { config } from 'src/config';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { ApiToken } from 'src/provider/swagger/token';
import { TagProvider } from 'src/provider/tag/tag.provider';

@ApiTags('tag')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/tag/')
export class TagController {
  constructor(
    private readonly tagProvider: TagProvider,
    private readonly isrProvider: ISRProvider,
  ) {}

  @Get('/all')
  @ApiOperation({ summary: '获取所有标签名称' })
  async getAllTags() {
    const data = await this.tagProvider.getAllTags(true);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/paginated')
  @ApiOperation({ summary: '分页获取标签列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码，默认1' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页大小，默认50' })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段' })
  @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  async getTagsPaginated(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '50',
    @Query('sortBy') sortBy: 'name' | 'articleCount' | 'createdAt' | 'updatedAt' = 'articleCount',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('search') search?: string,
  ) {
    const data = await this.tagProvider.getTagsPaginated(
      parseInt(page),
      parseInt(pageSize),
      sortBy,
      sortOrder,
      search,
    );
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/hot')
  @ApiOperation({ summary: '获取热门标签' })
  @ApiQuery({ name: 'limit', required: false, description: '数量限制，默认20' })
  async getHotTags(@Query('limit') limit: string = '20') {
    const data = await this.tagProvider.getHotTags(parseInt(limit));
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/search')
  @ApiOperation({ summary: '搜索标签' })
  @ApiQuery({ name: 'keyword', required: true, description: '搜索关键词' })
  @ApiQuery({ name: 'limit', required: false, description: '数量限制，默认20' })
  async searchTags(
    @Query('keyword') keyword: string,
    @Query('limit') limit: string = '20',
  ) {
    const data = await this.tagProvider.searchTags(keyword, parseInt(limit));
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/sync')
  @ApiOperation({ summary: '同步标签数据' })
  async syncTags() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    await this.tagProvider.syncTagsFromArticles();
    this.isrProvider.activeUrl('/tag', false);
    this.isrProvider.activePath('tag');
    return {
      statusCode: 200,
      message: '标签数据同步成功！',
    };
  }

  @Get('/:name')
  @ApiOperation({ summary: '根据标签名获取文章列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码，默认不分页' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页大小' })
  async getArticlesByTagName(
    @Param('name') name: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize) : undefined;
    
    const data = await this.tagProvider.getArticlesByTag(name, true, pageNum, pageSizeNum);
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:name')
  @ApiOperation({ summary: '重命名标签' })
  async updateTagByName(@Param('name') name: string, @Query('value') newName: string) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    try {
      const data = await this.tagProvider.updateTagByName(name, newName);
      this.isrProvider.activeUrl('/tag', false);
      this.isrProvider.activeUrl(`/tag/${encodeURIComponent(name)}`, false);
      this.isrProvider.activeUrl(`/tag/${encodeURIComponent(newName)}`, false);
      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      return {
        statusCode: 400,
        message: error.message,
      };
    }
  }

  @Delete('/:name')
  @ApiOperation({ summary: '删除标签' })
  async deleteTagByName(@Param('name') name: string) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    
    try {
      const data = await this.tagProvider.deleteOne(name);
      this.isrProvider.activeUrl('/tag', false);
      this.isrProvider.activeUrl(`/tag/${encodeURIComponent(name)}`, false);
      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      return {
        statusCode: 400,
        message: error.message,
      };
    }
  }
}
