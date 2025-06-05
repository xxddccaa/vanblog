import { SortOrder } from './sort';

export class CreateMomentDto {
  content: string;
  createdAt?: Date;
}

export class UpdateMomentDto {
  content?: string;
  deleted?: boolean;
  updatedAt?: Date;
}

export class SearchMomentOption {
  page: number;
  pageSize: number;
  sortCreatedAt?: SortOrder;
  startTime?: string;
  endTime?: string;
} 