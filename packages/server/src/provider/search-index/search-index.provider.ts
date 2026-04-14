import { Injectable, Logger } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { config } from 'src/config';
import { buildArticlePreview } from 'src/utils/articlePreview';
import { ArticleProvider } from '../article/article.provider';
import { DocumentProvider } from '../document/document.provider';
import { DraftProvider } from '../draft/draft.provider';
import { MindMapProvider } from '../mindmap/mindmap.provider';
import { MomentProvider } from '../moment/moment.provider';

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

export interface UnifiedSearchResult {
  type: 'article' | 'moment' | 'draft' | 'document' | 'mindmap';
  id: number | string;
  pathname?: string;
  title: string;
  preview: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SearchIndexProvider {
  private readonly logger = new Logger(SearchIndexProvider.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly momentProvider: MomentProvider,
    private readonly draftProvider: DraftProvider,
    private readonly documentProvider: DocumentProvider,
    private readonly mindMapProvider: MindMapProvider,
  ) {}

  private normalizeArticleResult(article: any): UnifiedSearchResult {
    return {
      type: 'article',
      id: article.id,
      pathname: article.pathname,
      title: article.title,
      preview: buildArticlePreview(article.content || '', 280),
      category: article.category,
      tags: article.tags || [],
      createdAt: new Date(article.createdAt).toISOString(),
      updatedAt: new Date(article.updatedAt || article.createdAt).toISOString(),
    };
  }

  private normalizeMomentResult(moment: any): UnifiedSearchResult {
    const preview = buildArticlePreview(moment.content || '', 200);
    return {
      type: 'moment',
      id: moment.id,
      title: preview.slice(0, 48) || `动态 ${moment.id}`,
      preview,
      createdAt: new Date(moment.createdAt).toISOString(),
      updatedAt: new Date(moment.updatedAt || moment.createdAt).toISOString(),
    };
  }

  private normalizeDraftResult(draft: any): UnifiedSearchResult {
    return {
      type: 'draft',
      id: draft.id,
      title: draft.title,
      preview: buildArticlePreview(draft.content || '', 240),
      category: draft.category,
      tags: draft.tags || [],
      createdAt: new Date(draft.createdAt).toISOString(),
      updatedAt: new Date(draft.updatedAt || draft.createdAt).toISOString(),
    };
  }

  private normalizeDocumentResult(document: any): UnifiedSearchResult {
    return {
      type: 'document',
      id: document.id,
      title: document.title,
      preview: buildArticlePreview(document.content || '', 240),
      category: document.type || 'document',
      createdAt: new Date(document.createdAt).toISOString(),
      updatedAt: new Date(document.updatedAt || document.createdAt).toISOString(),
    };
  }

  private normalizeMindMapResult(mindMap: any): UnifiedSearchResult {
    return {
      type: 'mindmap',
      id: mindMap._id || mindMap.id,
      title: mindMap.title,
      preview: buildArticlePreview(mindMap.description || mindMap.content || '', 220),
      createdAt: new Date(mindMap.createdAt).toISOString(),
      updatedAt: new Date(mindMap.updatedAt || mindMap.createdAt).toISOString(),
    };
  }

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

    const articles = await this.articleProvider.getPublicSearchIndexArticles();
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

  async searchContent(keyword: string, limit = 20, scope: 'public' | 'admin' = 'public') {
    if (!keyword?.trim()) {
      return [];
    }

    const [articles, moments, drafts, documents, mindMaps] = await Promise.all([
      this.articleProvider.searchByString(keyword, scope === 'admin'),
      this.momentProvider.searchByString(keyword),
      scope === 'admin' ? this.draftProvider.searchByString(keyword) : Promise.resolve([]),
      scope === 'admin' ? this.documentProvider.searchByString(keyword) : Promise.resolve([]),
      scope === 'admin' ? this.mindMapProvider.searchByString(keyword) : Promise.resolve([]),
    ]);

    return [
      ...articles.slice(0, limit).map((article) => this.normalizeArticleResult(article)),
      ...moments.slice(0, limit).map((moment) => this.normalizeMomentResult(moment)),
      ...drafts.slice(0, limit).map((draft) => this.normalizeDraftResult(draft)),
      ...documents
        .filter((document: any) => document?.isSearchResult !== false)
        .slice(0, limit)
        .map((document) => this.normalizeDocumentResult(document)),
      ...mindMaps.slice(0, limit).map((mindMap) => this.normalizeMindMapResult(mindMap)),
    ]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }
}
