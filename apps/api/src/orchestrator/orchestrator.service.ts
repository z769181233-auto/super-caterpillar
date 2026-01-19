import * as fs from 'fs';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { ProjectModule } from '../project/project.module';
import { NovelImportModule } from '../novel-import/novel-import.module';
import { PublishedVideoService } from '../publish/published-video.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerService } from '../worker/worker.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TaskService } from '../task/task.service';
import { JobService } from '../job/job.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import {
  Prisma,
  JobStatus as JobStatusEnum,
  JobType as JobTypeEnum,
  TaskType as TaskTypeEnum,
  TaskStatus as TaskStatusEnum,
} from 'database';
import { assertTransition, transitionJobStatusAdmin } from '../job/job.rules';

/**
 * Orchestrator 服务
 * 负责将 PENDING Job 分配给 ONLINE Worker
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkerService))
    private readonly workerService: WorkerService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService,
    @Inject(TaskService)
    private readonly taskService: TaskService,
    @Inject(forwardRef(() => JobService))
    private readonly jobService: JobService,
    @Inject(EngineRegistry)
    private readonly engineRegistry: EngineRegistry,
    @Inject(PublishedVideoService)
    private readonly publishedVideoService: PublishedVideoService
  ) {}

  /**
   * 扫描 PENDING Job 并分配给 ONLINE Worker
   * 注意：此方法已废弃，改为使用 Worker 主动拉取模式（dispatchNextJobForWorker）
   * 保留此方法仅用于兼容，实际调度由 Worker 主动调用 dispatchNextJobForWorker
   *
   * 参考《调度系统设计书_V1.0》第 3.1~3.5 章：统一使用安全的 Job 领取逻辑
   * 参考《调度系统设计书_V1.0》第 5 章：故障恢复机制
   */
  async dispatch() {
    // Deprecated: use scheduleRecovery() for background tasks
    // and worker pull model for job dispatching
    return this.scheduleRecovery();
  }

  /**
   * P1-1: Automated Fault Recovery
   * Runs every 5 seconds to cleanup dead workers and recover jobs.
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async scheduleRecovery() {
    const { env: scuEnv } = await import('@scu/config');
    this.logger.log(`Running automated recovery task... (Grace: ${scuEnv.workerOfflineGraceMs}ms)`);

    // Stage2-B: 1. 标记超时的 Worker 为 DEAD 并回收 Job
    const offlineCount = await this.workerService.markOfflineWorkers();
    if (offlineCount > 0) {
      this.logger.log(`Marked ${offlineCount} workers as offline (dead)`);
    }

    // Stage2-B: 2. 故障恢复：处理 DEAD Worker 的 DISPATCHED 和 RUNNING Job
    // 参考调度系统设计书 §5.3：Worker 异常退出时的 Job 恢复
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

    // 注意：不再主动分配 Job，改为 Worker 主动拉取模式
    // 这样可以避免"先查后改"的竞态问题，统一使用 JobService.getAndMarkNextPendingJob
    // 实际调度由 Worker 通过 POST /workers/:workerId/jobs/next 主动拉取

    return {
      pending: pendingJobsCount,
      dispatched: 0, // 不再主动分配
      skipped: 0,
      errors: 0,
      recovered: recoveredCount,
      retryReady: retryReadyCount,
      message:
        'Job dispatch is now handled by worker pull model. Workers should call dispatchNextJobForWorker.',
    };
  }

  /**
   * 故障恢复：处理 offline Worker 的 RUNNING Job
   * 参考《调度系统设计书_V1.0》§5.3：Worker 异常退出时的 Job 恢复
   *
   * 策略：
   * - 扫描所有 status=RUNNING && worker.status=offline 的 Job
   * - 将这些 Job 标记为可重试（调用 JobService.markJobFailedAndMaybeRetry）
   * - 如果已达到最大重试次数，标记为 FAILED
   */
  private async recoverJobsFromOfflineWorkers(): Promise<number> {
    // Stage2-B: 基于 WorkerHeartbeat 模型查找 DEAD worker
    const HEARTBEAT_TTL_SECONDS = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
    const timeoutThreshold = new Date(Date.now() - HEARTBEAT_TTL_SECONDS * 3 * 1000);

    // 查找所有 status=DEAD 的 WorkerHeartbeat
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

    const offlineWorkerIds = offlineWorkers.map((w: any) => w.id);

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
      } catch (error: any) {
        this.logger.error(`[Orchestrator] Failed to recover job ${job.id}: ${error.message}`);
      }
    }

    // Stage2-B: 写入 audit_logs（WORKER_DEAD_RECOVERY）
    if (recoveredCount > 0 && deadHeartbeats.length > 0) {
      const workerId = deadWorkerIds[0] || 'unknown';
      const lastSeenAt =
        deadHeartbeats.find((h) => h.workerId === workerId)?.lastSeenAt || new Date();
      const HEARTBEAT_TTL_SECONDS = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);

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
    const onlineWorkers = await this.workerService.getOnlineWorkers();
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
    const waitTimes = pendingJobsWithTime.map(
      (job: any) => now.getTime() - job.createdAt.getTime()
    );
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
   * Worker 拉取下一个待处理的 Job（原子派工版）
   * STAGE-2 S2-ORCH-BASE: 原子 Claim 实现
   *
   * @param workerId 业务 Worker ID (String)
   * @returns 领取到的 Job，如果没有可用的 Job 则返回 null
   */
  async dispatchNextJobForWorker(workerId: string) {
    // 1. Resolve WorkerNode (String -> UUID)
    const workerNode = await this.prisma.workerNode.findUnique({
      where: { workerId },
      include: { shotJobs: { where: { status: JobStatusEnum.RUNNING } } },
    });

    if (!workerNode) {
      this.logger.warn(`[Orchestrator] Worker not found for dispatch: ${workerId}`);
      return null;
    }

    // 2. Atomic Claim via Transaction
    const dispatchedJob = await this.prisma.$transaction(async (tx) => {
      // 2.0 Recovery: Check if worker already has a DISPATCHED job (e.g. restart/crash recovery)
      // This is CRITICAL for idempotency and robust worker restarts
      const existingJob = await tx.shotJob.findFirst({
        where: {
          workerId: workerNode.id,
          status: JobStatusEnum.DISPATCHED,
        },
      });

      if (existingJob) {
        this.logger.log(
          `[Orchestrator] Recovering existing job ${existingJob.id} for worker ${workerId}`
        );
        return existingJob;
      }

      // 2.1 Find one candidate PENDING job
      // TODO: Filter by worker capabilities (Stage-2 Scope: Allow all for now)
      const pendingCount = await tx.shotJob.count({ where: { status: JobStatusEnum.PENDING } });
      console.log(`[Orchestrator_DEBUG] Total PENDING jobs: ${pendingCount}`);

      const candidate = await tx.shotJob.findFirst({
        where: {
          status: JobStatusEnum.PENDING,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 1,
      });

      console.log(
        `[Orchestrator_DEBUG] Candidate for ${workerId}: ${candidate ? candidate.id : 'NONE'}`
      );

      if (!candidate) {
        this.logger.warn(`[Orchestrator] No PENDING job found for dispatch.`);
        return null;
      }
      this.logger.log(`[Orchestrator] Found candidate job: ${candidate.id}`);

      // 2.2 Atomic Update (Optimistic Concurrency Control)
      // 使用 updateMany + where status=PENDING 确保只有一个人能抢到
      const updateResult = await tx.shotJob.updateMany({
        where: {
          id: candidate.id,
          status: JobStatusEnum.PENDING, // Key Assertion
        },
        data: {
          status: JobStatusEnum.DISPATCHED,
          workerId: workerNode.id, // Store UUID, not string
        },
      });

      if (updateResult.count === 0) {
        // Race condition: Job was claimed by another worker
        this.logger.warn(
          `[Orchestrator] Race condition: Job ${candidate.id} claimed by another worker`
        );
        return null;
      }

      // 2.3 Fetch full job details to return
      return await tx.shotJob.findUnique({
        where: { id: candidate.id },
      });
    });

    if (!dispatchedJob) {
      this.logger.warn(`[Orchestrator] Dispatch returned null. WorkerId=${workerId}`);
      return null;
    }

    // 结构化日志：JOB_CLAIMED
    this.logger.log(
      JSON.stringify({
        event: 'JOB_CLAIMED',
        jobId: dispatchedJob.id,
        workerId, // Log business ID for readability
        workerNodeId: workerNode.id,
        jobType: dispatchedJob.type,
        taskId: dispatchedJob.taskId || null,
        status: 'DISPATCHED',
        timestamp: new Date().toISOString(),
      })
    );

    // 记录审计日志
    await this.auditLogService.record({
      action: 'JOB_DISPATCHED',
      resourceType: 'job',
      resourceId: dispatchedJob.id,
      details: {
        workerId: workerId,
        nodeId: workerNode.id,
        jobType: dispatchedJob.type,
        taskId: dispatchedJob.taskId,
      },
    });

    return dispatchedJob;
  }

  /**
   * Stage 3: Event-Driven DAG Trigger
   * Called by JobService when a job completes (SUCCEEDED).
   * Determines if subsequent jobs should be spawned.
   */
  async handleJobCompletion(jobId: string, result: any) {
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

    if (!job) return;

    // DAG Logic for Stage 1: SHOT_RENDER -> VIDEO_RENDER
    if (job.type === JobTypeEnum.SHOT_RENDER && job.status === JobStatusEnum.SUCCEEDED) {
      this.logger.log(
        `[DAG] SHOT_RENDER ${jobId} completed. Checking Stage 1 pipeline progress...`
      );
      await this.checkAndSpawnStage1VideoRender(job);
    }

    // DAG Logic: VIDEO_RENDER -> CE09 (Media Security)
    if (job.type === JobTypeEnum.VIDEO_RENDER && job.status === JobStatusEnum.SUCCEEDED) {
      this.logger.log(`[DAG] VIDEO_RENDER ${jobId} completed. Checking CE09 trigger...`);
      await this.checkAndSpawnCE09(job);
    }
  }

  /**
   * Stage 3: Check if all shots in a pipeline run are complete, then spawn VIDEO_RENDER.
   */
  private async checkAndSpawnStage1VideoRender(completedJob: any) {
    // const fs = require('fs');
    const debugLog = (msg: string) =>
      fs.appendFileSync('/tmp/orchestrator_debug.log', `[${new Date().toISOString()}] ${msg}\n`);

    const payload = completedJob.payload as any;
    const pipelineRunId = payload?.pipelineRunId;

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

    if (total > 0 && succeeded === total) {
      // 2. All Good! Aggregation Time.
      // Use allShots[0] as context because it has 'shot' relation loaded (unlike completedJob potentially)
      await this.aggregateAndSpawnVideoRender(allShots, pipelineRunId, allShots[0]);
    }
  }

  private async aggregateAndSpawnVideoRender(shots: any[], pipelineRunId: string, contextJob: any) {
    // 2.1 Idempotency Check: Did we already spawn a VIDEO_RENDER for this run?
    const existingVideoJob = await this.prisma.shotJob.findFirst({
      where: {
        type: JobTypeEnum.VIDEO_RENDER,
        payload: {
          path: ['pipelineRunId'],
          equals: pipelineRunId,
        },
      },
    });

    if (existingVideoJob) {
      this.logger.log(
        `[DAG] VIDEO_RENDER for ${pipelineRunId} already exists (${existingVideoJob.id}). Skipping.`
      );
      return;
    }

    // 2.2 Collect Frames
    const frames: string[] = [];
    // Sort by shot index if possible, otherwise use array order (which is unreliable without explicit index)
    // We should probably rely on Shot.index, but let's assume shot creation order or job creation order roughly correlates
    // Better: Sort by created_at or explicitly by shot index if we fetched shots.
    // Let's simply collect generic frames for now as per previous logic.
    // Ideally we should join with Shot table to sort by Shot.index.
    // For MVP/Regression, we just collect what we have.

    // Sort shots by createdAt to be deterministic-ish
    shots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const job of shots) {
      const storageKey = (job.result as any)?.output?.storageKey;
      if (storageKey) {
        frames.push(storageKey);
      } else {
        this.logger.warn(`[DAG] Job ${job.id} SUCCEEDED but missing output.storageKey`);
      }
    }

    if (frames.length === 0) {
      this.logger.warn(`[DAG] No frames collected for ${pipelineRunId}. Skipping VIDEO_RENDER.`);
      return;
    }

    // 2.3 继承验证标记（关键：防止下游作业计费污染）
    const isVerification = !!contextJob.isVerification;
    const dedupeKey = isVerification ? `gate_video:${pipelineRunId}` : undefined;

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
        contextJob.shotId, // Owner context
        {
          type: JobTypeEnum.VIDEO_RENDER,
          traceId: contextJob.traceId,
          isVerification,
          dedupeKey,
          payload: {
            pipelineRunId,
            projectId: contextJob.projectId,
            episodeId: contextJob.shot?.episodeId || contextJob.episodeId,
            sceneId: contextJob.shot?.sceneId,
            frames,
            publish: true, // Worker handles publishing (with dedupe_key idempotency)
            traceId: contextJob.traceId,
            isVerification, // 也在 payload 中携带，便于 Worker 识别
          },
        } as any,
        'system-dag', // triggered by system
        contextJob.organizationId
      );

      this.logger.log(
        `[DAG] VIDEO_RENDER created: jobId=${videoJob.id}, isVerification=${isVerification}`
      );
    } catch (e: any) {
      this.logger.error(`[DAG] Failed to spawn VIDEO_RENDER: ${e.message}`);
    }
  }

  /**
   * Stage 3-Final: Trigger CE09 after VIDEO_RENDER
   */
  private async checkAndSpawnCE09(videoJob: any) {
    const payload = videoJob.payload as any;
    const pipelineRunId = payload?.pipelineRunId;

    // 1. Idempotency Check
    const existing = await this.prisma.shotJob.findFirst({
      where: {
        type: JobTypeEnum.CE09_MEDIA_SECURITY,
        payload: { path: ['pipelineRunId'], equals: pipelineRunId },
      },
    });
    if (existing) {
      this.logger.log(`[DAG] CE09 for ${pipelineRunId} already exists (${existing.id}). Skipping.`);
      return;
    }

    // 2. Resolve Asset ID from Result
    const start = Date.now();
    // Wait for result to be persisted if needed? No, handleJobCompletion fetched job, but did it fetch result?
    // job.result is JSON.
    const result = videoJob.result as any;
    const assetId = result?.output?.assetId;
    const storageKey = result?.output?.storageKey;

    if (!assetId || !storageKey) {
      this.logger.error(
        `[DAG] VIDEO_RENDER succeeded but missing assetId/storageKey in result. Cannot spawn CE09. Result: ${JSON.stringify(result)}`
      );
      return;
    }

    this.logger.log(`[DAG] Spawning CE09 for ${pipelineRunId} from VIDEO_RENDER asset ${assetId}`);

    try {
      await this.jobService.create(
        videoJob.shotId || videoJob.id,
        {
          type: JobTypeEnum.CE09_MEDIA_SECURITY,
          traceId: videoJob.traceId,
          payload: {
            pipelineRunId,
            projectId: payload.projectId,
            episodeId: payload.episodeId,
            shotId: videoJob.shotId,
            assetId,
            videoAssetStorageKey: storageKey,
            traceId: videoJob.traceId,
            engineKey: 'ce09_security_real',
          },
        } as any,
        'system-dag', // triggered by system
        videoJob.organizationId
      );
      this.logger.log(`[DAG] CE09 spawned successfully for ${pipelineRunId}`);
    } catch (e: any) {
      this.logger.error(`[DAG] Failed to spawn CE09: ${e.message}`);
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
  async startStage1Pipeline(params: { novelText: string; projectId?: string }) {
    try {
      const { novelText, projectId: existingProjectId } = params;
      const { randomUUID } = await import('crypto');
      const traceId = `stage1_${randomUUID()}`;

      // 1. Resolve Project (Create if missing)
      let projectId = existingProjectId;
      const defaultOrg = await this.prisma.organization.findFirst();
      let organizationId = defaultOrg?.id || 'default-org';

      const defaultUser = await this.prisma.user.findFirst();
      const ownerId = defaultUser?.id || 'system';

      if (!projectId) {
        const project = await this.prisma.project.create({
          data: {
            name: `Stage1_${new Date().toISOString().slice(0, 10)}`,
            organizationId,
            status: 'in_progress',
            ownerId,
          } as any,
        });
        projectId = project.id;
      } else {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error(`Project ${projectId} not found`);
        organizationId = project.organizationId;
      }

      // 2. Create Novel Source & Volume & Chapter
      const novelSource = await this.prisma.novel.create({
        data: {
          projectId,
          author: 'System',
          rawText: novelText,
        } as any,
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
        } as any,
      });

      // Save actual text to Scene (Minimal context)
      await this.prisma.scene.create({
        data: {
          chapterId: chapter.id,
          sceneIndex: 1, // V3.0 compliance
          enrichedText: novelText,
        },
      });

      // 3. Create Season & Episode for orchestration
      const season = await this.prisma.season.create({
        data: {
          projectId,
          index: 1,
          title: 'Season 1',
        } as any,
      });

      const episode = await this.prisma.episode.create({
        data: {
          projectId,
          seasonId: season.id,
          index: 1,
          name: 'Chapter 1',
          chapterId: chapter.id,
        } as any,
      });

      // 3.5 Create placeholder Scene & Shot for Pipeline Job
      const scene = await this.prisma.scene.create({
        data: {
          episodeId: episode.id,
          projectId,
          sceneIndex: 9999, // V3.0 compliance
          title: 'Stage 1 Pipeline Scene',
          summary: 'Auto-generated for pipeline orchestration',
        },
      });

      const shot = await this.prisma.shot.create({
        data: {
          sceneId: scene.id,
          index: 9999,
          title: 'Stage 1 Pipeline Shot',
          description: 'Auto-generated for pipeline orchestration',
          type: 'pipeline_stage1',
          params: {},
          organizationId,
        } as any,
      });

      // 4. Dispatch the Pipeline Job
      const job = await this.jobService.create(
        shot.id,
        {
          type: JobTypeEnum.PIPELINE_STAGE1_NOVEL_TO_VIDEO,
          traceId,
          payload: {
            novelText,
            novelSourceId: novelSource.id,
            chapterId: chapter.id,
            episodeId: episode.id,
            pipelineRunId: traceId,
            projectId,
            organizationId,
          },
        } as any,
        ownerId,
        organizationId
      );

      this.logger.log(
        `Stage 1 Pipeline Started: jobId=${job.id}, projectId=${projectId}, traceId=${traceId}`
      );

      return {
        success: true,
        pipelineRunId: traceId,
        jobId: job.id,
        projectId,
        episodeId: episode.id,
      };
    } catch (e: any) {
      this.logger.error({
        tag: 'ORCHESTRATOR_PIPELINE_ERROR',
        error: e.message,
        stack: e.stack,
        params: { novelTextLen: params.novelText?.length, projectId: params.projectId },
      });
      throw e;
    }
  }
}
