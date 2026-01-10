import { SortOrder } from './sort';

export class CreateMindMapDto {
  title: string;
  content?: string; // JSON字符串，存储思维导图数据
  author?: string;
  description?: string;
}

export class UpdateMindMapDto {
  title?: string;
  content?: string; // JSON字符串，存储思维导图数据
  author?: string;
  description?: string;
  deleted?: boolean;
}

export class SearchMindMapOption {
  page?: number;
  pageSize?: number;
  title?: string;
  author?: string;
  sortCreatedAt?: SortOrder;
  startTime?: string;
  endTime?: string;
}

