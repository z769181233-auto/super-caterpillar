import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis 模块（全局模块）
 * 提供统一的 Redis 服务
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

