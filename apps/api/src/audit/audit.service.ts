import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AuditLogInput {
  userId?: string | null;
  organizationId?: string | null;
  apiKeyId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  traceId?: string;
  ip?: string | null;
  userAgent?: string | null;
  ua?: string | null; // 旧字段名，映射到 userAgent
  details?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  private asNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  async log(input: AuditLogInput) {
    try {
      const resourceType = this.asNonEmptyString(input.resourceType);
      if (!resourceType) {
        this.logger.warn(`Audit log skipped: missing resourceType for action ${input.action}`);
        return;
      }

      // 使用 audit_logs 表（第二个 AuditLog 模型）
      await (this.prisma as any).auditLog.create({
        data: {
          userId: input.userId || null,
          apiKeyId: input.apiKeyId || null,
          action: input.action,
          resourceType,
          resourceId: input.resourceId || null,
          ip: input.ip || null,
          userAgent: input.userAgent || input.ua || null,
          details: input.details ? (input.details as any) : {},
        },
      });
    } catch (err) {
      // 审计写入失败不影响主流程，按规范记录日志
      this.logger.error(`Audit log failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
