import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ApiToken } from 'src/provider/swagger/token';
import { NavCategoryProvider } from 'src/provider/nav-category/nav-category.provider';
import { CreateNavCategoryDto, UpdateNavCategoryDto } from 'src/types/nav.dto';
import { config } from 'src/config';
import { ISRProvider } from 'src/provider/isr/isr.provider';

@ApiTags('nav-category')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/nav-category')
export class NavCategoryController {
  constructor(
    private readonly navCategoryProvider: NavCategoryProvider,
    private readonly isrProvider: ISRProvider,
  ) {}

  @Get()
  async getAllCategories(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    try {
      if (page && pageSize) {
        const pageNum = parseInt(page, 10);
        const pageSizeNum = parseInt(pageSize, 10);
        const result = await this.navCategoryProvider.getCategoriesPaginated(pageNum, pageSizeNum);
        return {
          statusCode: 200,
          data: result,
        };
      } else {
        const categories = await this.navCategoryProvider.getAllCategories();
        return {
          statusCode: 200,
          data: categories,
        };
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getCategoryById(@Param('id') id: string) {
    try {
      const category = await this.navCategoryProvider.getCategoryById(id);
      if (!category) {
        throw new HttpException('分类未找到', HttpStatus.NOT_FOUND);
      }
      return {
        statusCode: 200,
        data: category,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  async createCategory(@Body() categoryDto: CreateNavCategoryDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止创建导航分类！',
      };
    }

    try {
      const category = await this.navCategoryProvider.createCategory(categoryDto);
      this.isrProvider.activeAll('创建导航分类触发增量渲染！');
      return {
        statusCode: 200,
        data: category,
        message: '分类创建成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  async updateCategory(@Param('id') id: string, @Body() categoryDto: UpdateNavCategoryDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改导航分类！',
      };
    }

    try {
      const category = await this.navCategoryProvider.updateCategory(id, categoryDto);
      this.isrProvider.activeAll('更新导航分类触发增量渲染！');
      return {
        statusCode: 200,
        data: category,
        message: '分类更新成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async deleteCategory(@Param('id') id: string) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止删除导航分类！',
      };
    }

    try {
      await this.navCategoryProvider.deleteCategory(id);
      this.isrProvider.activeAll('删除导航分类触发增量渲染！');
      return {
        statusCode: 200,
        message: '分类删除成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put('/sort/update')
  async updateCategoriesSort(@Body() body: { categories: Array<{ id: string; sort: number }> }) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改排序！',
      };
    }

    try {
      await this.navCategoryProvider.updateCategoriesSort(body.categories);
      this.isrProvider.activeAll('更新导航分类排序触发增量渲染！');
      return {
        statusCode: 200,
        message: '排序更新成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
} 