import { Controller, Get, Put, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ApiToken } from 'src/provider/swagger/token';
import { AITaggingProvider } from 'src/provider/ai-tagging/ai-tagging.provider';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { TagProvider } from 'src/provider/tag/tag.provider';
import { config } from 'src/config';

@ApiTags('ai-tagging')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/ai-tagging')
export class AITaggingController {
  constructor(
    private readonly aiTaggingProvider: AITaggingProvider,
    private readonly isrProvider: ISRProvider,
    private readonly tagProvider: TagProvider,
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
    
    // 如果不是批量操作，则触发ISR
    if (!body.skipISR) {
      this.isrProvider.activeAll('AI打标更新文章触发增量渲染！');
    }
    
    // 异步同步标签数据，不影响用户体验
    this.syncTagsAsync('AI标签更新');
    
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/trigger-isr')
  async triggerISR() {
    this.isrProvider.activeAll('手动触发AI打标相关增量渲染！');
    return {
      statusCode: 200,
      data: '渲染已触发',
    };
  }

  /**
   * 异步同步标签数据，不阻塞主要操作
   */
  private syncTagsAsync(operation: string) {
    // 使用 setTimeout 确保异步执行，不影响主要业务流程
    setTimeout(async () => {
      try {
        await this.tagProvider.syncTagsFromArticles();
        // 触发标签相关页面的ISR更新
        this.isrProvider.activeUrl('/tag', false);
        this.isrProvider.activePath('tag');
        console.log(`[${operation}] 标签数据同步完成`);
      } catch (error) {
        // 确保标签同步失败不会影响主要流程
        console.error(`[${operation}] 标签数据同步失败:`, error.message);
        console.error('标签同步错误详情:', error.stack);
      }
    }, 500); // 增加延迟到500ms，确保主要操作完全完成
  }
} 