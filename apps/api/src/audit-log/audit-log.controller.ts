/**
 * Audit Log Controller
 * Stage13: 提供 Worker 上报审计日志的 API 端点
 */

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { HmacAuthGuard } from '../auth/hmac/hmac-auth.guard';

interface CEAuditLogPayload {
  traceId: string;
  projectId: string;
  jobId: string;
  jobType: string;
  engineKey: string;
  status: 'SUCCESS' | 'FAILED';
  inputHash?: string;
  outputHash?: string;
  latencyMs?: number;
  cost?: number;
  auditTrail?: any;
  errorMessage?: string;
}

@Controller('audit')
@UseGuards(HmacAuthGuard) // 使用 HMAC 认证，确保只有 Worker 可以调用
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Worker 上报审计日志
   * POST /api/audit/logs
   */
  @Post('logs')
  async createAuditLog(@Body() payload: CEAuditLogPayload): Promise<{ success: boolean }> {
    try {
      // 将 CE 审计信息写入 details
      const details = {
        traceId: payload.traceId,
        projectId: payload.projectId,
        jobId: payload.jobId,
        jobType: payload.jobType,
        engineKey: payload.engineKey,
        status: payload.status,
        inputHash: payload.inputHash,
        outputHash: payload.outputHash,
        latencyMs: payload.latencyMs,
        cost: payload.cost,
        auditTrail: payload.auditTrail,
        errorMessage: payload.errorMessage,
      };

      await this.auditLogService.record({
        action: `CE_${payload.engineKey.toUpperCase()}_${payload.status}`,
        resourceType: 'job',
        resourceId: payload.jobId,
        details,
      });

      return { success: true };
    } catch (error) {
      // 审计写入失败不影响主流程
      console.error('Failed to create audit log:', error);
      return { success: false };
    }
  }
}
