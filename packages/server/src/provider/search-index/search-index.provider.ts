import { Injectable, Logger, Optional } from '@nestjs/common';
import path from 'path';
import { config } from 'src/config';
import { buildArticlePreview } from 'src/utils/articlePreview';
import { ArticleProvider } from '../article/article.provider';
import { DocumentProvider } from '../document/document.provider';
import { DraftProvider } from '../draft/draft.provider';
import { MindMapProvider } from '../mindmap/mindmap.provider';
import { MomentProvider } from '../moment/moment.provider';
import { PublicMaskProvider } from '../public-mask/public-mask.provider';
import { recordPublicMaskArtifact, writeFileAtomic } from '../public-mask/public-mask-artifacts';
import { INACTIVE_PUBLIC_MASKER } from 'src/utils/publicMask';

interface SearchIndexItem {
  id: number;
  pathname?: string;
  title: string;
  category: string;
  categories?: string[];
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
  categories?: string[];
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
    @Optional() private readonly publicMaskProvider?: PublicMaskProvider,
  ) {}

  private getArticleCategories(article: any): string[] {
    const source =
      Array.isArray(article?.categories) && article.categories.length
        ? article.categories
        : article?.category
          ? [article.category]
          : [];
    return Array.from(new Set(source.map((item: any) => String(item || '').trim()).filter(Boolean)));
  }

  private normalizeArticleResult(article: any): UnifiedSearchResult {
    return {
      type: 'article',
      id: article.id,
      pathname: article.pathname,
      title: article.title,
      preview: buildArticlePreview(article.content || '', 280),
      category: article.category,
      categories: this.getArticleCategories(article),
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

    const masker = this.publicMaskProvider
      ? await this.publicMaskProvider.getMasker()
      : INACTIVE_PUBLIC_MASKER;
    const mask = (value: unknown) => masker.mask(String(value ?? ''));
    const articles = await this.articleProvider.getPublicSearchIndexArticles();
    const searchIndex: SearchIndexItem[] = articles.map((article) => {
      // Mask before building the preview and lower-casing: a preview cut or a
      // case change must never leave part of a masked term behind.
      const content = masker.active
        ? this.publicMaskProvider.maskCached(
            masker,
            `article:${article.id}:${article.updatedAt || article.createdAt || ''}`,
            article.content || '',
          )
        : article.content || '';
      const preview = buildArticlePreview(content, 280);
      const title = masker.active ? mask(article.title) : article.title;
      const category = masker.active && article.category ? mask(article.category) : article.category;
      const tags = (article.tags || []).map((tag: string) => (masker.active ? mask(tag) : tag));
      const categories = this.getArticleCategories(article).map((item) =>
        masker.active ? mask(item) : item,
      );
      const pathname =
        article.pathname && !masker.hasHit(String(article.pathname)) ? article.pathname : undefined;

      return {
        id: article.id,
        pathname,
        title,
        category,
        categories,
        tags,
        createdAt: new Date(article.createdAt).toISOString(),
        updatedAt: new Date(article.updatedAt || article.createdAt).toISOString(),
        preview,
        searchText: Array.from(new Set([title, ...categories, category, ...tags, preview].filter(Boolean)))
          .join(' ')
          .toLowerCase(),
      };
    });

    writeFileAtomic(path.join(config.staticPath, 'search-index.json'), JSON.stringify(searchIndex));
    recordPublicMaskArtifact(config.staticPath, 'searchIndex', masker.version);
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
