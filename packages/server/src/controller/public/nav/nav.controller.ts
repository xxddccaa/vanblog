import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NavToolProvider } from 'src/provider/nav-tool/nav-tool.provider';
import { NavCategoryProvider } from 'src/provider/nav-category/nav-category.provider';
import { NavData } from 'src/types/nav.dto';
import { SettingProvider } from 'src/provider/setting/setting.provider';

@ApiTags('nav')
@Controller('/api/public/nav')
export class NavController {
  constructor(
    private readonly navToolProvider: NavToolProvider,
    private readonly navCategoryProvider: NavCategoryProvider,
    private readonly settingProvider: SettingProvider,
  ) {}

  @Get('/data')
  async getNavData(): Promise<{ statusCode: number; data: NavData }> {
    try {
      console.log('Fetching nav data...');
      const startTime = Date.now();
      
      const [categories, tools] = await Promise.all([
        this.navCategoryProvider.getAllCategories(),
        this.navToolProvider.getAllTools(),
      ]);

      // 过滤隐藏的分类和工具，并且只保留有工具的分类
      const visibleTools = tools.filter(tool => !tool.hide);
      
      // 获取所有有工具的分类ID集合
      const categoriesWithTools = new Set();
      visibleTools.forEach(tool => {
        if (tool.categoryId) {
          categoriesWithTools.add(tool.categoryId);
        }
      });
      
      // 过滤只保留有工具的分类
      const visibleCategories = categories.filter(category => 
        !category.hide && 
        categoriesWithTools.has(category._id.toString())
      );

      const endTime = Date.now();
      console.log(`Nav data fetched successfully in ${endTime - startTime}ms. Categories: ${visibleCategories.length}, Tools: ${visibleTools.length}`);

      return {
        statusCode: 200,
        data: {
          categories: visibleCategories,
          tools: visibleTools,
        },
      };
    } catch (error) {
      console.error('Error fetching nav data:', error);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/admin-data')
  async getAdminNavData(): Promise<{ statusCode: number; data: NavData }> {
    try {
      const [categories, tools] = await Promise.all([
        this.navCategoryProvider.getAllCategories(),
        this.navToolProvider.getAllTools(),
      ]);

      return {
        statusCode: 200,
        data: {
          categories,
          tools,
        },
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 