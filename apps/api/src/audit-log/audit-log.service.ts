import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHmac, randomBytes, createHash } from 'crypto';

/**
 * 审计日志服务
 * 负责记录关键操作的审计日志
 *
 * 设计原则：
 * - 写入失败不得影响主业务流程
 * - 异步写入，不阻塞请求
 * - 记录关键信息，便于后续审计和风控
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 记录审计日志
   * S1-FIX-A: 新增 payload 字段，包含所有审计信息的完整快照
   * @param options 审计日志选项
   */
  async record(options: {
    userId?: string;
    orgId?: string;
    apiKeyId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ip?: string;
    userAgent?: string;
    details?: any;
    traceId?: string;
    // nonce, signature, timestamp can be passed from request (V1.1 columns)
    nonce?: string;
    signature?: string;
    timestamp?: Date;
    req?: any; // Phase-C: Supporting request object for auto-header extraction
  }): Promise<void> {
    try {
      const { req } = options;

      // PHASE-C: Capture Request-level Evidence (Spec V1.1)
      const reqNonce =
        options.nonce || req?.headers['x-nonce'] || req?.headers['x-hmac-nonce'] || req?.hmacNonce;
      const reqSignature =
        options.signature ||
        req?.headers['x-signature'] ||
        req?.headers['x-hmac-signature'] ||
        req?.hmacSignature;
      const reqTimestampStr =
        req?.headers['x-timestamp'] || req?.headers['x-hmac-timestamp'] || req?.hmacTimestamp;
      const reqTimestamp =
        options.timestamp || (reqTimestampStr ? new Date(reqTimestampStr) : undefined);

      const ip = options.ip || req?.ip || req?.headers['x-forwarded-for'];
      const userAgent = options.userAgent || req?.headers['user-agent'];
      const traceId = options.traceId || `trace-${randomBytes(8).toString('hex')}`;

      // Server-level Integrity Evidence (Prevent log tampering)
      const serverTimestamp = new Date();
      const serverNonce = randomBytes(16).toString('hex');

      const details = options.details ? { ...options.details } : {};
      details._traceId = traceId;

      let detailsStr = '';
      try {
        // [P6-0 Fix] Avoid stringifying huge objects repeatedly
        detailsStr = JSON.stringify(details);
      } catch (e) {
        detailsStr = '[UNSERIALIZABLE]';
      }
      const detailsDigest = createHash('sha256').update(detailsStr).digest('hex');

      const signBase = [
        options.action,
        options.resourceType,
        options.resourceId || '',
        serverTimestamp.toISOString(),
        serverNonce,
        detailsDigest,
        traceId,
      ].join('|');

      const secret = process.env.AUDIT_SIGNING_SECRET;
      const recordSignature = createHmac(
        'sha256',
        secret || 'EMERGENCY_UNSECURE_FALLBACK_SUPER_CATERPILLAR'
      )
        .update(signBase)
        .digest('hex');

      const payload = {
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.resourceId ?? null,
        orgId: options.orgId ?? null,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        nonce: reqNonce || serverNonce,
        signature: reqSignature || recordSignature,
        timestamp: (reqTimestamp || serverTimestamp).toISOString(),
        details,
        traceId,
        auditKeyVersion: 'v1',
      };

      await this.prisma.auditLog.create({
        data: {
          userId: options.userId,
          orgId: options.orgId,
          apiKeyId: options.apiKeyId,
          action: options.action,
          resourceType: options.resourceType,
          resourceId: options.resourceId,
          ip: ip as any,
          userAgent: userAgent as any,
          details: details as any,
          nonce: reqNonce || serverNonce,
          signature: reqSignature || recordSignature,
          timestamp: reqTimestamp || serverTimestamp,
          payload: payload as any,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to record audit log: ${options.action} for ${options.resourceType}:${options.resourceId}`,
        error?.stack
      );
    }
  }

  /**
   * 从请求对象中提取 IP 和 UserAgent
   * @param request Express Request 对象
   * @returns { ip: string | undefined, userAgent: string | undefined }
   */
  static extractRequestInfo(request: any): { ip?: string; userAgent?: string } {
    return {
      ip: request.ip || request.headers['x-forwarded-for'] || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'],
    };
  }
}
