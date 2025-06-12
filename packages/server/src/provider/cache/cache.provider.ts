import { Injectable } from '@nestjs/common';

interface CacheItem {
  value: any;
  expireTime?: number;
}

@Injectable()
export class CacheProvider {
  private data: Record<string, CacheItem> = {};

  get(key: string) {
    const item = this.data[key];
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (item.expireTime && Date.now() > item.expireTime) {
      delete this.data[key];
      return null;
    }

    return item.value;
  }

  set(key: string, value: any, ttlSeconds?: number) {
    const item: CacheItem = { value };
    
    if (ttlSeconds) {
      item.expireTime = Date.now() + ttlSeconds * 1000;
    }

    this.data[key] = item;
  }

  del(key: string) {
    delete this.data[key];
  }

  // 支持模式匹配删除（简单的通配符匹配）
  delPattern(pattern: string) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete = Object.keys(this.data).filter(key => regex.test(key));
    keysToDelete.forEach(key => delete this.data[key]);
  }

  // 清理过期的缓存项
  cleanup() {
    const now = Date.now();
    Object.keys(this.data).forEach(key => {
      const item = this.data[key];
      if (item.expireTime && now > item.expireTime) {
        delete this.data[key];
      }
    });
  }

  // 获取缓存统计信息
  getStats() {
    const total = Object.keys(this.data).length;
    const expired = Object.values(this.data).filter(
      item => item.expireTime && Date.now() > item.expireTime
    ).length;
    
    return {
      total,
      active: total - expired,
      expired,
    };
  }

  // 清空所有缓存
  clear() {
    this.data = {};
  }
}
