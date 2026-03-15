import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { env } from '@scu/config';

/**
 * Redis 服务
 * 提供统一的 Redis 操作接口
 * 支持容错：Redis 挂掉时不影响主链路
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected = false;

  async onModuleInit() {
    try {
      const redisUrl = env.redisUrl || 'redis://localhost:6379';
      const redisDisabled =
        process.env.DISABLE_REDIS === 'true' ||
        ['disabled', 'off', 'none'].includes(String(redisUrl).trim().toLowerCase());

      if (redisDisabled) {
        this.logger.warn('Redis disabled by environment; falling back to direct DB queries');
        this.client = null;
        this.isConnected = false;
        return;
      }

      this.logger.log(`Connecting to Redis: ${redisUrl.replace(/\/\/.*@/, '//***@')}`);

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              this.logger.error('Redis connection failed after 10 retries, giving up');
              return false; // 停止重连
            }
            return Math.min(retries * 100, 3000); // 最多等待 3 秒
          },
        },
      });

      this.client.on('error', (err: Error) => {
        this.logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        this.logger.warn('Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      this.logger.log('Redis service initialized');
    } catch (error: any) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`);
      this.logger.warn('Redis operations will be disabled, falling back to direct DB queries');
      this.client = null;
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Redis connection closed');
      } catch (error: any) {
        this.logger.error(`Error closing Redis connection: ${error.message}`);
      }
    }
  }

  /**
   * 检查 Redis 是否可用
   */
  private isAvailable(): boolean {
    return this.client !== null && this.isConnected;
  }

  /**
   * 获取字符串值
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client!.get(key);
      return value === null ? null : (typeof value === 'string' ? value : (value as any).toString());
    } catch (error: any) {
      this.logger.warn(`Redis GET failed for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * 设置字符串值（带 TTL）
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (error: any) {
      this.logger.warn(`Redis SET failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * 仅当 key 不存在时设置（带 TTL）
   */
  async setNx(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.set(key, value, {
        NX: true,
        ...(ttlSeconds ? { EX: ttlSeconds } : {}),
      });
      return result === 'OK';
    } catch (error: any) {
      this.logger.warn(`Redis SET NX failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.del(key);
      return true;
    } catch (error: any) {
      this.logger.warn(`Redis DEL failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取 JSON 对象
   */
  async getJson<T = any>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error: any) {
      this.logger.warn(`Redis GET JSON failed for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * 设置 JSON 对象（带 TTL）
   */
  async setJson(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value);
      return await this.set(key, jsonString, ttlSeconds);
    } catch (error: any) {
      this.logger.warn(`Redis SET JSON failed for key ${key}: ${error.message}`);
      return false;
    }
  }
}
