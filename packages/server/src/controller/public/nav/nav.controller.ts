import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NavToolProvider } from 'src/provider/nav-tool/nav-tool.provider';
import { NavCategoryProvider } from 'src/provider/nav-category/nav-category.provider';
import { NavData } from 'src/types/nav.dto';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { CacheProvider } from 'src/provider/cache/cache.provider';

@ApiTags('nav')
@Controller('/api/public/nav')
export class NavController {
  constructor(
    private readonly navToolProvider: NavToolProvider,
    private readonly navCategoryProvider: NavCategoryProvider,
    private readonly settingProvider: SettingProvider,
    private readonly cacheProvider: CacheProvider,
  ) {}

  @Get('/data')
  async getNavData(): Promise<{ statusCode: number; data: NavData }> {
    try {
      const cacheKey = 'public:nav:data';
      const cached = await this.cacheProvider.get(cacheKey);
      if (cached) {
        return {
          statusCode: 200,
          data: cached as NavData,
        };
      }

      const [categories, tools] = await Promise.all([
        this.navCategoryProvider.getAllCategories(),
        this.navToolProvider.getAllTools(),
      ]);

      const visibleTools = tools.filter((tool) => !tool.hide);
      const categoriesWithTools = new Set();
      visibleTools.forEach((tool) => {
        if (tool.categoryId) {
          categoriesWithTools.add(tool.categoryId);
        }
      });
      const visibleCategories = categories.filter(
        (category) => !category.hide && categoriesWithTools.has(category._id.toString()),
      );
      const data = {
        categories: visibleCategories,
        tools: visibleTools,
      };
      await this.cacheProvider.set(cacheKey, data, 300);

      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/admin-data')
  async getAdminNavData(): Promise<{ statusCode: number; data: NavData }> {
    try {
      const cacheKey = 'public:nav:admin-data';
      const cached = await this.cacheProvider.get(cacheKey);
      if (cached) {
        return {
          statusCode: 200,
          data: cached as NavData,
        };
      }

      const [categories, tools] = await Promise.all([
        this.navCategoryProvider.getAllCategories(),
        this.navToolProvider.getAllTools(),
      ]);
      const data = {
        categories,
        tools,
      };
      await this.cacheProvider.set(cacheKey, data, 120);

      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 
