import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private readonly prisma: PrismaService) { }

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
    // nonce, signature, timestamp are now server-generated
  }): Promise<void> {
    try {
      // SSOT: Server-generated evidence (Mandatory for Commercial Grade)
      const timestamp = new Date();
      const nonce = randomBytes(16).toString('hex');
      const traceId = options.traceId || `trace-${randomBytes(8).toString('hex')}`;

      // Inject traceId into details for persistence without dedicated column
      const details = options.details ? { ...options.details } : {};
      details._traceId = traceId;

      const detailsStr = JSON.stringify(details);
      const detailsDigest = createHash('sha256').update(detailsStr).digest('hex');

      const signBase = [
        options.action,
        options.resourceType,
        options.resourceId || '',
        timestamp.toISOString(),
        nonce,
        detailsDigest,
        traceId // Keep in signature payload
      ].join('|');

      const secret = process.env.JWT_SECRET || 'test-secret';
      const signature = createHmac('sha256', secret).update(signBase).digest('hex');

      const payload = {
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.resourceId ?? null,
        orgId: options.orgId ?? null,
        ip: options.ip ?? null,
        userAgent: options.userAgent ?? null,
        nonce,
        signature,
        timestamp: timestamp.toISOString(),
        details,
        traceId,
      };

      await this.prisma.auditLog.create({
        data: {
          userId: options.userId,
          orgId: options.orgId,
          apiKeyId: options.apiKeyId,
          action: options.action,
          resourceType: options.resourceType,
          resourceId: options.resourceId,
          ip: options.ip,
          userAgent: options.userAgent,
          details: details as any,
          nonce,
          signature,
          timestamp,
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
