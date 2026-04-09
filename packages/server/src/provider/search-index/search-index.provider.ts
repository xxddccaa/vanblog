import { Injectable, Logger } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { config } from 'src/config';
import { buildArticlePreview } from 'src/utils/articlePreview';
import { ArticleProvider } from '../article/article.provider';

interface SearchIndexItem {
  id: number;
  pathname?: string;
  title: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  preview: string;
  searchText: string;
}

@Injectable()
export class SearchIndexProvider {
  private readonly logger = new Logger(SearchIndexProvider.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly articleProvider: ArticleProvider) {}

  async generateSearchIndex(info?: string, delay?: number) {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.generateSearchIndexFn(info);
    }, delay || 30 * 1000);
  }

  async generateSearchIndexFn(info?: string) {
    this.logger.log(`${info || ''}重新生成搜索索引`);

    const articles = await this.articleProvider.getAll('list', false, false);
    const searchIndex: SearchIndexItem[] = articles.map((article) => {
      const preview = buildArticlePreview(article.content || '', 280);
      const tags = article.tags || [];

      return {
        id: article.id,
        pathname: article.pathname,
        title: article.title,
        category: article.category,
        tags,
        createdAt: new Date(article.createdAt).toISOString(),
        updatedAt: new Date(article.updatedAt || article.createdAt).toISOString(),
        preview,
        searchText: [article.title, article.category, tags.join(' '), preview]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };
    });

    const outputPath = path.join(config.staticPath, 'search-index.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(searchIndex));
  }
}
