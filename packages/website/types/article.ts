export interface Article {
  content: string;
  category: string;
  categories?: string[];
  tags: string[];
  createdAt: string;
  title: string;
  updatedAt: string;
  id: number;
  top?: number;
  private: boolean;
  author?: string;
  copyright?: string;
  pathname?: string;
}

export const getArticleCategories = (article?: { category?: string; categories?: string[] }) => {
  const source =
    Array.isArray(article?.categories) && article.categories.length
      ? article.categories
      : article?.category
        ? [article.category]
        : [];
  return Array.from(new Set(source.map((item) => String(item || "").trim()).filter(Boolean)));
};
