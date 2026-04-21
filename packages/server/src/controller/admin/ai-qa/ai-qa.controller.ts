import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { config } from 'src/config';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { AiQaProvider } from 'src/provider/ai-qa/ai-qa.provider';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('ai-qa')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/ai-qa')
export class AiQaController {
  constructor(private readonly aiQaProvider: AiQaProvider) {}

  private normalizePositiveInt(value: unknown, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(max, Math.trunc(parsed));
  }

  @Get('/config')
  async getConfig() {
    const data = await this.aiQaProvider.getConfig();
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/config')
  async updateConfig(@Body() body: any) {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    const data = await this.aiQaProvider.updateConfig(body);
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/status')
  async getStatus() {
    const data = await this.aiQaProvider.getStatus();
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/conversations')
  async listConversations(@Query('page') page: unknown, @Query('pageSize') pageSize: unknown) {
    const data = await this.aiQaProvider.listConversations(
      this.normalizePositiveInt(page, 1, 100000),
      this.normalizePositiveInt(pageSize, 20, 100),
    );
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('/conversations/:id')
  async getConversationDetail(@Param('id') id: string) {
    const data = await this.aiQaProvider.getConversationDetail(id);
    return {
      statusCode: 200,
      data,
    };
  }

  @Put('/conversations/:id')
  async renameConversation(@Param('id') id: string, @Body() body: { title?: string }) {
    const data = await this.aiQaProvider.renameConversation(id, body?.title || '');
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/conversations/:id')
  async deleteConversation(@Param('id') id: string) {
    const data = await this.aiQaProvider.deleteConversation(id);
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/test-connection')
  async testConnection(@Body() body: { question?: string }) {
    const data = await this.aiQaProvider.testConnection(body?.question);
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/bundled-models/sync')
  async syncBundledModels() {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    const data = await this.aiQaProvider.syncBundledModels();
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/provision')
  async provision() {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    const data = await this.aiQaProvider.provisionFastgptResources();
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/migrate-legacy')
  async migrateLegacy() {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    const data = await this.aiQaProvider.migrateLegacyFastgptResources();
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/bundled-models/test')
  async testBundledModels() {
    const data = await this.aiQaProvider.testBundledModels();
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/sync/full')
  async fullSync() {
    if (config?.demo == true || config?.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }

    const data = await this.aiQaProvider.runFullSync('manual');
    return {
      statusCode: 200,
      data,
    };
  }

  @Post('/chat')
  async chat(
    @Request() request: any,
    @Body() body: { conversationId?: string; chatId?: string; question: string },
  ) {
    const data = await this.aiQaProvider.chat(body?.question, {
      conversationId: body?.conversationId,
      chatId: body?.chatId,
      actor: {
        userId: request?.user?.id,
        name: request?.user?.name,
        nickname: request?.user?.nickname,
      },
    });
    return {
      statusCode: 200,
      data,
    };
  }
}
