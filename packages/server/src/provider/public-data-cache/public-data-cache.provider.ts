import { Injectable } from '@nestjs/common';
import { CacheProvider } from '../cache/cache.provider';

@Injectable()
export class PublicDataCacheProvider {
  constructor(private readonly cacheProvider: CacheProvider) {}

  async clearAllPublicData() {
    await Promise.all([
      this.cacheProvider.delPattern('public:*'),
      this.cacheProvider.delPattern('tag:*'),
      this.cacheProvider.delPattern('analysis:*'),
    ]);
  }

  async clearArticleRelatedData() {
    await Promise.all([
      this.cacheProvider.del('public:meta'),
      this.cacheProvider.del('public:category:summary'),
      this.cacheProvider.delPattern('public:timeline*'),
      this.cacheProvider.delPattern('tag:*'),
      this.cacheProvider.delPattern('analysis:*'),
    ]);
  }

  async clearTagData() {
    await Promise.all([
      this.cacheProvider.del('public:meta'),
      this.cacheProvider.delPattern('tag:*'),
      this.cacheProvider.delPattern('analysis:*'),
    ]);
  }

  async clearMetaData() {
    await Promise.all([
      this.cacheProvider.del('public:meta'),
      this.cacheProvider.delPattern('analysis:*'),
    ]);
  }

  async clearViewerData() {
    await Promise.all([
      this.cacheProvider.del('public:meta'),
      this.cacheProvider.delPattern('analysis:*'),
    ]);
  }
}
