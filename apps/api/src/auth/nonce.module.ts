import { Module } from '@nestjs/common';
import { NonceService } from './nonce.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../redis/redis.module';

/**
 * NonceModule
 * 提供 Nonce 防重放服务
 */
@Module({
  imports: [PrismaModule, AuditModule, RedisModule],
  providers: [NonceService],
  exports: [NonceService],
})
export class NonceModule {}

