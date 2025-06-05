import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateCategoryDto, UpdateCategoryDto, UpdateCategorySortDto } from 'src/types/category.dto';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { CategoryProvider } from 'src/provider/category/category.provider';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { config } from 'src/config';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('category')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/category/')
export class CategoryController {
  constructor(
    private readonly categoryProvider: CategoryProvider,
    private readonly isrProvider: ISRProvider,
  ) {}

  @Get('/all')
  async getAllCategory(@Query('detail') detail: string) {
    const data = await this.categoryProvider.getAllCategories(detail == 'true');
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/:name')
  async getCategoryByName(@Param('name') name: string) {
    const data = await this.categoryProvider.getArticlesByCategory(name, false);
    return {
      statusCode: 200,
      data,
    };
  }

  @Post()
  async createCategory(@Body() body: CreateCategoryDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.categoryProvider.addOne(body.name);
    this.isrProvider.activeAll('创建分类触发增量渲染！');
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/:name')
  async deleteCategory(@Param('name') name: string) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.categoryProvider.deleteOne(name);
    this.isrProvider.activeAll('删除分类触发增量渲染！');
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/:name')
  async updateCategoryByName(@Param('name') name: string, @Body() updateDto: UpdateCategoryDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.categoryProvider.updateCategoryByName(name, updateDto);
    this.isrProvider.activeAll('更新分类触发增量渲染！');
    return {
      statusCode: 200,
      data,
    };
  }

  @Put()
  async updateCategoriesSort(@Body() updateDto: UpdateCategorySortDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.categoryProvider.updateCategoriesSort(updateDto);
    this.isrProvider.activeAll('更新分类排序触发增量渲染！');
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/init-sort')
  async initializeCategoriesSort() {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.categoryProvider.initializeCategoriesSort();
    return {
      statusCode: 200,
      data,
      message: '分类排序初始化成功！',
    };
  }
}
