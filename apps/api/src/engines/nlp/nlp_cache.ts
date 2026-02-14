import { RedisService } from '../../redis/redis.service';
import { createHash } from 'crypto';

/**
 * NLP Cache Wrapper
 * 统一处理 Hash 生成和 Redis 存取
 */
export class NlpCache {
  constructor(private readonly redis: RedisService) {}

  /**
   * 生成基于 Payload 的唯一 Key
   */
  generateKey(engineName: string, payload: any): string {
    const str = JSON.stringify(payload);
    const hash = createHash('sha256').update(str).digest('hex');
    return `nlp_cache:${engineName}:v1:${hash}`;
  }

  async get(key: string): Promise<any | null> {
    try {
      return await this.redis.getJson(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 60 * 60 * 24 * 7): Promise<void> {
    await this.redis.setJson(key, value, ttlSeconds);
  }
}
