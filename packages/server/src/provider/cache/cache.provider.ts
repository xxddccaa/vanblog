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
  private redisConnectPromise: Promise<void> | null = null;

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
      if (!this.redisConnectPromise) {
        this.redisConnectPromise = this.redis.connect().then(() => {
          this.redisReady = true;
        });
      }
      try {
        await this.redisConnectPromise;
      } catch (error) {
        this.redisFailed = true;
        this.logger.warn(`Redis 不可用，回退到内存缓存: ${error?.message || error}`);
        return null;
      } finally {
        this.redisConnectPromise = null;
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

  async setIfAbsent(key: string, value: any, ttlSeconds?: number) {
    const redis = await this.getRedis();
    const payload = JSON.stringify(value);
    if (redis) {
      const result = ttlSeconds
        ? await redis.set(key, payload, 'EX', ttlSeconds, 'NX')
        : await redis.set(key, payload, 'NX');
      if (result !== 'OK') return false;
      this.storeInMemory(key, value, ttlSeconds);
      return true;
    }
    if (this.readFromMemory(key) !== null) return false;
    this.storeInMemory(key, value, ttlSeconds);
    return true;
  }

  async incrementWithTtl(key: string, ttlSeconds: number) {
    const redis = await this.getRedis();
    if (redis) {
      return Number(
        await redis.eval(
          `
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then
              redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return current
          `,
          1,
          key,
          String(ttlSeconds),
        ),
      );
    }

    // There is no await between the read and write, so this fallback is
    // atomic within one Node.js process when Redis is unavailable.
    const current = Number(this.readFromMemory(key) || 0) + 1;
    this.storeInMemory(key, current, ttlSeconds);
    return current;
  }

  async delIfValue(key: string, expectedValue: any) {
    const redis = await this.getRedis();
    let deleted = false;
    if (redis) {
      const result = await redis.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        1,
        key,
        JSON.stringify(expectedValue),
      );
      deleted = Number(result) > 0;
    } else if (this.readFromMemory(key) === expectedValue) {
      deleted = true;
    }
    if (deleted) this.memory.delete(key);
    return deleted;
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
