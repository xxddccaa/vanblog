import { Controller, Get, HttpException, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
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

  private setLastModified(res: Response | undefined, values: unknown[]) {
    if (!res) {
      return;
    }

    const latest = values
      .map((value) => new Date((value as any)?.updatedAt || (value as any)?.createdAt || value as any).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((left, right) => right - left)[0];

    if (latest) {
      res.setHeader('Last-Modified', new Date(latest).toUTCString());
    }
  }

  private getLatestTimestamp(values: unknown[]) {
    return values
      .map((value) => new Date((value as any)?.updatedAt || (value as any)?.createdAt || value as any).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((left, right) => right - left)[0];
  }

  private buildCachedEnvelope(data: NavData) {
    const latest = this.getLatestTimestamp([...(data.categories || []), ...(data.tools || [])]);
    return {
      __lastModified: latest ? new Date(latest).toISOString() : undefined,
      data,
    };
  }

  private unwrapCachedPayload(
    res: Response | undefined,
    payload:
      | NavData
      | {
          __lastModified?: string;
          data: NavData;
        },
  ) {
    if (
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      Object.prototype.hasOwnProperty.call(payload, 'data')
    ) {
      const envelope = payload as {
        __lastModified?: string;
        data: NavData;
      };
      if (envelope.__lastModified) {
        this.setLastModified(res, [envelope.__lastModified]);
      }
      return envelope.data;
    }

    const data = payload as NavData;
    this.setLastModified(res, [...(data?.categories || []), ...(data?.tools || [])]);
    return data;
  }

  @Get('/data')
  async getNavData(@Res({ passthrough: true }) res?: Response): Promise<{ statusCode: number; data: NavData }> {
    try {
      const cacheKey = 'public:nav:data';
      const cached = await this.cacheProvider.get(cacheKey);
      if (cached) {
        const data = this.unwrapCachedPayload(res, cached as any);
        return {
          statusCode: 200,
          data,
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
      await this.cacheProvider.set(cacheKey, this.buildCachedEnvelope(data), 300);
      this.setLastModified(res, [...visibleCategories, ...visibleTools]);

      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/admin-data')
  async getAdminNavData(@Res({ passthrough: true }) res?: Response): Promise<{ statusCode: number; data: NavData }> {
    try {
      const cacheKey = 'public:nav:admin-data';
      const cached = await this.cacheProvider.get(cacheKey);
      if (cached) {
        const data = this.unwrapCachedPayload(res, cached as any);
        return {
          statusCode: 200,
          data,
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
      await this.cacheProvider.set(cacheKey, this.buildCachedEnvelope(data), 120);
      this.setLastModified(res, [...visibleCategories, ...visibleTools]);

      return {
        statusCode: 200,
        data,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 
