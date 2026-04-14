import { Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { Setting, SettingDocument } from 'src/scheme/setting.schema';
import { ArticleProvider } from '../article/article.provider';
import axios from 'axios';
import { normalizeAiRequestBaseUrl } from 'src/utils/aiRequestUrl';

@Injectable()
export class AITaggingProvider {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
    private readonly articleProvider: ArticleProvider,
  ) {}

  async getConfig() {
    const setting = await this.settingModel.findOne({ type: 'aiTagging' }).exec();
    return setting?.value || null;
  }

  async updateConfig(config: any) {
    await this.settingModel.updateOne(
      { type: 'aiTagging' },
      { value: config },
      { upsert: true },
    );
    return { message: '配置更新成功' };
  }

  async getArticlesForTagging() {
    const articles = await this.articleProvider.getAll('admin', true);
    return articles
      .filter(article => !article.deleted && !article.hidden)
      .map(article => ({
        id: article.id,
        title: article.title,
        content: article.content,
        tags: article.tags || [],
      }));
  }

  async generateTags(params: { 
    baseUrl: string; 
    apiKey: string; 
    model?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    conversations: any[] 
  }) {
    const { baseUrl, apiKey, model, temperature, topP, maxTokens, conversations } = params;
    const normalizedBaseUrl = normalizeAiRequestBaseUrl(baseUrl);
    
    try {
      const response = await axios.post(`${normalizedBaseUrl}/chat/completions`, {
        model: model || 'gpt-4o',
        messages: conversations,
        temperature: temperature || 0.8,
        top_p: topP || 0.8,
        max_tokens: maxTokens || 150,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const content = response.data?.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('AI返回结果格式错误');
      }

      return content;
    } catch (error) {
      throw new Error(`AI标签生成失败: ${this.getAiErrorMessage(error)}`);
    }
  }

  async updateArticleTags(articleId: number, tags: string[]) {
    await this.articleProvider.updateById(articleId, { tags });
    return { message: '标签更新成功' };
  }

  private getAiErrorMessage(error: unknown) {
    const responseMessage = this.extractAxiosResponseMessage(
      axios.isAxiosError(error) ? error.response?.data : (error as any)?.response?.data,
    );
    if (responseMessage) {
      return responseMessage;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return '未知错误';
  }

  private extractAxiosResponseMessage(data: any) {
    if (!data) {
      return null;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data?.error?.message === 'string') {
      return data.error.message;
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    return null;
  }
} 
