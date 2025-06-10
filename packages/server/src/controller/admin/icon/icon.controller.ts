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
import { IconProvider } from 'src/provider/icon/icon.provider';
import { IconDto } from 'src/types/icon.dto';

@ApiTags('icon')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/icon')
export class IconController {
  constructor(private readonly iconProvider: IconProvider) {}

  @Get()
  async getAllIcons(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('usage') usage?: 'nav' | 'social',
  ) {
    try {
      if (page && pageSize) {
        const pageNum = parseInt(page, 10);
        const pageSizeNum = parseInt(pageSize, 10);
        const result = await this.iconProvider.getIconsPaginated(pageNum, pageSizeNum, usage);
        return {
          statusCode: 200,
          data: result,
        };
      } else {
        const icons = await this.iconProvider.getAllIcons(usage);
        return {
          statusCode: 200,
          data: icons,
        };
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':name')
  async getIconByName(@Param('name') name: string) {
    try {
      const icon = await this.iconProvider.getIconByName(name);
      if (!icon) {
        throw new HttpException('图标未找到', HttpStatus.NOT_FOUND);
      }
      return {
        statusCode: 200,
        data: icon,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  async createIcon(@Body() iconDto: IconDto) {
    try {
      const icon = await this.iconProvider.createIcon(iconDto);
      return {
        statusCode: 200,
        data: icon,
        message: '图标创建成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':name')
  async updateIcon(@Param('name') name: string, @Body() iconDto: Partial<IconDto>) {
    try {
      const icon = await this.iconProvider.updateIcon(name, iconDto);
      return {
        statusCode: 200,
        data: icon,
        message: '图标更新成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':name')
  async deleteIcon(@Param('name') name: string) {
    try {
      await this.iconProvider.deleteIcon(name);
      return {
        statusCode: 200,
        message: '图标删除成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete()
  async deleteAllIcons() {
    try {
      await this.iconProvider.deleteAllIcons();
      return {
        statusCode: 200,
        message: '所有图标删除成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 