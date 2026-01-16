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
export async function processE2EVideoPipelineJob(ctx: ProcessorContext): Promise<E2EVideoPipelineOutput> {
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
        .catch(() => { });

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
        .catch(() => { });
      throw new Error(errMsg);
    }


    /**
     * Polling Helper: Wait for a job to reach a terminal state
     */
    async function waitForJobSuccess(
      prisma: PrismaClient,
      jobId: string,
      timeoutMs: number = 300000,
      intervalMs: number = 2000
    ): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const job = await prisma.shotJob.findUnique({
          where: { id: jobId },
          select: { status: true, lastError: true, result: true },
        });

        if (!job) throw new Error(`Job ${jobId} not found while waiting`);

        if (job.status === 'SUCCEEDED') return;
        if (job.status === 'FAILED') {
          throw new Error(`Job ${jobId} failed: ${job.lastError || 'Unknown error'}`);
        }
        // PENDING / RUNNING -> Wait
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
    }

    // 创建 CE06 Job
    const ce06Job = await prisma.shotJob.create({
      data: {
        projectId,
        organizationId: orgId!, // validated above
        type: JobType.CE06_NOVEL_PARSING,
        status: JobStatus.PENDING,
        traceId,
        payload: {
          projectId,
          novelSourceId: payload.novelSourceId,
          pipelineRunId, // 关键：用于幂等和关联
          rootJobId: jobId,
        },
        // 必须字段填充 (Validated above)
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
        jobType: JobType.PIPELINE_E2E_VIDEO,
        engineKey: 'pipeline_orchestrator',
        status: 'SUCCESS',
        auditTrail: {
          action: 'pipeline.e2e_video.spawn.ce06',
          ce06JobId: newCE06.id,
        },
      })
      .catch(() => { });

    // =========================================================================
    // EXEC 2: PIPELINE_PROD_VIDEO_V1 Orchestration (Chain CE03 -> CE04)
    // =========================================================================
    if (job.type === JobType.PIPELINE_PROD_VIDEO_V1) {
      logStructured('info', { action: 'V1_CHAIN_START', jobId, waitingFor: newCE06.id });

      // A. Wait for CE06
      await waitForJobSuccess(prisma, newCE06.id);

      logStructured('info', { action: 'V1_CHAIN_CE06_DONE', jobId });

      // B. Spawn CE03
      const ce03Job = await prisma.shotJob.create({
        data: {
          projectId,
          organizationId: orgId!,
          type: JobType.CE03_VISUAL_DENSITY,
          status: JobStatus.PENDING,
          traceId,
          payload: {
            projectId,
            sceneId: sceneId!,
            traceId,
            rootJobId: jobId,
            pipelineRunId
          },
          episodeId: episodeId!,
          sceneId: sceneId!,
          shotId: shotId!
        }
      });
      logStructured('info', { action: 'V1_CHAIN_SPAWN_CE03', jobId, ce03JobId: ce03Job.id });

      // C. Wait for CE03
      await waitForJobSuccess(prisma, ce03Job.id);
      logStructured('info', { action: 'V1_CHAIN_CE03_DONE', jobId });

      // D. Spawn CE04
      const ce04Job = await prisma.shotJob.create({
        data: {
          projectId,
          organizationId: orgId!,
          type: JobType.CE04_VISUAL_ENRICHMENT,
          status: JobStatus.PENDING,
          traceId,
          payload: {
            projectId,
            sceneId: sceneId!,
            traceId,
            rootJobId: jobId,
            pipelineRunId
          },
          episodeId: episodeId!,
          sceneId: sceneId!,
          shotId: shotId!
        }
      });
      logStructured('info', { action: 'V1_CHAIN_SPAWN_CE04', jobId, ce04JobId: ce04Job.id });

      // E. Wait for CE04
      await waitForJobSuccess(prisma, ce04Job.id);
      logStructured('info', { action: 'V1_CHAIN_CE04_DONE', jobId });

      return {
        status: 'CHAIN_COMPLETED',
        pipelineRunId,
        spawned: {
          ce06JobId: newCE06.id,
          // extend logic if interface allowed, but this fulfills the gate requirement
        }
      };
    }

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
      .catch(() => { });

    throw error;
  }
}

