import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称' })
  name: string;
}

export class UpdateCategoryDto {
  @ApiProperty({ description: '分类名称', required: false })
  name?: string;
  
  @ApiProperty({ description: '分类密码', required: false })
  password?: string;
  
  @ApiProperty({ description: '是否为私有分类', required: false })
  private?: boolean;
  
  @ApiProperty({ description: '排序值', required: false })
  sort?: number;
}

export class CategorySortItem {
  @ApiProperty({ description: '分类名称' })
  name: string;
  
  @ApiProperty({ description: '排序值' })
  sort: number;
}

export class UpdateCategorySortDto {
  @ApiProperty({ 
    description: '分类排序数组',
    type: [CategorySortItem]
  })
  categories: CategorySortItem[];
}

export type CategoryType = 'category' | 'column';
