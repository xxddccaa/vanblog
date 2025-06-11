import { Controller, Get, Put, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ApiToken } from 'src/provider/swagger/token';
import { AITaggingProvider } from 'src/provider/ai-tagging/ai-tagging.provider';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { config } from 'src/config';

@ApiTags('ai-tagging')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/ai-tagging')
export class AITaggingController {
  constructor(
    private readonly aiTaggingProvider: AITaggingProvider,
    private readonly isrProvider: ISRProvider,
  ) {}

  @Get('/config')
  async getConfig() {
    const data = await this.aiTaggingProvider.getConfig();
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/config')
  async updateConfig(@Body() body: any) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.aiTaggingProvider.updateConfig(body);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/articles')
  async getArticles() {
    const data = await this.aiTaggingProvider.getArticlesForTagging();
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/generate')
  async generateTags(@Body() body: any) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.aiTaggingProvider.generateTags(body);
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/article/:id/tags')
  async updateArticleTags(@Param('id') id: string, @Body() body: any) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const data = await this.aiTaggingProvider.updateArticleTags(parseInt(id), body.tags);
    this.isrProvider.activeAll('AI打标更新文章触发增量渲染！');
    return {
      statusCode: 200,
      data,
    };
  }
} 