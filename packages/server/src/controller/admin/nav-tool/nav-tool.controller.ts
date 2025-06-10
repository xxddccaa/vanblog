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
import { NavToolProvider } from 'src/provider/nav-tool/nav-tool.provider';
import { CreateNavToolDto, UpdateNavToolDto } from 'src/types/nav.dto';
import { config } from 'src/config';
import { ISRProvider } from 'src/provider/isr/isr.provider';

@ApiTags('nav-tool')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/nav-tool')
export class NavToolController {
  constructor(
    private readonly navToolProvider: NavToolProvider,
    private readonly isrProvider: ISRProvider,
  ) {}

  @Get()
  async getAllTools(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    try {
      if (categoryId) {
        const tools = await this.navToolProvider.getToolsByCategory(categoryId);
        return {
          statusCode: 200,
          data: tools,
        };
      }

      if (page && pageSize) {
        const pageNum = parseInt(page, 10);
        const pageSizeNum = parseInt(pageSize, 10);
        const result = await this.navToolProvider.getToolsPaginated(pageNum, pageSizeNum);
        return {
          statusCode: 200,
          data: result,
        };
      } else {
        const tools = await this.navToolProvider.getAllTools();
        return {
          statusCode: 200,
          data: tools,
        };
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getToolById(@Param('id') id: string) {
    try {
      const tool = await this.navToolProvider.getToolById(id);
      if (!tool) {
        throw new HttpException('工具未找到', HttpStatus.NOT_FOUND);
      }
      return {
        statusCode: 200,
        data: tool,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  async createTool(@Body() toolDto: CreateNavToolDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止创建导航工具！',
      };
    }

    try {
      const tool = await this.navToolProvider.createTool(toolDto);
      this.isrProvider.activeAll('创建导航工具触发增量渲染！');
      return {
        statusCode: 200,
        data: tool,
        message: '工具创建成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put(':id')
  async updateTool(@Param('id') id: string, @Body() toolDto: UpdateNavToolDto) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改导航工具！',
      };
    }

    try {
      const tool = await this.navToolProvider.updateTool(id, toolDto);
      this.isrProvider.activeAll('更新导航工具触发增量渲染！');
      return {
        statusCode: 200,
        data: tool,
        message: '工具更新成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  async deleteTool(@Param('id') id: string) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止删除导航工具！',
      };
    }

    try {
      await this.navToolProvider.deleteTool(id);
      this.isrProvider.activeAll('删除导航工具触发增量渲染！');
      return {
        statusCode: 200,
        message: '工具删除成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put('/sort/update')
  async updateToolsSort(@Body() body: { tools: Array<{ id: string; sort: number }> }) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改排序！',
      };
    }

    try {
      await this.navToolProvider.updateToolsSort(body.tools);
      this.isrProvider.activeAll('更新导航工具排序触发增量渲染！');
      return {
        statusCode: 200,
        message: '排序更新成功',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
} 