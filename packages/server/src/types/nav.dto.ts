export class CreateNavToolDto {
  name: string;
  url: string;
  logo?: string;
  categoryId: string;
  description?: string;
  sort?: number;
  hide?: boolean;
  useCustomIcon?: boolean;
  customIcon?: string;
}

export class UpdateNavToolDto {
  name?: string;
  url?: string;
  logo?: string;
  categoryId?: string;
  description?: string;
  sort?: number;
  hide?: boolean;
  useCustomIcon?: boolean;
  customIcon?: string;
}

export class CreateNavCategoryDto {
  name: string;
  description?: string;
  sort?: number;
  hide?: boolean;
}

export class UpdateNavCategoryDto {
  name?: string;
  description?: string;
  sort?: number;
  hide?: boolean;
}

export interface NavToolItem {
  _id: string;
  name: string;
  url: string;
  logo?: string;
  categoryId: string;
  categoryName?: string;
  description?: string;
  sort: number;
  hide: boolean;
  useCustomIcon: boolean;
  customIcon?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NavCategoryItem {
  _id: string;
  name: string;
  description?: string;
  sort: number;
  hide: boolean;
  createdAt: Date;
  updatedAt: Date;
  toolCount?: number;
}

export interface NavData {
  categories: NavCategoryItem[];
  tools: NavToolItem[];
}

export class CreateNavIconDto {
  name: string;
  description?: string;
  iconUrl: string;
  type?: string = 'nav'; // 默认为导航图标，区分 'nav' 和 'social'
}

export class UpdateNavIconDto {
  name?: string;
  description?: string;
  iconUrl?: string;
  type?: string;
} 