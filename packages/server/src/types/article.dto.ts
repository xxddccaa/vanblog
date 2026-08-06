import { SortOrder } from './sort';

export class CreateArticleDto {
  title: string;
  content?: string;
  tags?: string[];
  top?: number;
  category: string;
  categories?: string[];
  hidden?: boolean;
  private?: boolean;
  password?: string;
  updatedAt?: Date;
  createdAt?: Date;
  author?: string;
  copyright?: string;
  pathname?: string;
}
export class UpdateArticleDto {
  title?: string;
  content?: string;
  tags?: string[];
  category?: string;
  categories?: string[];
  hidden?: boolean;
  top?: number;
  private?: boolean;
  password?: string;
  deleted?: boolean;
  viewer?: number;
  visited?: number;
  updatedAt?: Date;
  author?: string;
  copyright?: string;
  pathname?: string;
}
export class SearchArticleOption {
  page: number;
  pageSize: number;
  regMatch: boolean;
  category?: string;
  tags?: string;
  title?: string;
  sortCreatedAt?: SortOrder;
  sortTop?: SortOrder;
  startTime?: string;
  endTime?: string;
  // 按归档年月精确筛选（使用数据库会话时区，与归档汇总的 EXTRACT 口径一致）
  archiveYear?: number;
  archiveMonth?: number;
  sortViewer?: SortOrder;
  toListView?: boolean;
  withPreviewContent?: boolean;
  withWordCount?: boolean;
  author?: string;
}
