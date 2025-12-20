import { Module, forwardRef } from '@nestjs/common';
import { HmacAuthService } from './hmac-auth.service';
import { HmacAuthGuard } from './hmac-auth.guard';
import { ApiKeyService } from './api-key.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { ApiSecurityModule } from '../../security/api-security/api-security.module';
import { NonceModule } from '../nonce.module';

/**
 * HMAC 认证模块
 * 提供 API Key + HMAC 签名验证能力
 */
@Module({
  imports: [PrismaModule, RedisModule, forwardRef(() => AuditLogModule), ApiSecurityModule, NonceModule],
  providers: [HmacAuthService, HmacAuthGuard, ApiKeyService],
  exports: [HmacAuthService, HmacAuthGuard, ApiKeyService, NonceModule],
})
export class HmacAuthModule { }









