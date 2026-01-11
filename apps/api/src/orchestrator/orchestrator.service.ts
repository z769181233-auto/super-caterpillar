import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkerService))
    private readonly workerService: WorkerService,
    private readonly auditLogService: AuditLogService,
    private readonly taskService: TaskService,
    private readonly jobService: JobService,
    private readonly engineRegistry: EngineRegistry
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
   * Worker 拉取下一个待处理的 Job（安全版本）
   * 参考《调度系统设计书_V1.0》第 3.1~3.5 章：使用 JobService 的安全领取方法防止竞态
   *
   * @param workerId Worker ID
   * @returns 领取到的 Job，如果没有可用的 Job 则返回 null
   */
  async dispatchNextJobForWorker(workerId: string) {
    // 使用 JobService 的安全领取方法（防止多 Worker 抢到同一条 Job）
    const job = await this.jobService.getAndMarkNextPendingJob(workerId);

    if (!job) {
      // 没有可用的 Job，记录 debug 日志
      this.logger.debug(`[Orchestrator] No job available for worker ${workerId}`);
      return null;
    }

    // 记录结构化日志（参考要求：领取 Job 时打出 jobId + workerId）
    // 参考《平台日志监控与可观测性体系说明书_ObservabilityMonitoringSpec_V1.0》：结构化日志格式
    this.logger.log(
      JSON.stringify({
        event: 'JOB_CLAIMED',
        jobId: job.id,
        workerId,
        jobType: job.type,
        taskId: job.taskId || null,
        statusBefore: job.status,
        statusAfter: 'RUNNING',
        timestamp: new Date().toISOString(),
      })
    );

    // 记录审计日志
    await this.auditLogService.record({
      action: 'JOB_DISPATCHED',
      resourceType: 'job',
      resourceId: job.id,
      details: {
        workerId,
        jobType: job.type,
        taskId: job.taskId,
      },
    });

    return job;
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
}
