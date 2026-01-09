/**
 * Stage3-A: 运维诊断接口
 * 仅用于 dev/管理员环境，用于快速定位 Job 问题
 */

import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('ops')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class OpsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/ops/jobs/:id/diagnose
   * 诊断 Job 状态（仅 dev/管理员）
   */
  @Get('jobs/:id/diagnose')
  async diagnoseJob(@Param('id') jobId: string) {
    // 检查环境（生产环境禁止）
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_OPS_ENDPOINTS) {
      throw new NotFoundException('Diagnostic endpoint not available in production');
    }

    // 查询 Job
    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: {
        worker: true,
        task: true,
        engineBinding: {
          include: {
            engine: true,
            engineVersion: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // 查询最近 20 条 audit_logs
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        resourceId: jobId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    return {
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        priority: job.priority,
        maxRetry: job.maxRetry,
        retryCount: job.retryCount,
        attempts: job.attempts,
        workerId: job.workerId,
        worker: job.worker
          ? {
              id: job.worker.id,
              workerId: job.worker.workerId,
              status: job.worker.status,
              lastHeartbeat: job.worker.lastHeartbeat,
            }
          : null,
        taskId: job.taskId,
        task: job.task
          ? {
              id: job.task.id,
              type: job.task.type,
              status: job.task.status,
            }
          : null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        lastError: job.lastError,
        traceId: job.traceId,
      },
      engineBinding: job.engineBinding
        ? {
            id: job.engineBinding.id,
            engineId: job.engineBinding.engineId,
            engineKey: job.engineBinding.engineKey,
            engineVersionId: job.engineBinding.engineVersionId,
            status: job.engineBinding.status,
            boundAt: job.engineBinding.boundAt,
            executedAt: job.engineBinding.executedAt,
            completedAt: job.engineBinding.completedAt,
            errorMessage: job.engineBinding.errorMessage,
            engine: job.engineBinding.engine
              ? {
                  id: job.engineBinding.engine.id,
                  engineKey: job.engineBinding.engine.engineKey,
                  adapterName: job.engineBinding.engine.adapterName,
                  enabled: job.engineBinding.engine.enabled,
                }
              : null,
            engineVersion: job.engineBinding.engineVersion
              ? {
                  id: job.engineBinding.engineVersion.id,
                  versionName: job.engineBinding.engineVersion.versionName,
                  enabled: job.engineBinding.engineVersion.enabled,
                }
              : null,
          }
        : null,
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        details: log.details,
        createdAt: log.createdAt,
      })),
    };
  }
}
