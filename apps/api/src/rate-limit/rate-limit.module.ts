import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { FineGrainedRateLimitGuard } from './rate-limit.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 分钟
        limit: 10000, // 默认 10000 次/分钟 (压测支持)
      },
      {
        name: 'auth',
        ttl: 60000, // 1 分钟
        limit: 10, // 鉴权接口：10 次/分钟
      },
      {
        name: 'signature',
        ttl: 60000, // 1 分钟
        limit: 30, // 签名接口：30 次/分钟
      },
      {
        name: 'download',
        ttl: 60000, // 1 分钟
        limit: 200, // 下载接口：200 次/分钟
      },
    ]),
  ],
  providers: [FineGrainedRateLimitGuard],
  exports: [FineGrainedRateLimitGuard],
})
export class RateLimitModule {}
