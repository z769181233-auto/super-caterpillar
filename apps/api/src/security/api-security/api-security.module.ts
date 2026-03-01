import { Module, forwardRef } from '@nestjs/common';
import { ApiSecurityService } from './api-security.service';
import { ApiSecurityGuard } from './api-security.guard';
import { SecretEncryptionService } from './secret-encryption.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';

/**
 * API Security Module
 *
 * 提供 API 安全功能：
 * - HMAC-SHA256 签名验证
 * - 时间戳窗口校验（±5 分钟）
 * - Nonce 防重放（Redis TTL 5 分钟）
 * - 审计日志记录
 *
 * 使用方式：
 * 1. 在 Controller 方法上使用 @RequireSignature() 装饰器
 * 2. 在 Controller 或 Module 上使用 @UseGuards(ApiSecurityGuard)
 *
 * 参考文档：
 * - 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》
 */
@Module({
  imports: [PrismaModule, RedisModule, forwardRef(() => AuditLogModule)],
  providers: [ApiSecurityService, ApiSecurityGuard, SecretEncryptionService],
  exports: [ApiSecurityService, ApiSecurityGuard, SecretEncryptionService],
})
export class ApiSecurityModule {}
