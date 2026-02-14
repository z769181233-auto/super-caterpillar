/**
 * A5任务：分布式锁实现
 * 
 * 基于Redis的分布式锁，防止Billing并发竞态条件
 * 
 * 特性：
 * - 基于SET NX EX的原子操作
 * - 自动过期防止死锁
 * - 锁续期支持（长时间操作）
 * - 安全释放（验证ownership）
 * 
 * @see docs/_evidence/A5_TASK_COMPLETION_REPORT.md
 */

import Redis from 'ioredis';

export interface DistributedLockConfig {
    /** Redis 客户端 */
    redis: Redis;

    /** 锁的默认过期时间（毫秒） */
    defaultTTL?: number;

    /** 获取锁的最大重试次数 */
    maxRetries?: number;

    /** 重试间隔（毫秒） */
    retryDelay?: number;
}

/**
 * 分布式锁实现
 */
export class DistributedLock {
    private redis: Redis;
    private defaultTTL: number;
    private maxRetries: number;
    private retryDelay: number;

    constructor(config: DistributedLockConfig) {
        this.redis = config.redis;
        this.defaultTTL = config.defaultTTL || 10000; // 默认10秒
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 100;
    }

    /**
     * 获取锁
     * @param key 锁的键名
     * @param ttl 锁的生存时间（毫秒）
     * @returns 锁的标识符（用于释放）或 null（获取失败）
     */
    async acquire(key: string, ttl?: number): Promise<string | null> {
        const lockValue = this.generateLockValue();
        const lockTTL = ttl || this.defaultTTL;
        const lockTTLSeconds = Math.ceil(lockTTL / 1000);

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            // 使用 SET NX EX 原子操作
            const result = await this.redis.set(
                key,
                lockValue,
                'EX',
                lockTTLSeconds,
                'NX'
            );

            if (result === 'OK') {
                console.log(`[DistributedLock] Acquired lock: ${key} (${lockValue})`);
                return lockValue;
            }

            // 获取失败，重试前等待
            if (attempt < this.maxRetries) {
                await this.sleep(this.retryDelay * (attempt + 1)); // 增量退避
            }
        }

        console.warn(`[DistributedLock] Failed to acquire lock after ${this.maxRetries + 1} attempts: ${key}`);
        return null;
    }

    /**
     * 释放锁（安全释放，验证ownership）
     */
    async release(key: string, lockValue: string): Promise<boolean> {
        // Lua脚本确保原子性：只有锁的所有者才能释放
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

        try {
            const result = await this.redis.eval(script, 1, key, lockValue);
            const released = result === 1;

            if (released) {
                console.log(`[DistributedLock] Released lock: ${key} (${lockValue})`);
            } else {
                console.warn(`[DistributedLock] Failed to release lock (not owner or expired): ${key}`);
            }

            return released;
        } catch (error) {
            console.error(`[DistributedLock] Error releasing lock: ${error.message}`);
            return false;
        }
    }

    /**
     * 扩展锁的生存时间（锁续期）
     */
    async extend(key: string, lockValue: string, additionalTTL: number): Promise<boolean> {
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

        try {
            const ttlSeconds = Math.ceil(additionalTTL / 1000);
            const result = await this.redis.eval(script, 1, key, lockValue, ttlSeconds);
            return result === 1;
        } catch (error) {
            console.error(`[DistributedLock] Error extending lock: ${error.message}`);
            return false;
        }
    }

    /**
     * 使用锁执行函数（自动获取和释放）
     */
    async withLock<T>(
        key: string,
        fn: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        const lockValue = await this.acquire(key, ttl);

        if (!lockValue) {
            throw new Error(`Failed to acquire lock: ${key}`);
        }

        try {
            const result = await fn();
            return result;
        } finally {
            await this.release(key, lockValue);
        }
    }

    /**
     * 生成唯一的锁标识符
     */
    private generateLockValue(): string {
        return `${process.pid}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 便捷工厂函数
 */
export function createDistributedLock(redis: Redis, config?: Partial<DistributedLockConfig>): DistributedLock {
    return new DistributedLock({
        redis,
        ...config,
    });
}
