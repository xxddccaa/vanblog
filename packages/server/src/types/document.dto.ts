import { SortOrder } from './sort';

export class CreateDocumentDto {
  title: string;
  content?: string;
  parent_id?: number;
  library_id?: number;
  type: 'library' | 'document';
  author?: string;
  sort_order?: number;
}

export class UpdateDocumentDto {
  title?: string;
  content?: string;
  parent_id?: number;
  library_id?: number;
  type?: 'library' | 'document';
  author?: string;
  sort_order?: number;
  deleted?: boolean;
  path?: number[];
}

export class SearchDocumentOption {
  page?: number;
  pageSize?: number;
  title?: string;
  library_id?: number;
  parent_id?: number;
  type?: 'library' | 'document';
  author?: string;
  toListView?: boolean;
  sortCreatedAt?: SortOrder;
  startTime?: string;
  endTime?: string;
}

export class MoveDocumentDto {
  target_parent_id?: number;
  target_library_id?: number;
  sort_order?: number;
} 