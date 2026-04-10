import { Article } from 'src/scheme/article.schema';

export interface VisitPathSummary {
  pathname: string;
  viewer: number;
  visited: number;
  lastVisitedTime: Date | null;
}

export interface ViewerTabData {
  enableGA: boolean;
  enableBaidu: boolean;
  topViewer: Article[];
  topVisited: Article[];
  recentVisitArticles: Article[];
  topVisitedPaths?: VisitPathSummary[];
  recentVisitedPaths?: VisitPathSummary[];
  siteLastVisitedTime: Date;
  siteLastVisitedPathname: string;
  totalViewer: number;
  totalVisited: number;
  maxArticleViewer: number;
  maxArticleVisited: number;
}
export interface ArticleTabData {
  articleNum: number;
  categoryNum: number;
  tagNum: number;
  wordNum: number;
  categoryPieData: { type: string; value: number }[];
  columnData: { type: string; value: number }[];
}
