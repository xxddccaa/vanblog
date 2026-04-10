import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from 'src/config';

interface CacheItem {
  value: any;
  expireTime?: number;
}

@Injectable()
export class CacheProvider {
  private readonly logger = new Logger(CacheProvider.name);
  private readonly memory = new Map<string, CacheItem>();
  private redis: Redis | null = null;
  private redisReady = false;
  private redisFailed = false;

  private async getRedis() {
    if (this.redisFailed || !config.redisUrl) {
      return null;
    }
    if (!this.redis) {
      this.redis = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    }
    if (!this.redisReady) {
      try {
        await this.redis.connect();
        this.redisReady = true;
      } catch (error) {
        this.redisFailed = true;
        this.logger.warn(`Redis 不可用，回退到内存缓存: ${error?.message || error}`);
        return null;
      }
    }
    return this.redis;
  }

  private storeInMemory(key: string, value: any, ttlSeconds?: number) {
    this.memory.set(key, {
      value,
      expireTime: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  private readFromMemory(key: string) {
    const item = this.memory.get(key);
    if (!item) {
      return null;
    }
    if (item.expireTime && Date.now() > item.expireTime) {
      this.memory.delete(key);
      return null;
    }
    return item.value;
  }

  async get(key: string) {
    const redis = await this.getRedis();
    if (redis) {
      const raw = await redis.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    }
    return this.readFromMemory(key);
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    this.storeInMemory(key, value, ttlSeconds);
    const redis = await this.getRedis();
    if (!redis) {
      return;
    }
    const payload = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.set(key, payload, 'EX', ttlSeconds);
      return;
    }
    await redis.set(key, payload);
  }

  async del(key: string) {
    this.memory.delete(key);
    const redis = await this.getRedis();
    if (redis) {
      await redis.del(key);
    }
  }

  async delPattern(pattern: string) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    for (const key of this.memory.keys()) {
      if (regex.test(key)) {
        this.memory.delete(key);
      }
    }

    const redis = await this.getRedis();
    if (!redis) {
      return;
    }

    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.memory.entries()) {
      if (item.expireTime && now > item.expireTime) {
        this.memory.delete(key);
      }
    }
  }

  async getStats() {
    this.cleanup();
    return {
      total: this.memory.size,
      active: this.memory.size,
      expired: 0,
      backend: this.redisFailed || !config.redisUrl ? 'memory' : 'redis',
    };
  }

  async clear() {
    this.memory.clear();
    const redis = await this.getRedis();
    if (redis) {
      await redis.flushdb();
    }
  }
}
