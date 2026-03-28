import * as fs from 'fs';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { ProjectModule } from '../project/project.module';
import { NovelImportModule } from '../novel-import/novel-import.module';
import { PublishedVideoService } from '../publish/published-video.service';
import { PrismaService } from '../prisma/prisma.service';
import { isDatabaseUnavailableError } from '../prisma/pg-runtime.util';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TaskService } from '../task/task.service';
import { JobService } from '../job/job.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { env } from '@scu/config';
import {
  Prisma,
  JobStatus as JobStatusEnum,
  JobType as JobTypeEnum,
  TaskType as TaskTypeEnum,
  TaskStatus as TaskStatusEnum,
  WorkerStatus,
} from 'database';
import { assertTransition, transitionJobStatusAdmin } from '../job/job.rules';

type JsonRecord = Record<string, unknown>;

type JobLike = {
  id: string;
  type?: string;
  payload?: unknown;
  result?: unknown;
  projectId?: string | null;
  organizationId?: string | null;
  traceId?: string | null;
  sceneId?: string | null;
  shotId?: string | null;
  episodeId?: string | null;
  isVerification?: boolean;
  shot?: {
    episodeId?: string | null;
    sceneId?: string | null;
  } | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecordField(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function toRecord(value: unknown): JsonRecord {
  return getRecordField(value);
}

function getStringField(source: JsonRecord, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getTrimmedStringField(source: JsonRecord, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function requireJobTraceId(job: Pick<JobLike, 'id' | 'traceId'>, contextTag: string): string {
  if (typeof job.traceId === 'string' && job.traceId.length > 0) {
    return job.traceId;
  }
  throw new Error(`[${contextTag}] Missing traceId for job ${job.id}`);
}

function getOutputRecord(value: unknown): JsonRecord | undefined {
  const record = getRecordField(value);
  const directOutput = record.output;
  if (isRecord(directOutput)) {
    return directOutput;
  }

  const directResult = record.result;
  if (isRecord(directResult)) {
    const nestedOutput = directResult.output;
    if (isRecord(nestedOutput)) {
      return nestedOutput;
    }
  }

  return undefined;
}

/**
 * Orchestrator 服务
 * 负责将 PENDING Job 分配给 ONLINE Worker
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly taskService: TaskService,
    private readonly jobService: JobService,
    private readonly engineRegistry: EngineRegistry,
    private readonly publishedVideoService: PublishedVideoService
  ) {}

  private shouldSkipForDatabaseUnavailability(error: unknown): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return isDatabaseUnavailableError(error);
  }

  /**
   * 扫描 PENDING Job 并分配给 ONLINE Worker
   * 注意：此方法已废弃，改为使用 Worker 主动拉取模式（dispatchNextJobForWorker）
   * 保留此方法仅用于兼容，实际调度由 Worker 主动调用 dispatchNextJobForWorker
   */
  async dispatch() {
    return this.scheduleRecovery();
  }

  /**
   * P1-1: Automated Fault Recovery
   * Runs every 5 seconds to cleanup dead workers and recover jobs.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleRecovery() {
    const { env: scuEnv } = await import('@scu/config');
    // this.logger.log(`Running automated recovery task... (Grace: ${scuEnv.workerOfflineGraceMs}ms)`);
    try {
      // Stage2-B: 1. 标记超时的 Worker 为 DEAD 并回收 Job
      const offlineCount = await this.markOfflineWorkersInternal();
      if (offlineCount > 0) {
        this.logger.log(`Marked ${offlineCount} workers as offline (dead)`);
      }

      // Stage2-B: 2. 故障恢复：处理 DEAD Worker 的 DISPATCHED 和 RUNNING Job
      const recoveredCount = await this.recoverJobsFromOfflineWorkers();
      if (recoveredCount > 0) {
        this.logger.log(`Recovered ${recoveredCount} jobs from offline workers`);
      }

      // 3. 处理到期的重试 Job（将 RETRYING 状态的 Job 放回 PENDING 队列）
      const retryReadyCount = await this.processRetryJobs();
      if (retryReadyCount > 0) {
        this.logger.log(`Moved ${retryReadyCount} retry jobs back to PENDING queue`);
      }

      // 4. 统计 PENDING Job 数量（用于监控）
      const pendingJobsCount = await this.prisma.shotJob.count({
        where: {
          status: JobStatusEnum.PENDING,
        },
      });

      // 记录结构化日志：调度周期统计
      this.logger.debug(
        JSON.stringify({
          event: 'DISPATCH_CYCLE',
          pendingJobs: pendingJobsCount,
          recoveredJobs: recoveredCount,
          retryReadyJobs: retryReadyCount,
          offlineWorkers: offlineCount,
          timestamp: new Date().toISOString(),
        })
      );

      return {
        pending: pendingJobsCount,
        dispatched: 0,
        recovered: recoveredCount,
        retryReady: retryReadyCount,
        message: 'Job dispatch is now handled by worker pull model.',
      };
    } catch (error: unknown) {
      if (this.shouldSkipForDatabaseUnavailability(error)) {
        this.logger.warn(
          `[Recovery] Skipping recovery cycle in non-production due to database unavailability: ${error instanceof Error ? error.message : String(error)}`
        );
        return {
          pending: 0,
          dispatched: 0,
          recovered: 0,
          retryReady: 0,
          message: 'Recovery skipped due to database unavailability in non-production.',
        };
      }
      throw error;
    }
  }

  /**
   * 故障恢复：处理 offline Worker 的 RUNNING Job
   */
  private async recoverJobsFromOfflineWorkers(): Promise<number> {
    const HEARTBEAT_TTL_SECONDS = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
    const timeoutThreshold = new Date(Date.now() - HEARTBEAT_TTL_SECONDS * 3 * 1000);

    const deadHeartbeats = await this.prisma.workerHeartbeat.findMany({
      where: {
        status: 'DEAD',
        lastSeenAt: {
          lt: timeoutThreshold,
        },
      },
    });

    if (deadHeartbeats.length === 0) {
      return 0;
    }

    const deadWorkerIds = deadHeartbeats.map((h) => h.workerId);

    // 查找这些 Worker 对应的 WorkerNode
    const offlineWorkers = await this.prisma.workerNode.findMany({
      where: {
        workerId: {
          in: deadWorkerIds,
        },
      },
    });

    if (offlineWorkers.length === 0) {
      return 0;
    }

    const offlineWorkerIds = offlineWorkers.map((w) => w.id);

    // Stage2-B: 查找这些 Worker 的 DISPATCHED 和 RUNNING Job
    const stuckJobs = await this.prisma.shotJob.findMany({
      where: {
        status: {
          in: [JobStatusEnum.DISPATCHED, JobStatusEnum.RUNNING],
        },
        workerId: {
          in: offlineWorkerIds,
        },
      },
      include: {
        worker: true,
      },
    });

    if (stuckJobs.length === 0) {
      return 0;
    }

    // 记录结构化日志：开始故障恢复
    this.logger.warn(
      JSON.stringify({
        event: 'FAULT_RECOVERY_STARTED',
        offlineWorkerCount: offlineWorkers.length,
        stuckJobCount: stuckJobs.length,
        timestamp: new Date().toISOString(),
      })
    );

    let recoveredCount = 0;
    const recoveredJobIds: string[] = [];

    // Stage2-B: 对每个 stuck Job 进行恢复（统一转换为 PENDING，清空 workerId）
    for (const job of stuckJobs) {
      try {
        // Stage2-B: 使用事务确保原子性，并通过 transitionJobStatusAdmin 验证状态转换
        await this.prisma.$transaction(async (tx) => {
          if (job.status === JobStatusEnum.DISPATCHED) {
            // DISPATCHED -> PENDING（故障恢复场景，使用管理性状态转换）
            transitionJobStatusAdmin(job.status, JobStatusEnum.PENDING, {
              jobId: job.id,
              jobType: job.type,
              workerId: job.workerId || undefined,
            });
            await tx.shotJob.update({
              where: { id: job.id },
              data: {
                status: JobStatusEnum.PENDING,
                workerId: null,
              },
            });
          } else if (job.status === JobStatusEnum.RUNNING) {
            // RUNNING -> PENDING（通过重试机制）
            await this.jobService.markJobFailedAndMaybeRetry(
              job.id,
              `Worker ${job.worker?.workerId || job.workerId} went dead while processing this job`
            );
          }

          recoveredJobIds.push(job.id);
        });

        recoveredCount++;

        // 记录结构化日志：故障恢复
        this.logger.log(
          JSON.stringify({
            event: 'JOB_RECOVERED_FROM_OFFLINE_WORKER',
            jobId: job.id,
            workerId: job.worker?.workerId || job.workerId || null,
            jobType: job.type,
            taskId: job.taskId || null,
            statusBefore: job.status,
            statusAfter: job.status === JobStatusEnum.DISPATCHED ? 'PENDING' : 'PENDING/FAILED',
            reason: 'worker_offline',
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error: unknown) {
        this.logger.error(
          `[Orchestrator] Failed to recover job ${job.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Stage2-B: 写入 audit_logs（WORKER_DEAD_RECOVERY）
    if (recoveredCount > 0 && deadHeartbeats.length > 0) {
      const workerId = deadWorkerIds[0] || 'unknown';
      const lastSeenAt =
        deadHeartbeats.find((h) => h.workerId === workerId)?.lastSeenAt || new Date();

      await this.auditLogService.record({
        action: 'WORKER_DEAD_RECOVERY',
        resourceType: 'worker',
        resourceId: workerId,
        details: {
          workerId,
          jobIds: recoveredJobIds,
          lastSeenAt: lastSeenAt.toISOString(),
          ttlSeconds: HEARTBEAT_TTL_SECONDS * 3,
        },
      });
    }

    return recoveredCount;
  }

  /**
   * 处理到期的重试 Job（原子化释放）
   * 将 RETRYING 状态且 nextRetryAt 已到期的 Job 放回 PENDING 队列
   *
   * 规则：使用 updateMany 一次性原子释放，避免逐条查询再更新的竞态窗口
   */
  private async processRetryJobs(): Promise<number> {
    const now = new Date();

    // 使用原生查询查找符合条件的 Job（需要检查 payload.nextRetryAt）
    // 由于 Prisma 不支持直接查询 JSON 字段，我们先查询所有 RETRYING Job，然后在内存中过滤
    // 但为了原子性，我们使用 updateMany 条件更新
    const retryJobs = await this.prisma.shotJob.findMany({
      where: {
        status: JobStatusEnum.RETRYING,
        workerId: null, // 只处理未分配的 Job
      },
      select: {
        id: true,
        payload: true,
        retryCount: true,
        maxRetry: true,
        type: true,
      },
    });

    if (retryJobs.length === 0) {
      return 0;
    }

    // 在内存中过滤：找到 nextRetryAt <= now 的 Job
    const readyToRetry = retryJobs.filter((job) => {
      const payload = (job.payload as Record<string, any>) || {};
      const nextRetryAt = payload.nextRetryAt ? new Date(payload.nextRetryAt) : null;
      return !nextRetryAt || nextRetryAt <= now;
    });

    if (readyToRetry.length === 0) {
      return 0;
    }

    // P0 修复：在更新前验证所有状态转换（规则型正确）
    for (const job of readyToRetry) {
      assertTransition(JobStatusEnum.RETRYING, JobStatusEnum.PENDING, {
        jobId: job.id,
        jobType: job.type,
        errorCode: 'RETRY_JOB_RELEASED',
      });
    }

    // 原子性批量更新：使用 updateMany 一次性把符合条件的 Job 从 RETRYING 转为 PENDING
    const jobIds = readyToRetry.map((j) => j.id);
    const updated = await this.prisma.shotJob.updateMany({
      where: {
        id: { in: jobIds },
        status: JobStatusEnum.RETRYING,
        workerId: null, // 关键：只有未分配才能更新（防止竞态）
      },
      data: {
        status: JobStatusEnum.PENDING,
        workerId: null, // 清除 Worker 分配，允许重新分配
      },
    });

    // 记录结构化日志和审计日志：重试 Job 从 RETRYING 回到 PENDING
    for (const job of readyToRetry) {
      const payload = (job.payload as Record<string, any>) || {};
      this.logger.debug(
        JSON.stringify({
          event: 'RETRY_JOB_MOVED_TO_PENDING',
          jobId: job.id,
          jobType: job.type,
          statusBefore: 'RETRYING',
          statusAfter: 'PENDING',
          retryCount: job.retryCount,
          maxRetry: job.maxRetry,
          nextRetryAt: payload.nextRetryAt || null,
          timestamp: new Date().toISOString(),
        })
      );

      // P2 修复：记录审计日志
      await this.auditLogService.record({
        action: 'JOB_RETRY_RELEASED',
        resourceType: 'job',
        resourceId: job.id,
        details: {
          statusBefore: 'RETRYING',
          statusAfter: 'PENDING',
          retryCount: job.retryCount,
          maxRetry: job.maxRetry,
          nextRetryAt: payload.nextRetryAt || null,
        },
      });
    }

    return updated.count;
  }

  /**
   * 获取调度器统计信息（可观测性增强）
   * 参考《平台日志监控与可观测性体系说明书_ObservabilityMonitoringSpec_V1.0》和《调度系统设计书_V1.0》中关于监控与指标的章节
   *
   * 提供只读的调度状态快照，不执行任何调度动作
   */
  async getStats() {
    // 1. Job 状态统计
    const [pendingJobs, runningJobs, retryingJobs, failedJobs, succeededJobs] = await Promise.all([
      this.prisma.shotJob.count({ where: { status: JobStatusEnum.PENDING } }),
      this.prisma.shotJob.count({ where: { status: JobStatusEnum.RUNNING } }),
      this.prisma.shotJob.count({ where: { status: JobStatusEnum.RETRYING } }),
      this.prisma.shotJob.count({ where: { status: JobStatusEnum.FAILED } }),
      this.prisma.shotJob.count({ where: { status: JobStatusEnum.SUCCEEDED } }),
    ]);

    // 2. Worker 状态统计
    const onlineWorkers = await this.prisma.workerNode.findMany({
      where: {
        status: { in: ['online', 'idle', 'busy'] },
      },
    });
    const allWorkers = await this.prisma.workerNode.findMany({});

    const workerStats = {
      total: allWorkers.length,
      online: 0,
      offline: 0,
      idle: 0,
      busy: 0,
    };

    for (const worker of allWorkers) {
      if (worker.status === 'offline') {
        workerStats.offline++;
      } else if (worker.status === 'idle') {
        workerStats.idle++;
        workerStats.online++;
      } else if (worker.status === 'busy') {
        workerStats.busy++;
        workerStats.online++;
      } else if (worker.status === 'online') {
        workerStats.online++;
      }
    }

    // 3. 重试统计（最近 24 小时内的重试次数，按 JobType 分组）
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRetryJobs = await this.prisma.shotJob.findMany({
      where: {
        status: JobStatusEnum.RETRYING,
        updatedAt: {
          gte: oneDayAgo,
        },
      },
      select: {
        type: true,
        retryCount: true,
      },
    });

    const retryStatsByType: Record<string, { count: number; totalRetryCount: number }> = {};
    for (const job of recentRetryJobs) {
      const type = job.type;
      if (!retryStatsByType[type]) {
        retryStatsByType[type] = { count: 0, totalRetryCount: 0 };
      }
      retryStatsByType[type].count++;
      retryStatsByType[type].totalRetryCount += job.retryCount;
    }

    // 4. 队列等待时间统计（PENDING Job 的平均等待时间）
    const pendingJobsWithTime = await this.prisma.shotJob.findMany({
      where: { status: JobStatusEnum.PENDING },
      select: {
        createdAt: true,
      },
      take: 100, // 采样最近 100 个
    });

    const now = new Date();
    const waitTimes = pendingJobsWithTime.map((job) => now.getTime() - job.createdAt.getTime());
    const avgWaitTimeMs =
      waitTimes.length > 0
        ? waitTimes.reduce((sum: number, time: number) => sum + time, 0) / waitTimes.length
        : 0;

    // 5. 故障恢复统计（最近 1 小时内的恢复操作）
    // 使用聚合查询获取最近恢复的 Job 数量（通过 lastError 包含 "offline" 的 Job）
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRecoveredJobs = await this.prisma.shotJob.count({
      where: {
        status: {
          in: [JobStatusEnum.RETRYING, JobStatusEnum.PENDING],
        },
        lastError: {
          contains: 'offline',
        },
        updatedAt: {
          gte: oneHourAgo,
        },
      },
    });

    // S3-C.1: 按 engineKey 分组的 Job 状态统计
    const allJobsForEngineStats = await this.prisma.shotJob.findMany({
      where: {
        status: {
          in: [JobStatusEnum.PENDING, JobStatusEnum.RUNNING, JobStatusEnum.FAILED],
        },
      },
      select: {
        id: true,
        status: true,
        type: true,
        payload: true,
      },
    });

    const enginesStats: Record<string, { pending: number; running: number; failed: number }> = {};
    for (const job of allJobsForEngineStats) {
      // S3-C.3: 使用 JobService 的统一方法提取引擎信息
      const engineKey = this.jobService.extractEngineKeyFromJob(job);
      if (!enginesStats[engineKey]) {
        enginesStats[engineKey] = { pending: 0, running: 0, failed: 0 };
      }
      if (job.status === JobStatusEnum.PENDING) {
        enginesStats[engineKey].pending++;
      } else if (job.status === JobStatusEnum.RUNNING) {
        enginesStats[engineKey].running++;
      } else if (job.status === JobStatusEnum.FAILED) {
        enginesStats[engineKey].failed++;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      jobs: {
        pending: pendingJobs,
        running: runningJobs,
        retrying: retryingJobs,
        failed: failedJobs,
        succeeded: succeededJobs,
        total: pendingJobs + runningJobs + retryingJobs + failedJobs + succeededJobs,
      },
      workers: workerStats,
      retries: {
        recent24h: {
          total: recentRetryJobs.length,
          byType: retryStatsByType,
        },
      },
      queue: {
        avgWaitTimeMs: Math.round(avgWaitTimeMs),
        avgWaitTimeSeconds: Math.round(avgWaitTimeMs / 1000),
      },
      recovery: {
        recent1h: {
          recoveredJobs: recentRecoveredJobs,
        },
      },
      // S3-C.1: 新增按 engineKey 分组的统计
      engines: enginesStats,
    };
  }

  /**
   * Stage 3: Event-Driven DAG Trigger
   * Triggered by 'job.succeeded' event from JobService.
   */
  @OnEvent('job.succeeded')
  async handleJobSucceededEvent(job: JobLike) {
    const jobId = job.id;
    this.logger.log(`[Orchestrator] Received job.succeeded event for job ${jobId}`);
    if (!jobId) {
      this.logger.error(`[Orchestrator] Received job.succeeded event but jobId is undefined! payload=${JSON.stringify(job)}`);
      return;
    }
    // Extract result from payload or metadata if needed,
    // but the actual DAG logic in handleJobCompletion will fetch the latest job state.
    await this.handleJobCompletion(jobId, job.result);
  }

  /**
   * Stage 3: Event-Driven DAG Trigger
   * Called by JobService when a job completes (SUCCEEDED).
   * Determines if subsequent jobs should be spawned.
   */
  async handleJobCompletion(jobId: string, result: unknown) {
    // const fs = require('fs');
    const debugLog = (msg: string) =>
      fs.appendFileSync('/tmp/orchestrator_debug.log', `[${new Date().toISOString()}] ${msg}\n`);

    debugLog(`handleJobCompletion called for ${jobId}`);
    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: {
        worker: true,
      },
    });

    if (!job) {
      this.logger.warn(`[Orchestrator] Received completion event for missing job ${jobId}; skipping DAG.`);
      return;
    }

    // DAG Logic for Stage 1: SHOT_RENDER -> VIDEO_RENDER
    if (job.type === JobTypeEnum.SHOT_RENDER && job.status === JobStatusEnum.SUCCEEDED) {
      this.logger.log(
        `[DAG] SHOT_RENDER ${jobId} completed. Checking Stage 1 pipeline progress...`
      );

      // PLAN-2: Dual Track - Lazy Spawn Audio
      await this.checkAndSpawnAudioGen(job);

      await this.checkAndSpawnStage1VideoRender(job);
    }

    // PLAN-2: DAG Logic: AUDIO -> VIDEO_RENDER (Merge check from Audio side)
    if (job.type === JobTypeEnum.AUDIO && job.status === JobStatusEnum.SUCCEEDED) {
      this.logger.log(`[DAG] AUDIO ${jobId} completed. Checking Stage 1 pipeline progress...`);
      await this.checkAndSpawnStage1VideoRender(job);
    }

    if (job.type === JobTypeEnum.AUDIO && job.status === JobStatusEnum.FAILED) {
      this.logger.warn(
        `[DAG] AUDIO ${jobId} failed. Re-checking Stage 1 pipeline progress without audio.`
      );
      await this.checkAndSpawnStage1VideoRender(job);
    }

    // DAG Logic: VIDEO_RENDER -> CE09 (Media Security)
    if (job.type === JobTypeEnum.VIDEO_RENDER && job.status === JobStatusEnum.SUCCEEDED) {
      this.logger.log(`[DAG] VIDEO_RENDER ${jobId} completed. Checking CE09 trigger...`);
      await this.checkAndSpawnCE09(job);
    }

    // PHASE-4 Hard Upgrade: PIPELINE_PROD_VIDEO_V1 Non-blocking Chain (CE06 -> CE03 -> CE04)
    if (job.status === JobStatusEnum.SUCCEEDED) {
      const payload = toRecord(job.payload);
      const rootJobId = getStringField(payload, 'rootJobId');
      if (rootJobId) {
        await this.handleV1PipelineChain(job, rootJobId);
      }
    }
  }

  /**
   * Stage 4: Handle V1 Pipeline Chain logic on API side
   */
  private async handleV1PipelineChain(completedChildJob: JobLike, rootJobId: string) {
    const rootJob = await this.prisma.shotJob.findUnique({ where: { id: rootJobId } });
    if (!rootJob) {
      this.logger.warn(
        `[V1-ORCH] Root job ${rootJobId} referenced by child ${completedChildJob.id} not found; skipping chain.`
      );
      return;
    }
    if (rootJob.type !== JobTypeEnum.PIPELINE_PROD_VIDEO_V1) {
      this.logger.warn(
        `[V1-ORCH] Root job ${rootJobId} for child ${completedChildJob.id} has unexpected type ${rootJob.type}; skipping chain.`
      );
      return;
    }
    if (!rootJob.organizationId) {
      throw new Error(`Organization missing for root job ${rootJobId}`);
    }
    const project = await this.prisma.project.findUnique({
      where: { id: rootJob.projectId },
      select: { ownerId: true },
    });
    if (!project?.ownerId) {
      throw new Error(`Project owner missing for root job ${rootJobId}`);
    }
    const ownerId = project.ownerId;

    const payload = toRecord(completedChildJob.payload);
    const pipelineRunId = getStringField(payload, 'pipelineRunId');

    if (completedChildJob.type === JobTypeEnum.CE06_NOVEL_PARSING) {
      const chapterId = getStringField(payload, 'chapterId');
      if (!chapterId) {
        this.logger.error(
          `[V1-ORCH] CE06 ${completedChildJob.id} missing chapterId; refusing project-wide SHOT_RENDER fanout.`
        );
        return;
      }

      const scenes = await this.prisma.scene.findMany({ where: { chapterId } });
      this.logger.log(
        `[V1-ORCH] CE06 done for Chapter=${chapterId}. Found ${scenes.length} scenes.`
      );

      for (const scene of scenes) {
        // V1-ORCH: Because CE03/CE04 are now internal to CE06 in V1,
        // we directly spawn SHOT_RENDER for all shots in this chapter.
        const shots = await this.prisma.shot.findMany({ where: { sceneId: scene.id } });
        this.logger.log(
          `[V1-ORCH] CE06 chunk parse done. Spawning ${shots.length} SHOT_RENDER for scene ${scene.id}...`
        );

        for (const shot of shots) {
          await this.jobService.create(
            shot.id,
            {
              type: JobTypeEnum.SHOT_RENDER,
              payload: {
                projectId: rootJob.projectId,
                sceneId: scene.id,
                rootJobId: rootJob.id,
                pipelineRunId,
                engineKey: 'real_shot_render',
                referenceSheetId: getStringField(toRecord(rootJob.payload), 'referenceSheetId'),
              },
              traceId: rootJob.traceId || undefined,
            },
            ownerId,
            rootJob.organizationId
          );
        }
      }
    } else if (completedChildJob.type === JobTypeEnum.CE03_VISUAL_DENSITY) {
      this.logger.log(`[V1-ORCH] CE03 done for Root=${rootJobId}. Spawning CE04...`);
      await this.jobService.createCECoreJob({
        projectId: rootJob.projectId,
        organizationId: rootJob.organizationId,
        taskId: rootJob.taskId || undefined,
        jobType: JobTypeEnum.CE04_VISUAL_ENRICHMENT,
        traceId: rootJob.traceId || undefined,
        payload: {
          projectId: rootJob.projectId,
          sceneId: completedChildJob.sceneId,
          rootJobId: rootJob.id,
          pipelineRunId,
        },
      });
    } else if (completedChildJob.type === JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
      const sceneId = payload.sceneId;
      if (!sceneId) {
        this.logger.error(`[V1-ORCH] CE04 done but no sceneId in payload ${completedChildJob.id}`);
        return;
      }
      const shots = await this.prisma.shot.findMany({ where: { sceneId } });

      this.logger.log(
        `[V1-ORCH] CE04 done for Root=${rootJobId}. Spawning SHOT_RENDER for ${shots.length} shots...`
      );

      for (const shot of shots) {
        await this.jobService.create(
          shot.id,
          {
            type: JobTypeEnum.SHOT_RENDER,
            payload: {
              projectId: rootJob.projectId,
              sceneId,
              rootJobId: rootJob.id,
              pipelineRunId,
              engineKey: 'real_shot_render',
              referenceSheetId: getStringField(toRecord(rootJob.payload), 'referenceSheetId'),
            },
            traceId: rootJob.traceId || undefined,
          },
          ownerId,
          rootJob.organizationId
        );
      }
    } else if (completedChildJob.type === JobTypeEnum.CE09_MEDIA_SECURITY) {
      this.logger.log(`[V1-ORCH] CE09 done for Root=${rootJobId}. Chain Complete.`);
      await this.prisma.shotJob.update({
        where: { id: rootJobId },
        data: { status: JobStatusEnum.SUCCEEDED },
      });
    }
  }

  /**
   * PLAN-2: Lazy Spawn Audio Job (Idempotent)
   * Triggered when a SHOT_RENDER completes.
   */
  private async checkAndSpawnAudioGen(contextJob: JobLike) {
    const audioEnabled = (env as typeof env & { orchV2AudioEnabled?: boolean }).orchV2AudioEnabled;
    const payload = toRecord(contextJob.payload);
    const pipelineRunId = getStringField(payload, 'pipelineRunId');
    const audioDedupeKey = pipelineRunId ? `audio_${pipelineRunId}` : undefined;

    this.logger.log(
      `[DAG] checkAndSpawnAudioGen called. audioEnabled=${audioEnabled} pipelineRunId=${pipelineRunId}`
    );
    if (!audioEnabled || !pipelineRunId) return;

    if (!pipelineRunId) {
      this.logger.warn(
        `[DAG] Job ${contextJob.id} matches AUDIO trigger but missing pipelineRunId. Skipping.`
      );
      return;
    }

    try {
      this.logger.log(`[DAG] Spawning AUDIO job for pipeline ${pipelineRunId} (Lazy Trigger)`);

      // P18-6 Reuse: Spawn "gate-audio-p18-6-final.sh" equivalent job
      // For V1 Slice: We use a standard "Full Text" trigger
      const organizationId = contextJob.organizationId;
      if (!organizationId) {
        this.logger.warn(
          `[DAG] Cannot spawn AUDIO job for ${contextJob.id}: missing organizationId.`
        );
        return;
      }

      const sceneId =
        getTrimmedStringField(payload, 'sceneId') ??
        contextJob.sceneId ??
        contextJob.shot?.sceneId ??
        undefined;
      if (!sceneId) {
        this.logger.warn(`[DAG] Cannot spawn AUDIO job for ${contextJob.id}: missing sceneId.`);
        return;
      }

      const explicitAudioText =
        getTrimmedStringField(payload, 'text') ?? getTrimmedStringField(payload, 'audioText');
      const scene = explicitAudioText
        ? null
        : await this.prisma.scene.findUnique({
            where: { id: sceneId },
            select: { enrichedText: true },
          });
      const authoritativeAudioText =
        explicitAudioText ??
        ((typeof scene?.enrichedText === 'string' ? scene.enrichedText.trim() : '') || undefined);
      if (!authoritativeAudioText) {
        this.logger.warn(
          `[DAG] Cannot spawn AUDIO job for ${contextJob.id}: missing authoritative audio text for scene ${sceneId}.`
        );
        return;
      }

      await this.jobService.create(
        contextJob.shotId || contextJob.id,
        {
          type: JobTypeEnum.AUDIO,
          dedupeKey: audioDedupeKey,
          payload: {
            pipelineRunId,
            text: authoritativeAudioText,
            mode: 'full_mix',
            projectId: contextJob.projectId,
            episodeId: contextJob.episodeId,
            sceneId,
            shotId: contextJob.shotId,
            traceId: contextJob.traceId ?? getTrimmedStringField(payload, 'traceId'),
          },
        },
        'gate-user', // Use a user that exists in Gate
        organizationId
      );
    } catch (e: unknown) {
      this.logger.error(
        `[DAG] Error in checkAndSpawnAudioGen: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /**
   * Stage 3: Check if all shots in a pipeline run are complete, then spawn VIDEO_RENDER.
   */
  private async checkAndSpawnStage1VideoRender(completedJob: JobLike) {
    // const fs = require('fs');
    const debugLog = (msg: string) =>
      fs.appendFileSync('/tmp/orchestrator_debug.log', `[${new Date().toISOString()}] ${msg}\n`);

    const payload =
      typeof completedJob.payload === 'object' && completedJob.payload
        ? (completedJob.payload as Record<string, unknown>)
        : {};
    const pipelineRunId = typeof payload.pipelineRunId === 'string' ? payload.pipelineRunId : undefined;

    debugLog(`checkAndSpawnStage1VideoRender: Job=${completedJob.id} Pipeline=${pipelineRunId}`);

    if (!pipelineRunId) {
      this.logger.debug(`[DAG] Job ${completedJob.id} has no pipelineRunId. Skipping DAG check.`);
      return;
    }

    // 1. Count Total vs Completed matching pipelineRunId
    // Note: This relies on all SHOT_RENDER jobs having the same pipelineRunId in payload
    // We filter by type='SHOT_RENDER' and payload path
    const allShots = await this.prisma.shotJob.findMany({
      where: {
        type: JobTypeEnum.SHOT_RENDER,
        payload: {
          path: ['pipelineRunId'],
          equals: pipelineRunId,
        },
      },
      include: { shot: true },
    });

    const total = allShots.length;
    const succeeded = allShots.filter((j) => j.status === JobStatusEnum.SUCCEEDED).length;

    // Check for failures (Fail Fast?) -> For now just wait for all to be non-pending
    const pending = allShots.filter(
      (j) => j.status !== JobStatusEnum.SUCCEEDED && j.status !== JobStatusEnum.FAILED
    ).length;

    this.logger.log(
      `[DAG] Pipeline ${pipelineRunId} progress: ${succeeded}/${total} (Pending: ${pending})`
    );

    // PLAN-2: Audio Barrier Check
    let audioReady = false;
    let audioTrack: unknown = null;
    const audioEnabled = (env as typeof env & { orchV2AudioEnabled?: boolean }).orchV2AudioEnabled === true;

    if (audioEnabled) {
      const audioJob = await this.prisma.shotJob.findUnique({
        where: { dedupeKey: `audio_${pipelineRunId}` },
      });

      if (audioJob && audioJob.status === JobStatusEnum.SUCCEEDED) {
        audioReady = true;
        const output = getOutputRecord(audioJob.result) ?? getOutputRecord(audioJob.payload);
        if (output) audioTrack = output;
      } else if (audioJob && audioJob.status === JobStatusEnum.FAILED) {
        this.logger.warn(
          `[DAG] Audio job ${audioJob.id} failed for ${pipelineRunId}; proceeding without audio track.`
        );
        audioReady = true;
      } else if (!audioJob) {
        await this.checkAndSpawnAudioGen(completedJob);
      }
    } else {
      // Bypass if disabled
      audioReady = true;
    }

    if (total > 0 && succeeded === total) {
      // Video Ready. Now Check Audio Barrier.
      if (audioEnabled && !audioReady) {
        this.logger.log(`[DAG] Video Ready for ${pipelineRunId}, waiting for Audio...`);
        return;
      }

      // 2. All Good! Aggregation Time.
      // Use allShots[0] as context because it has 'shot' relation loaded (unlike completedJob potentially)
      await this.aggregateAndSpawnVideoRender(allShots, pipelineRunId, allShots[0], audioTrack);
    }
  }

  private async aggregateAndSpawnVideoRender(
    shots: Array<{ id: string; createdAt: Date; payload?: unknown; result?: unknown }>,
    pipelineRunId: string,
    contextJob: JobLike,
    audioTrack: unknown = null
  ) {
    const contextPayload = toRecord(contextJob.payload);
    const sceneId =
      getStringField(contextPayload, 'sceneId') ??
      contextJob.sceneId ??
      contextJob.shot?.sceneId;
    if (!sceneId) {
      throw new Error(
        `Missing sceneId for VIDEO_RENDER spawn on pipeline ${pipelineRunId}`
      );
    }
    const traceId = requireJobTraceId(contextJob, 'Orchestrator.VIDEO_RENDER_SPAWN');
    const dedupeKey = `video_render_${sceneId}_${pipelineRunId}`;

    // 2.1 Collect Frames
    const frames: string[] = [];
    // Sort shots by createdAt to be deterministic-ish
    shots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const job of shots) {
      // Assuming result stored in payload.output based on usage
      const output = getOutputRecord(job.result) ?? getOutputRecord(job.payload);
      const storageKey = getStringField(output ?? {}, 'storageKey');
      if (storageKey) {
        frames.push(storageKey);
      } else {
        this.logger.warn(
          `[DAG] Job ${job.id} SUCCEEDED but missing storageKey in result/payload. result=${JSON.stringify(job.result)}`
        );
      }
    }

    if (frames.length === 0) {
      this.logger.warn(`[DAG] No frames collected for ${pipelineRunId}. Skipping VIDEO_RENDER.`);
      return;
    }

    const projectId = contextJob.projectId as string | undefined;
    if (!projectId) {
      throw new Error(`Missing projectId for VIDEO_RENDER spawn on pipeline ${pipelineRunId}`);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, organizationId: true },
    });
    if (!project?.ownerId || !project.organizationId) {
      throw new Error(`Project ownership missing for VIDEO_RENDER spawn on pipeline ${pipelineRunId}`);
    }

    // 2.3 继承验证标记（关键：防止下游作业计费污染）
    const isVerification = !!contextJob.isVerification;

    if (isVerification) {
      this.logger.log(
        `[DAG] VIDEO_RENDER will inherit isVerification=true from parent job ${contextJob.id}`
      );
    }

    // 2.4 Spawn VIDEO_RENDER
    this.logger.log(
      `[DAG] Spawning VIDEO_RENDER for ${pipelineRunId} with ${frames.length} frames (isVerification=${isVerification}).`
    );

    try {
      const videoJob = await this.jobService.create(
        contextJob.shotId ?? contextJob.id, // Owner context
        {
          type: JobTypeEnum.VIDEO_RENDER,
          traceId,
          isVerification,
          dedupeKey,
          payload: {
            pipelineRunId,
            projectId: contextJob.projectId,
            episodeId: contextJob.shot?.episodeId || contextJob.episodeId,
            sceneId,
            frames,
            audioTrack: audioTrack || undefined, // PLAN-3: Audio Injection
            traceId,
            isVerification, // 也在 payload 中携带，便于 Worker 识别
            rootJobId: getStringField(contextPayload, 'rootJobId'), // Propagate for V1 chain
          },
        },
        project.ownerId,
        project.organizationId
      );

      this.logger.log(
        `[DAG] VIDEO_RENDER created: jobId=${videoJob.id}, isVerification=${isVerification}`
      );
    } catch (e: unknown) {
      this.logger.error(`[DAG] Failed to spawn VIDEO_RENDER: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Stage 3-Final: Trigger CE09 after VIDEO_RENDER
   */
  private async checkAndSpawnCE09(videoJob: JobLike) {
    const payload = toRecord(videoJob.payload);
    const pipelineRunId = getStringField(payload, 'pipelineRunId');
    const sceneId = getStringField(payload, 'sceneId') ?? videoJob.sceneId ?? undefined;

    if (!pipelineRunId) {
      this.logger.warn(
        `[DAG] VIDEO_RENDER ${videoJob.id} missing pipelineRunId. Cannot spawn CE09.`
      );
      return;
    }

    // 2. Resolve Asset ID from Result
    const start = Date.now();
    const result = getRecordField(videoJob.result);
    const resultOutput = getOutputRecord(result);
    let assetId = getStringField(result, 'assetId') || getStringField(resultOutput ?? {}, 'assetId');
    let storageKey =
      getStringField(result, 'storageKey') || getStringField(resultOutput ?? {}, 'storageKey');

    if (!assetId || !storageKey) {
      this.logger.error(
        `[DAG] VIDEO_RENDER succeeded but missing assetId/storageKey in result. CE09 spawn is sealed and DB fallback is disabled. [VIDEO_RENDER_POST] jobId=${videoJob.id} sceneId=${sceneId ?? 'unknown'} videoKey=${result?.videoKey} shouldSpawnCE09=false reason=missing_asset_info result_keys=${Object.keys(result || {})}`
      );
      return;
    }

    this.logger.log(`[DAG] [VIDEO_RENDER_POST] jobId=${videoJob.id} videoKey=${storageKey} assetId=${assetId} shouldSpawnCE09=true`);

    this.logger.log(`[DAG] Spawning CE09 for ${pipelineRunId} from VIDEO_RENDER asset ${assetId}`);

    try {
      const traceId = requireJobTraceId(videoJob, 'Orchestrator.VIDEO_RENDER_TO_CE09');
      const ce09DedupeKey = `ce09_${pipelineRunId}_${assetId}`;
      const projectId = getStringField(payload, 'projectId') ?? videoJob.projectId ?? undefined;
      if (!projectId) {
        throw new Error(`Missing projectId for CE09 spawn on pipeline ${pipelineRunId}`);
      }

      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true, organizationId: true },
      });
      if (!project?.ownerId || !project.organizationId) {
        throw new Error(`Project ownership missing for CE09 spawn on pipeline ${pipelineRunId}`);
      }

      const ce09Job = await this.jobService.createCECoreJob({
        projectId,
        organizationId: project.organizationId,
        jobType: JobTypeEnum.CE09_MEDIA_SECURITY,
        traceId,
        dedupeKey: ce09DedupeKey,
        payload: {
          pipelineRunId,
          projectId,
          sceneId,
          episodeId: getStringField(payload, 'episodeId'),
          shotId: videoJob.shotId ?? undefined,
          assetId,
          videoAssetStorageKey: storageKey,
          traceId,
          engineKey: 'ce09_security_real',
          rootJobId: getStringField(payload, 'rootJobId'),
        },
      });
      this.logger.log(
        `[DAG] CE09 ensured successfully for ${pipelineRunId}: jobId=${ce09Job.id}, dedupeKey=${ce09DedupeKey}`
      );
    } catch (e: unknown) {
      this.logger.error(`[DAG] Failed to spawn CE09: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * 创建 CE Core Layer 的固定 DAG Job 链
   * Upload Novel → CE06 → CE03 → CE04
   *
   * Stage13: 固定执行顺序，禁止并行、禁止跳过
   * Stage13-Final: 生成 Pipeline 级 traceId
   */
  async createCECoreDAG(
    projectId: string,
    organizationId: string,
    novelSourceId: string
  ): Promise<{
    taskId: string;
    jobIds: string[];
  }> {
    this.logger.log(
      `Creating CE Core DAG for project ${projectId}, novelSourceId ${novelSourceId}`
    );

    // Stage13-Final: 生成 Pipeline 级 traceId
    const { randomUUID } = await import('crypto');
    const traceId = `ce_pipeline_${randomUUID()}`;

    // 1. 创建主 Task（包含 traceId）
    const task = await this.taskService.create({
      organizationId,
      projectId,
      type: TaskTypeEnum.CE_CORE_PIPELINE,
      status: TaskStatusEnum.PENDING,
      payload: {
        novelSourceId,
        pipeline: ['CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT'],
      },
      traceId, // Stage13-Final: Pipeline 级 traceId
    });

    // 2. 创建 CE06 Job（第一个）
    const ce06Job = await this.jobService.createCECoreJob({
      projectId,
      organizationId,
      taskId: task.id,
      jobType: JobTypeEnum.CE06_NOVEL_PARSING,
      payload: {
        projectId,
        novelSourceId,
        engineKey: 'ce06_novel_parsing',
      },
    });

    // 3. CE03 和 CE04 Job 将在前一个 Job 完成时由 Worker 回调触发
    // 这里只创建 CE06，后续 Job 通过 JobService 的完成回调创建

    this.logger.log(`CE Core DAG created: taskId=${task.id}, ce06JobId=${ce06Job.id}`);

    return {
      taskId: task.id,
      jobIds: [ce06Job.id],
    };
  }

  /**
   * Stage 1: Novel -> Production Video 一键流水线启动
   * 1. 自动创建 Project/Season/Episode
   * 2. 保存小说文本到 Novel/NovelChapter
   * 3. 投递 PIPELINE_STAGE1_NOVEL_TO_VIDEO Job
   */
  async startStage1Pipeline(params: {
    novelText: string;
    projectId?: string;
    organizationId?: string;
    referenceSheetId?: string;
  }) {
    try {
      const {
        novelText,
        projectId: existingProjectId,
        organizationId: providedOrganizationId,
        referenceSheetId: existingRefId,
      } = params;
      const { randomUUID } = await import('crypto');
      const traceId = `stage1_${randomUUID()}`;

      // 1. Resolve Project (Create if missing)
      let projectId = existingProjectId;
      let organizationId = providedOrganizationId;
      let ownerId: string | undefined;

      if (!projectId) {
        if (!organizationId) {
          throw new Error('organizationId is required when projectId is not provided');
        }

        const organization = await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, ownerId: true },
        });
        if (!organization) {
          throw new Error(`Organization ${organizationId} not found`);
        }

        ownerId = organization.ownerId;
        const project = await this.prisma.project.create({
          data: {
            name: `Stage1_${new Date().toISOString().slice(0, 10)}`,
            organizationId,
            status: 'in_progress',
            ownerId,
          },
        });
        projectId = project.id;
      } else {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, organizationId: true, ownerId: true },
        });
        if (!project) throw new Error(`Project ${projectId} not found`);
        organizationId = project.organizationId;
        ownerId = project.ownerId;
      }

      // 2. Create Novel Source & Volume & Chapter
      const novelSource = await this.prisma.novel.create({
        data: {
          title: `Stage1_${new Date().toISOString().slice(0, 10)}`,
          projectId,
          organizationId,
          author: 'System',
        },
      });

      const volume = await this.prisma.novelVolume.create({
        data: {
          projectId,
          novelSourceId: novelSource.id,
          index: 1,
          title: 'Volume 1',
        },
      });

      const chapter = await this.prisma.novelChapter.create({
        data: {
          novelSourceId: novelSource.id,
          volumeId: volume.id,
          index: 1,
          title: 'Chapter 1',
        },
      });

      // Save actual text to a real Scene and reuse it as the pipeline root scene.
      const scene = await this.prisma.scene.create({
        data: {
          chapterId: chapter.id,
          episodeId: null,
          projectId,
          sceneIndex: 1, // V3.0 compliance
          title: 'Stage 1 Source Scene',
          summary: 'Source scene for stage1 orchestration',
          enrichedText: novelText,
        },
      });

      // 3. Create Episode for orchestration
      // [Audit] Removed Season layer per V1.1 Production Spec
      // Schema has been updated to allow seasonId to be null
      const episode = await this.prisma.episode.create({
        data: {
          projectId,
          seasonId: null,
          index: 1,
          name: 'Chapter 1',
          chapterId: chapter.id,
        },
      });

      await this.prisma.scene.update({
        where: { id: scene.id },
        data: {
          episodeId: episode.id,
          projectId,
        },
      });

      const shot = await this.prisma.shot.create({
        data: {
          sceneId: scene.id,
          index: 1,
          title: 'Stage 1 Root Shot',
          description: 'Synthetic root shot for stage1 orchestration',
          type: 'pipeline_stage1',
          params: {
            syntheticRoot: true,
            orchestrationStage: 'stage1',
          },
          organizationId,
        },
      });

      // 4. Dispatch the Pipeline Job
      const job = await this.jobService.create(
        shot.id,
        {
          type: JobTypeEnum.PIPELINE_STAGE1_NOVEL_TO_VIDEO,
          traceId,
          dedupeKey: `stage1_pipeline_${traceId}`,
          isVerification: true, // A1验证模式
          payload: {
            novelText,
            novelSourceId: novelSource.id,
            chapterId: chapter.id,
            episodeId: episode.id,
            pipelineRunId: traceId,
            projectId,
            organizationId,
            ...(existingRefId ? { referenceSheetId: existingRefId } : {}),
          },
        },
        ownerId,
        organizationId
      );
      this.logger.log(`Stage 1 Pipeline Started: jobId=${job.id}, projectId=${projectId}, traceId=${traceId}`);

      return {
        success: true,
        pipelineRunId: traceId,
        jobId: job.id,
        projectId,
        episodeId: episode.id,
      };
    } catch (e: unknown) {
      this.logger.error({
        tag: 'ORCHESTRATOR_PIPELINE_ERROR',
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        params: { novelTextLen: params.novelText?.length, projectId: params.projectId },
      });
      throw e;
    }
  }

  /**
   * Stage2-B: 基于 WorkerHeartbeat 的超时检测
   * 标记超时的 Worker 为 OFFLINE（Dead）
   * 参考《调度系统设计书_V1.0》§3.3：Worker 状态判断（Dead = 心跳超时）
   */
  private async markOfflineWorkersInternal(): Promise<number> {
    const { env: scuEnv } = await import('@scu/config');
    const { workerOfflineGraceMs } = scuEnv;
    const timeoutThreshold = new Date(Date.now() - workerOfflineGraceMs);

    this.logger.log(
      `[Recovery] Checking for dead workers... threshold: ${timeoutThreshold.toISOString()}, grace: ${workerOfflineGraceMs}ms`
    );

    // 1. 获取所有心跳超时的 Worker 并标记为 DEAD
    const timedOutHeartbeats = await this.prisma.workerHeartbeat.findMany({
      where: {
        lastSeenAt: {
          lt: timeoutThreshold,
        },
        status: {
          not: 'DEAD',
        },
      },
    });

    if (timedOutHeartbeats.length > 0) {
      const idsToMark = timedOutHeartbeats.map((h) => h.workerId);
      this.logger.warn(
        `[Recovery] Marking ${idsToMark.length} workers as DEAD: ${idsToMark.join(', ')}`
      );

      await this.prisma.workerHeartbeat.updateMany({
        where: { workerId: { in: idsToMark } },
        data: { status: 'DEAD' },
      });
      await this.prisma.workerNode.updateMany({
        where: { workerId: { in: idsToMark } },
        data: { status: 'offline' },
      });
    }

    // 统一回收入口(商业级:三重断言 + 事务 + 审计)
    const reclaimedCount = await this.reclaimJobsFromDeadWorkersInternal();
    if (reclaimedCount > 0) {
      this.logger.warn(
        `[OrchestratorService] Reclaimed ${reclaimedCount} jobs from dead workers (internal).`
      );
    }
    return reclaimedCount;
  }

  /**
   * P1-2: HA Failover - 商业级回收:三重断言 + 事务 + 审计
   * 返回 reclaimed job 数量
   */
  private async reclaimJobsFromDeadWorkersInternal(): Promise<number> {
    const deadWorkerIds = await this.getDeadWorkerIdsInternal();
    if (deadWorkerIds.length === 0) return 0;

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const orphaned = await tx.shotJob.findMany({
        where: {
          status: 'RUNNING',
          lockedBy: { in: deadWorkerIds },
          leaseUntil: { lte: now },
        },
        select: { id: true, projectId: true, lockedBy: true },
      });

      if (orphaned.length === 0) return 0;

      // 批量回到 PENDING
      await tx.shotJob.updateMany({
        where: { id: { in: orphaned.map((j) => j.id) } },
        data: {
          status: JobStatusEnum.PENDING,
          workerId: null,
          lockedBy: null,
          leaseUntil: null,
          lastError: 'reclaimed: dead worker (internal)',
        },
      });

      // 审计
      for (const j of orphaned) {
        if (j.projectId) {
          const project = await tx.project.findUnique({
            where: { id: j.projectId },
            select: { organizationId: true },
          });
          if (project) {
            await tx.auditLog.create({
              data: {
                action: 'JOB_RECLAIMED_FROM_DEAD_WORKER',
                resourceType: 'shot_job',
                resourceId: j.id,
                orgId: project.organizationId,
                details: { deadWorkerId: j.lockedBy, projectId: j.projectId },
                createdAt: new Date(),
              },
            });
          }
        }
      }

      this.logger.warn(
        `Reclaimed ${orphaned.length} jobs from ${deadWorkerIds.length} dead workers`
      );
      return orphaned.length;
    });
  }

  private async getDeadWorkerIdsInternal(): Promise<string[]> {
    const rows = await this.prisma.workerHeartbeat.findMany({
      where: { status: 'DEAD' },
      select: { workerId: true },
    });
    return rows.map((r) => r.workerId);
  }
}
