import { Injectable } from '@nestjs/common';
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
  ua?: string | null; // 兼容旧字段名
  details?: any;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    try {
      // 使用 audit_logs 表（第二个 AuditLog 模型）
      await (this.prisma as any).auditLog.create({
        data: {
          userId: input.userId || null,
          apiKeyId: input.apiKeyId || null,
          action: input.action,
          resourceType: input.resourceType || 'unknown', // 第二个模型要求非空
          resourceId: input.resourceId || null,
          ip: input.ip || null,
          userAgent: input.userAgent || input.ua || null,
          details: input.details ? (input.details as any) : {},
        },
      });
    } catch (err) {
      // 审计写入失败不影响主流程，按规范可选记录日志
      // console.error('Audit log failed', err);
    }
  }
}
