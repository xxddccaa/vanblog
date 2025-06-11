import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from 'src/scheme/setting.schema';
import { ArticleProvider } from '../article/article.provider';
import axios from 'axios';

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

  async generateTags(params: { baseUrl: string; apiKey: string; conversations: any[] }) {
    const { baseUrl, apiKey, conversations } = params;
    
    try {
      const response = await axios.post(`${baseUrl}/chat/completions`, {
        model: 'gpt-4o',
        messages: conversations,
        temperature: 0.8,
        top_p: 0.8,
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
      throw new Error(`AI标签生成失败: ${error.message}`);
    }
  }

  async updateArticleTags(articleId: number, tags: string[]) {
    await this.articleProvider.updateById(articleId, { tags });
    return { message: '标签更新成功' };
  }
} 