import { TokenBucket } from './token-bucket';
import { env } from '@scu/config';

/**
 * EngineLimiter
 * 针对不同引擎执行实例的并发限流器。
 */
export class EngineLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private globalBucket: TokenBucket;
  constructor() {
    const config = env as any;
    this.globalBucket = new TokenBucket(config.maxInFlightTotal);
  }

  /**
   * 获取（或创建）指定引擎的令牌桶
   */
  private getBucket(engineKey: string): TokenBucket {
    let bucket = this.buckets.get(engineKey);
    if (!bucket) {
      const limit = (env as any).getEngineConcurrency(engineKey);
      bucket = new TokenBucket(limit);
      this.buckets.set(engineKey, bucket);
    }
    return bucket;
  }

  /**
   * 尝试获取执行所需的全部令牌
   * 顺序：Total -> Engine
   */
  acquire(engineKey: string): boolean {
    if (!(env as any).concurrencyLimiterEnabled) return true;

    // 1. 尝试获取全局令牌
    if (!this.globalBucket.acquire()) {
      return false;
    }

    // 2. 尝试获取引擎令牌
    const engineBucket = this.getBucket(engineKey);
    if (!engineBucket.acquire()) {
      // 获取失败，回退全局令牌
      this.globalBucket.release();
      return false;
    }

    return true;
  }

  /**
   * 释放令牌
   */
  release(engineKey: string): void {
    if (!(env as any).concurrencyLimiterEnabled) return;

    this.getBucket(engineKey).release();
    this.globalBucket.release();
  }

  /**
   * 获取状态摘要
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {
      global: {
        available: this.globalBucket.getAvailable(),
        max: this.globalBucket.getMax(),
      },
      engines: {},
    };

    for (const [key, bucket] of this.buckets.entries()) {
      stats.engines[key] = {
        available: bucket.getAvailable(),
        max: bucket.getMax(),
      };
    }

    return stats;
  }
}

// 导出单例用于 Worker 进程
export const engineLimiter = new EngineLimiter();
