import { PrismaClient, JobType, JobStatus } from 'database';
import { ApiClient } from '../api-client';
import { WorkerJobBase } from '@scu/shared-types';
import * as util from 'util';

/**
 * 结构化日志输出函数
 */
function logStructured(level: 'info' | 'warn' | 'error', data: Record<string, any>): void {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const logMessage = JSON.stringify(logEntry);
  if (level === 'error') {
    process.stderr.write(util.format(logMessage) + '\n');
  } else if (level === 'warn') {
    process.stdout.write(util.format(logMessage) + '\n');
  } else {
    process.stdout.write(util.format(logMessage) + '\n');
  }
}

import { ProcessorContext } from '../types/processor-context';

export interface E2EVideoPipelinePayload {
  projectId: string; // 必须
  pipelineRunId?: string; // 可选，若不传则使用 jobId
  novelSourceId?: string; // 可选
  traceId?: string; // 可选
  [key: string]: any;
}

export interface E2EVideoPipelineOutput {
  status: string;
  pipelineRunId: string;
  spawned: {
    ce06JobId?: string;
  };
}

/**
 * 处理 PIPELINE_E2E_VIDEO Job
 * 策略: Fire-and-forget (Spawn CE06 and exit)
 */
export async function processE2EVideoPipelineJob(
  ctx: ProcessorContext
): Promise<E2EVideoPipelineOutput> {
  const { prisma, job, apiClient } = ctx;
  const jobId = job.id;
  const payload = job.payload as E2EVideoPipelinePayload;
  const projectId = job.projectId || payload.projectId;

  // 1. 确定 pipelineRunId
  // 如果 payload 里传了 pipelineRunId，就用传的；否则用当前 job.id 作为 runId
  const pipelineRunId = payload.pipelineRunId || jobId;

  // TraceId 透传
  const traceId = job.traceId || payload.traceId || `trace-${jobId}`;

  // 审计: Pipeline Start
  // 使用 SUCCESS 状态但明确 action 为 start
  await apiClient
    .postAuditLog({
      traceId,
      projectId,
      jobId,
      jobType: JobType.PIPELINE_E2E_VIDEO,
      engineKey: 'pipeline_orchestrator',
      status: 'SUCCESS',
      auditTrail: {
        action: 'pipeline.e2e_video.start',
        phase: 'start',
        pipelineRunId,
      },
    })
    .catch((e) => logStructured('warn', { action: 'AUDIT_FAIL_START', error: e.message }));

  logStructured('info', {
    action: 'PIPELINE_START',
    jobId,
    pipelineRunId,
    projectId,
  });

  try {
    // 2. 幂等检查: 是否已经存在属于该 pipelineRunId 的 CE06 Job
    // 关键修正: 必须加上 projectId, organizationId 隔离

    // 获取 OrgId (后面 fallback 逻辑里有更详细获取，但这里幂等查询需要)
    const initialOrgId = (job as any).organizationId;

    const idempotencyWhere: any = {
      type: JobType.CE06_NOVEL_PARSING,
      projectId,
      payload: {
        path: ['pipelineRunId'],
        equals: pipelineRunId,
      },
    };

    if (initialOrgId) {
      idempotencyWhere.organizationId = initialOrgId;
    }

    const existingCE06 = await prisma.shotJob.findFirst({
      where: idempotencyWhere,
      select: { id: true },
    });

    if (existingCE06) {
      logStructured('info', {
        action: 'PIPELINE_IDEMPOTENT_HIT',
        jobId,
        pipelineRunId,
        existingCE06Job: existingCE06.id,
      });

      await apiClient
        .postAuditLog({
          traceId,
          projectId,
          jobId,
          jobType: JobType.PIPELINE_E2E_VIDEO,
          engineKey: 'pipeline_orchestrator',
          status: 'SUCCESS',
          auditTrail: {
            action: 'pipeline.e2e_video.idempotent_hit',
            existingCE06Job: existingCE06.id,
          },
        })
        .catch(() => {});

      return {
        status: 'SPAWNED_CE06', // 逻辑上已成功
        pipelineRunId,
        spawned: {
          ce06JobId: existingCE06.id,
        },
      };
    }

    // 3. Spawn CE06 Job (Fire-and-forget)
    // 商业级收口: 关系字段获取 (DB -> Job -> Payload -> User Error)

    let orgId: string | undefined;
    let episodeId: string | undefined;
    let sceneId: string | undefined;
    let shotId: string | undefined;

    // A. 尝试从 DB 获取 (SSOT)
    const jobRecord = await prisma.shotJob.findUnique({
      where: { id: jobId },
      select: {
        organizationId: true,
        episodeId: true,
        sceneId: true,
        shotId: true,
      },
    });

    if (jobRecord) {
      orgId = jobRecord.organizationId;
      episodeId = jobRecord.episodeId ?? undefined;
      sceneId = jobRecord.sceneId ?? undefined;
      shotId = jobRecord.shotId ?? undefined;
    }

    // B. DB 缺失，尝试从 Job 对象本身 (WorkerJobBase 可能携带)
    if (!orgId) orgId = (job as any).organizationId;
    if (!episodeId) episodeId = (job as any).episodeId;
    if (!sceneId) sceneId = (job as any).sceneId;
    if (!shotId) shotId = (job as any).shotId;

    // C. 仍然缺失，尝试从 Payload
    if (!orgId) orgId = payload.organizationId;
    if (!episodeId) episodeId = payload.episodeId;
    if (!sceneId) sceneId = payload.sceneId;
    if (!shotId) shotId = payload.shotId;

    // 终极校验
    const missingFields: string[] = [];
    if (!orgId) missingFields.push('organizationId');
    if (!episodeId) missingFields.push('episodeId');
    if (!sceneId) missingFields.push('sceneId');
    if (!shotId) missingFields.push('shotId');

    if (missingFields.length > 0) {
      const errMsg = `Missing mandatory relation IDs: ${missingFields.join(', ')}. Pipeline cannot proceed without context.`;
      await apiClient
        .postAuditLog({
          traceId,
          projectId,
          jobId,
          jobType: JobType.PIPELINE_E2E_VIDEO,
          engineKey: 'pipeline_orchestrator',
          status: 'FAILED',
          errorMessage: errMsg,
          auditTrail: {
            action: 'pipeline.e2e_video.fail.missing_context',
            missingFields,
          },
        })
        .catch(() => {});
      throw new Error(errMsg);
    }

    // 3. Spawn CE06 Job (Fire-and-forget)
    const ce06Job = await prisma.shotJob.create({
      data: {
        projectId,
        organizationId: orgId!,
        type: JobType.CE06_NOVEL_PARSING,
        status: JobStatus.PENDING,
        traceId,
        payload: {
          projectId,
          novelSourceId: payload.novelSourceId,
          raw_text:
            payload.raw_text || payload.sourceText || `GATE_MOCK_PROD_SLICE_TEXT_${Date.now()}`,
          pipelineRunId,
          rootJobId: jobId,
        },
        episodeId: episodeId!,
        sceneId: sceneId!,
        shotId: shotId!,
      },
    });
    const newCE06 = ce06Job;

    logStructured('info', {
      action: 'PIPELINE_SPAWN_CE06',
      jobId,
      newCE06JobId: newCE06.id,
    });

    // 4. Client State Persistence & Audit
    await apiClient
      .postAuditLog({
        traceId,
        projectId,
        jobId,
        jobType: JobType.PIPELINE_E2E_VIDEO, // Keep type
        engineKey: 'pipeline_orchestrator',
        status: 'SUCCESS',
        auditTrail: {
          action: 'pipeline.e2e_video.spawn.ce06',
          ce06JobId: newCE06.id,
        },
      })
      .catch(() => {});

    // Return success immediately (Non-blocking)
    return {
      status: 'SPAWNED_CE06',
      pipelineRunId,
      spawned: {
        ce06JobId: newCE06.id,
      },
    };

    return {
      status: 'SPAWNED_CE06',
      pipelineRunId,
      spawned: {
        ce06JobId: newCE06.id,
      },
    };
  } catch (error: any) {
    logStructured('error', {
      action: 'PIPELINE_FAILED',
      jobId,
      error: error.message,
    });

    await apiClient
      .postAuditLog({
        traceId,
        projectId,
        jobId,
        jobType: JobType.PIPELINE_E2E_VIDEO,
        engineKey: 'pipeline_orchestrator',
        status: 'FAILED',
        errorMessage: error.message,
        auditTrail: {
          action: 'pipeline.e2e_video.fail',
        },
      })
      .catch(() => {});

    throw error;
  }
}
