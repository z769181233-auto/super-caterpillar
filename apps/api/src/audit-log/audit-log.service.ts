import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录审计日志
   * S1-FIX-A: 新增 payload 字段，包含所有审计信息的完整快照
   * @param options 审计日志选项
   */
  async record(options: {
    userId?: string;
    orgId?: string; // Stage 10
    apiKeyId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ip?: string;
    userAgent?: string;
    details?: any;
    nonce?: string;
    signature?: string;
    timestamp?: Date;
  }): Promise<void> {
    try {
      // S1-FIX-A: 组装 payload，包含所有审计信息的完整快照
      const payload = {
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.resourceId ?? null,
        orgId: options.orgId ?? null,
        ip: options.ip ?? null,
        userAgent: options.userAgent ?? null,
        nonce: options.nonce ?? null,
        signature: options.signature ?? null,
        timestamp: options.timestamp ? options.timestamp.toISOString() : null,
        details: options.details ? JSON.parse(JSON.stringify(options.details)) : null,
      };

      await (this.prisma as any).auditLog.create({
        data: {
          userId: options.userId,
          orgId: options.orgId,
          apiKeyId: options.apiKeyId,
          action: options.action,
          resourceType: options.resourceType,
          resourceId: options.resourceId,
          ip: options.ip,
          userAgent: options.userAgent,
          details: options.details ? JSON.parse(JSON.stringify(options.details)) : null,
          nonce: options.nonce,
          signature: options.signature,
          ...(options.timestamp !== undefined && { timestamp: options.timestamp }),
          payload: payload, // S1-FIX-A: 新增 payload 字段
        },
      });
    } catch (error) {
      // 写入失败时只记录警告，不抛出异常，避免影响主业务流程
      this.logger.warn(
        `Failed to record audit log: ${options.action} for ${options.resourceType}:${options.resourceId}`,
        error instanceof Error ? error.stack : String(error)
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
