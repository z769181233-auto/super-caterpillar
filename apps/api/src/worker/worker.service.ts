import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { JobService } from '../job/job.service'; // S3-C.3: 导入 JobService 以使用统一的引擎信息提取方法
import { WorkerStatus, JobStatus } from 'database';
import { assertTransition } from '../job/job.rules';
import { randomUUID } from 'crypto';

const { Client } = require('pg');

/**
 * Worker 管理服务
 * 负责 Worker 注册、心跳、状态管理
 */
@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private readonly prismaQueryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => JobService))
    private readonly jobService: JobService
  ) { }

  // P6-2-2-1: Dispatch Rate Limiting (Anti-Cascade Flood)
  private dispatchHistory: Map<string, number[]> = new Map();
  private readonly CASCADE_LIMIT = 100; // max 100 jobs per 10s per worker node
  private readonly CASCADE_WINDOW = 10000;

  /**
   * 注册或更新 Worker
   * @param workerId Worker 唯一标识
   * @param name Worker 名称
   * @param capabilities Worker 能力（支持的任务类型等）
   */
  async registerWorker(
    workerId: string,
    name: string,
    capabilities: any,
    gpuCount?: number,
    gpuMemory?: number,
    gpuType?: string,
    userId?: string,
    apiKeyId?: string,
    ip?: string,
    userAgent?: string
  ) {
    const payload = {
      workerId,
      name,
      capabilities,
      gpuCount,
      gpuMemory,
      gpuType,
    };

    let worker: any;
    try {
      worker = await this.prisma.workerNode.findUnique({
        where: { workerId },
      });

      if (worker) {
        worker = await this.prisma.workerNode.update({
          where: { workerId },
          data: {
            name,
            status: WorkerStatus.online,
            capabilities: capabilities as any,
            gpuCount,
            gpuMemory,
            gpuType,
            lastHeartbeat: new Date(),
          },
        });
      } else {
        worker = await this.prisma.workerNode.create({
          data: {
            workerId,
            name,
            status: WorkerStatus.online,
            capabilities: capabilities as any,
            gpuCount,
            gpuMemory,
            gpuType,
            lastHeartbeat: new Date(),
          },
        });
      }
    } catch (error: any) {
      if (!this.shouldFallbackToPg(error)) {
        throw error;
      }
      this.logger.warn(
        `[WorkerService] Prisma registerWorker degraded for ${workerId}, using pg fallback: ${error.message}`
      );
      worker = await this.registerWorkerViaPg(payload);
    }

    // 记录审计日志
    await this.auditLogService.record({
      userId,
      apiKeyId,
      action: 'WORKER_REGISTERED',
      resourceType: 'worker',
      resourceId: worker.id,
      ip,
      userAgent,
      details: {
        workerId: worker.workerId,
        name,
        capabilities: worker.capabilities,
        status: worker.status,
      },
    });

    return worker;
  }

  /**
   * Worker 心跳
   * Stage2-B: 使用 WorkerHeartbeat 模型记录心跳
   * 参考《调度系统设计书_V1.0》§3.2~3.3：Worker 心跳机制和状态判断
   *
   * @param workerId Worker 唯一标识
   * @param status Worker 状态（可选，用于更新状态）
   * @param tasksRunning 当前运行的任务数（可选）
   * @param temperature Worker 温度（可选）
   * @param userId 用户 ID（用于审计日志）
   * @param apiKeyId API Key ID（用于审计日志）
   * @param ip IP 地址（用于审计日志）
   * @param userAgent UserAgent（用于审计日志）
   */
  async heartbeat(
    workerId: string,
    status?: WorkerStatus,
    tasksRunning?: number,
    temperature?: number,
    _userId?: string,
    _apiKeyId?: string,
    _ip?: string,
    _userAgent?: string
  ) {
    const now = new Date();
    try {
      const worker = await this.prisma.workerNode.findUnique({
        where: { workerId },
      });

      if (!worker) {
        throw new NotFoundException(`Worker ${workerId} not found`);
      }

      await this.prisma.workerHeartbeat.upsert({
        where: { workerId },
        create: {
          workerId,
          lastSeenAt: now,
          status: 'ALIVE',
        },
        update: {
          lastSeenAt: now,
        },
      });

      const runningJobCount = await this.prisma.shotJob.count({
        where: {
          workerId: worker.id,
          status: JobStatus.RUNNING,
        },
      });

      const updateData: any = {
        lastHeartbeat: now,
      };

      if (status) {
        updateData.status = status;
      } else {
        const actualTasksRunning = tasksRunning !== undefined ? tasksRunning : runningJobCount;

        if (actualTasksRunning > 0) {
          updateData.status = WorkerStatus.busy;
        } else {
          updateData.status =
            worker.status === WorkerStatus.offline ? WorkerStatus.offline : WorkerStatus.idle;
        }
      }

      if (tasksRunning !== undefined) {
        updateData.tasksRunning = tasksRunning;
      } else {
        updateData.tasksRunning = runningJobCount;
      }

      if (temperature !== undefined) {
        updateData.temperature = temperature;
      }

      return await this.prisma.workerNode.update({
        where: { workerId },
        data: updateData,
      });
    } catch (error: any) {
      if (error instanceof NotFoundException || !this.shouldFallbackToPg(error)) {
        throw error;
      }
      this.logger.warn(
        `[WorkerService] Prisma heartbeat degraded for ${workerId}, using pg fallback: ${error.message}`
      );
      return this.heartbeatViaPg(workerId, now, status, tasksRunning, temperature);
    }
  }

  private shouldFallbackToPg(error: any): boolean {
    const message = String(error?.message || '');
    return (
      message.includes('PRISMA_QUERY_TIMEOUT') ||
      message.includes('startup connect exceeded') ||
      message.includes("Can't reach database server") ||
      message.includes('P1001')
    );
  }

  private async withPgClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: this.prismaQueryTimeoutMs,
      query_timeout: this.prismaQueryTimeoutMs,
    });

    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async registerWorkerViaPg(payload: {
    workerId: string;
    name: string;
    capabilities: any;
    gpuCount?: number;
    gpuMemory?: number;
    gpuType?: string;
  }) {
    return this.withPgClient(async (client) => {
      const now = new Date();
      const result = await client.query(
        `
          INSERT INTO worker_nodes (
            id,
            "workerId",
            name,
            status,
            "gpuCount",
            "gpuMemory",
            "gpuType",
            "tasksRunning",
            capabilities,
            "lastHeartbeat",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            $1,
            $2,
            $3,
            'online'::worker_status,
            $4,
            $5,
            $6,
            0,
            $7::jsonb,
            $8,
            $8,
            $8
          )
          ON CONFLICT ("workerId")
          DO UPDATE SET
            name = EXCLUDED.name,
            status = 'online'::worker_status,
            "gpuCount" = EXCLUDED."gpuCount",
            "gpuMemory" = EXCLUDED."gpuMemory",
            "gpuType" = EXCLUDED."gpuType",
            capabilities = EXCLUDED.capabilities,
            "lastHeartbeat" = EXCLUDED."lastHeartbeat",
            "updatedAt" = EXCLUDED."updatedAt"
          RETURNING *
        `,
        [
          randomUUID(),
          payload.workerId,
          payload.name || null,
          payload.gpuCount ?? 0,
          payload.gpuMemory ?? 0,
          payload.gpuType ?? 'unknown',
          JSON.stringify(payload.capabilities ?? {}),
          now,
        ]
      );

      return result.rows[0];
    });
  }

  private async heartbeatViaPg(
    workerId: string,
    now: Date,
    status?: WorkerStatus,
    tasksRunning?: number,
    temperature?: number
  ) {
    return this.withPgClient(async (client) => {
      const workerResult = await client.query(
        `
          SELECT *
          FROM worker_nodes
          WHERE "workerId" = $1
          LIMIT 1
        `,
        [workerId]
      );
      const worker = workerResult.rows[0];
      if (!worker) {
        throw new NotFoundException(`Worker ${workerId} not found`);
      }

      await client.query(
        `
          INSERT INTO worker_heartbeats (
            worker_id,
            last_seen_at,
            status,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'ALIVE', $2, $2)
          ON CONFLICT (worker_id)
          DO UPDATE SET
            last_seen_at = EXCLUDED.last_seen_at,
            updated_at = EXCLUDED.updated_at
        `,
        [workerId, now]
      );

      const runningJobCountResult = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM shot_jobs
          WHERE "workerId" = $1
            AND status = $2
        `,
        [worker.id, JobStatus.RUNNING]
      );
      const runningJobCount = runningJobCountResult.rows[0]?.count ?? 0;
      const actualTasksRunning = tasksRunning !== undefined ? tasksRunning : runningJobCount;

      let resolvedStatus = status;
      if (!resolvedStatus) {
        resolvedStatus =
          actualTasksRunning > 0
            ? WorkerStatus.busy
            : worker.status === WorkerStatus.offline
              ? WorkerStatus.offline
              : WorkerStatus.idle;
      }

      const updated = await client.query(
        `
          UPDATE worker_nodes
          SET
            status = $2::worker_status,
            "tasksRunning" = $3,
            temperature = COALESCE($4, temperature),
            "lastHeartbeat" = $5,
            "updatedAt" = $5
          WHERE "workerId" = $1
          RETURNING *
        `,
        [workerId, resolvedStatus, actualTasksRunning, temperature ?? null, now]
      );

      return updated.rows[0];
    });
  }

  /**
   * 获取在线 Worker 列表
   * 参考《调度系统设计书_V1.0》§3.3~3.4：Worker 状态判断和 Disabled Worker 跳过逻辑
   *
   * @param jobType 可选，过滤支持特定 jobType 的 Worker
   */
  async getOnlineWorkers(jobType?: string): Promise<any[]> {
    const workers = await this.prisma.workerNode.findMany({
      where: {
        status: {
          in: [WorkerStatus.online, WorkerStatus.idle, WorkerStatus.busy],
        },
      },
    });

    // 过滤掉被禁用的 Worker（参考调度系统设计书 §3.4）
    const enabledWorkers = workers.filter((worker: any) => {
      const caps = worker.capabilities as any;
      return caps?.disabled !== true;
    });

    // 如果指定了 jobType，过滤出支持该类型的 Worker
    if (jobType) {
      return enabledWorkers.filter((worker: any) => {
        const caps = worker.capabilities as any;
        return caps?.supportedJobTypes?.includes(jobType);
      });
    }

    return enabledWorkers;
  }

  /**
   * 检查 Worker 是否在线（心跳未超时）
   */
  async isWorkerOnline(workerId: string): Promise<boolean> {
    const worker = await this.prisma.workerNode.findUnique({
      where: { workerId },
    });

    if (!worker) {
      return false;
    }

    // P0 修复：使用环境变量配置 timeout
    const { env } = await import('@scu/config');
    const timeoutMs = env.workerHeartbeatTimeoutMs || 30000;
    const timeoutThreshold = new Date(Date.now() - timeoutMs);

    return (
      worker.lastHeartbeat >= timeoutThreshold &&
      (worker.status === WorkerStatus.online ||
        worker.status === WorkerStatus.idle ||
        worker.status === WorkerStatus.busy)
    );
  }

  /**
   * 获取分配给 Worker 的下一个 DISPATCHED Job
   * @param workerId Worker ID
   */
  async getNextDispatchedJob(workerId: string): Promise<any> {
    const worker = await this.prisma.workerNode.findUnique({
      where: { workerId },
    });

    if (!worker) {
      return null;
    }

    // 查找分配给该 Worker 的 DISPATCHED Job（Stage2-A：Worker 只能领取 DISPATCHED 状态的 Job）
    const job = await this.prisma.shotJob.findFirst({
      where: {
        workerId: worker.id,
        status: JobStatus.DISPATCHED, // Stage2-A: 改为 DISPATCHED
      },
      include: {
        task: true,
        shot: {
          include: {
            scene: {
              include: {
                episode: {
                  include: {
                    project: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return job;
  }

  /**
   * Worker 开始执行 Job（更新状态为 RUNNING）
   * @param jobId Job ID
   * @param workerId Worker ID（用于验证）
   */
  async startJob(jobId: string, workerId: string): Promise<any> {
    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: { worker: true },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // 验证 Job 是否分配给该 Worker
    if (job.worker?.workerId !== workerId) {
      throw new BadRequestException(`Job ${jobId} is not assigned to worker ${workerId}`);
    }

    // P1 修复：验证状态转换（规则型正确）
    assertTransition(job.status, JobStatus.RUNNING, {
      jobId: job.id,
      workerId,
      errorCode: 'JOB_STARTED',
    });

    // 更新 Job 状态为 RUNNING
    const updatedJob = await this.prisma.shotJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        attempts: job.attempts + 1,
      },
    });

    // 更新 Worker 状态为 busy（如果当前是 idle）
    if (job.worker.status === WorkerStatus.idle) {
      await this.prisma.workerNode.update({
        where: { id: job.worker.id },
        data: {
          status: WorkerStatus.busy,
          tasksRunning: job.worker.tasksRunning + 1,
        },
      });
    }

    return updatedJob;
  }

  /**
   * Stage2-B: 基于 WorkerHeartbeat 的超时检测
   * 标记超时的 Worker 为 OFFLINE（Dead）
   * 参考《调度系统设计书_V1.0》§3.3：Worker 状态判断（Dead = 心跳超时）
   */
  async markOfflineWorkers(): Promise<number> {
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
        data: { status: WorkerStatus.offline },
      });
    }

    // 统一回收入口(商业级:三重断言 + 事务 + 审计)
    const reclaimedCount = await this.reclaimJobsFromDeadWorkers();
    if (reclaimedCount > 0) {
      this.logger.warn(
        `[WorkerService] Reclaimed ${reclaimedCount} jobs from dead workers (unified).`
      );
    }
    return reclaimedCount;
  }

  /**
   * 判断 Worker 状态（Idle/Busy/Dead）
   * 参考《调度系统设计书_V1.0》§3.3：Worker 状态判断
   *
   * @param worker Worker 对象
   * @returns 'idle' | 'busy' | 'dead'
   */
  private async determineWorkerState(worker: any): Promise<'idle' | 'busy' | 'dead'> {
    // P0 修复：使用环境变量配置 timeout
    const { env } = await import('@scu/config');
    const timeoutMs = env.workerHeartbeatTimeoutMs || 30000;
    const timeoutThreshold = new Date(Date.now() - timeoutMs);

    // Dead：心跳超时
    if (worker.lastHeartbeat < timeoutThreshold) {
      return 'dead';
    }

    // Busy：有运行中的任务
    if (worker.tasksRunning > 0) {
      return 'busy';
    }

    // Idle：在线且没有运行任务
    return 'idle';
  }

  /**
   * 获取 Worker 监控快照
   * 用于监控面板展示 Worker 状态统计
   */
  async getWorkerMonitorSnapshot() {
    const workers = await this.prisma.workerNode.findMany({
      orderBy: { id: 'asc' },
    });

    const now = Date.now();
    // P2 修复：使用环境变量配置 timeout
    const { env } = await import('@scu/config');
    const TIMEOUT = env.workerHeartbeatTimeoutMs || 30000;

    // S3-C.1: 查找每个 worker 当前正在处理的 job（status=RUNNING 且 workerId 匹配）
    const workerIds = workers.map((w: any) => w.id);
    const runningJobs = await this.prisma.shotJob.findMany({
      where: {
        status: 'RUNNING',
        workerId: { in: workerIds },
      },
      select: {
        id: true,
        workerId: true,
        type: true,
        payload: true,
      },
    });

    // 构建 workerId -> job 的映射
    const workerJobMap = new Map<string, any>();
    for (const job of runningJobs) {
      if (job.workerId) {
        workerJobMap.set(job.workerId, job);
      }
    }

    const formatted = await Promise.all(
      workers.map(async (w: any) => {
        const currentJob = workerJobMap.get(w.id);
        let currentEngineKey: string | null = null;

        if (currentJob) {
          // S3-C.1: 从 job 中提取 engineKey
          // S3-C.3: 使用 JobService 的统一方法提取引擎信息
          currentEngineKey = this.jobService.extractEngineKeyFromJob(currentJob);
        }

        return {
          id: w.id,
          status: w.status,
          capabilities: w.capabilities,
          isOnline: w.lastHeartbeat ? now - w.lastHeartbeat.getTime() < TIMEOUT : false,
          lastHeartbeat: w.lastHeartbeat?.toISOString() ?? null,
          tasksRunning: w.tasksRunning,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
          // S3-C.1: 新增字段
          currentEngineKey,
        };
      })
    );

    return {
      total: workers.length,
      online: formatted.filter((w) => w.isOnline).length,
      offline: formatted.filter((w) => !w.isOnline).length,
      idle: formatted.filter((w) => w.status === 'idle').length,
      busy: formatted.filter((w) => w.status === 'busy').length,
      workers: formatted,
    };
  }

  /**
   * P1-2: HA Failover - 评估Worker健康状态
   * 数据源: workerHeartbeat.lastSeenAt (与SSO T一致)
   */
  async evaluateWorkerHealth(workerId: string): Promise<{
    workerId: string;
    status: 'HEALTHY' | 'DEGRADED' | 'DEAD';
    lastSeenSec?: number;
  }> {
    const { env: scuEnv } = await import('@scu/config');
    const { workerOfflineGraceMs } = scuEnv;

    const hb = await this.prisma.workerHeartbeat.findUnique({
      where: { workerId },
      select: { lastSeenAt: true },
    });

    if (!hb?.lastSeenAt) return { workerId, status: 'DEAD' };

    const diffMs = Date.now() - hb.lastSeenAt.getTime();
    const diffSec = diffMs / 1000;

    const graceSec = workerOfflineGraceMs / 1000;
    if (diffSec > graceSec) return { workerId, status: 'DEAD', lastSeenSec: diffSec };
    if (diffSec > graceSec * 0.8) return { workerId, status: 'DEGRADED', lastSeenSec: diffSec };
    return { workerId, status: 'HEALTHY', lastSeenSec: diffSec };
  }

  /**
   * P1-2: HA Failover - 获取DEAD Worker IDs
   * SSOT单入口:只读status='DEAD'(判死由markOfflineWorkers唯一负责)
   */
  private async getDeadWorkerIds(): Promise<string[]> {
    const rows = await this.prisma.workerHeartbeat.findMany({
      where: { status: 'DEAD' },
      select: { workerId: true },
    });
    return rows.map((r) => r.workerId);
  }

  /**
   * P1-2: HA Failover - 商业级回收:三重断言 + 事务 + 审计
   * 返回 reclaimed job 数量
   */
  async reclaimJobsFromDeadWorkers(): Promise<number> {
    const deadWorkerIds = await this.getDeadWorkerIds();
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

      // fail-fast: projectId 不能为空(避免静默过滤导致审计缺失)
      for (const j of orphaned) {
        if (!j.projectId) {
          throw new Error(
            `Cannot reclaim job without projectId: jobId=${j.id}, deadWorkerId=${j.lockedBy}`
          );
        }
      }

      // 批量回到 PENDING
      await tx.shotJob.updateMany({
        where: { id: { in: orphaned.map((j) => j.id) } },
        data: {
          status: 'PENDING',
          workerId: null,
          lockedBy: null,
          leaseUntil: null,
          lastError: 'reclaimed: dead worker',
        },
      });

      // projectId -> orgId 映射(已确保非空)
      const projectIds = Array.from(new Set(orphaned.map((j) => j.projectId as string)));
      const projects = await tx.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, organizationId: true },
      });
      const projToOrg = new Map(projects.map((p) => [p.id, p.organizationId]));

      // 校验: org 不能为空(避免回收成功但审计缺失)
      for (const j of orphaned) {
        const org = projToOrg.get(j.projectId);
        if (!org) {
          throw new Error(
            `Cannot resolve org for projectId=${j.projectId} when reclaiming jobId=${j.id}`
          );
        }
      }

      // 审计(按 orgId 写)
      await tx.auditLog.createMany({
        data: orphaned.map((j) => ({
          action: 'JOB_RECLAIMED_FROM_DEAD_WORKER',
          resourceType: 'shot_job',
          resourceId: j.id,
          orgId: projToOrg.get(j.projectId)!,
          details: { deadWorkerId: j.lockedBy, projectId: j.projectId },
          createdAt: new Date(),
        })),
      });

      this.logger.warn(
        `Reclaimed ${orphaned.length} jobs from ${deadWorkerIds.length} dead workers`
      );
      return orphaned.length;
    });
  }

  /**
   * Worker 拉取下一个待处理的 Job（原子派工版）
   * STAGE-2 S2-ORCH-BASE: 原子 Claim 实现
   *
   * @param workerId 业务 Worker ID (String)
   * @returns 领取到的 Job，如果没有可用的 Job 则返回 null
   */
  async dispatchNextJobForWorker(workerId: string) {
    console.log(`[API_WORKER_NEXT_SVC] entered for workerId=${workerId}`);
    const preflightHasPending = await this.hasPendingDispatchableJobsViaPg(workerId);
    if (preflightHasPending === false) {
      this.logger.debug(
        `[WorkerService] PG preflight found no dispatchable jobs for ${workerId}; returning null.`
      );
      return null;
    }
    // 1. Resolve WorkerNode (String -> UUID)
    try {
      const workerNode = await this.prisma.workerNode.findUnique({
        where: { workerId },
        include: { shotJobs: { where: { status: JobStatus.RUNNING } } },
      });
      console.log(`[API_WORKER_NEXT_SVC] worker lookup result=${!!workerNode}`);

      if (!workerNode) {
        this.logger.warn(`[WorkerService] Worker not found for dispatch: ${workerId}`);
        return null;
      }

      // P6-2-2-1: Cascade Throttling Check
      const now = Date.now();
      let history = this.dispatchHistory.get(workerId) || [];
      history = history.filter((t) => now - t < this.CASCADE_WINDOW);

      if (history.length >= this.CASCADE_LIMIT) {
        this.logger.warn(
          `[WorkerService] Worker ${workerId} hit dispatch limit (${history.length}/${this.CASCADE_LIMIT}). Throttling.`
        );
        return null; // Force worker to wait/backoff
      }

      this.dispatchHistory.set(workerId, history);

      // 2. Atomic Claim via Transaction
      const dispatchedJob = await this.prisma.$transaction(async (tx) => {
        // 2.0 Recovery: Check if worker already has a DISPATCHED job (e.g. restart/crash recovery)
        const existingJob = await tx.shotJob.findFirst({
          where: {
            workerId: workerNode.id,
            status: JobStatus.DISPATCHED,
          },
        });

        if (existingJob) {
          this.logger.log(
            `[WorkerService] Recovering existing job ${existingJob.id} for worker ${workerId}`
          );
          return existingJob;
        }

        // 2.1 Find one candidate PENDING job
        const capabilities = (workerNode.capabilities as any) || {};
        const supportedJobTypes = (capabilities.supportedJobTypes as string[]) || [];

        if (supportedJobTypes.length === 0) {
          this.logger.warn(`[WorkerService] Worker ${workerId} has no supportedJobTypes defined.`);
          return null;
        }

        console.log('[WORKER_CLAIM] supportedJobTypes=', supportedJobTypes);

        console.log(`[API_WORKER_NEXT_SVC] candidate job query start (supportedJobTypes=${supportedJobTypes.join(',')})`);

        // P4-A: Multi-Tier Weighted Round Robin (WRR) & Atomic Concurrency Limit check
        // 1. Fetch organizations with PENDING jobs
        const pendingOrgs = await tx.shotJob.groupBy({
          by: ['organizationId'],
          where: {
            status: JobStatus.PENDING,
            type: { in: supportedJobTypes as any },
          },
          _count: true,
        });

        if (pendingOrgs.length === 0) {
          return null;
        }

        const orgIds = pendingOrgs.map((o) => o.organizationId);

        // 2. Fetch Organization's owner's plan details
        const orgDetails = await tx.organization.findMany({
          where: { id: { in: orgIds } },
          select: {
            id: true,
            owner: {
              select: {
                UserSubscription: {
                  where: { status: 'ACTIVE' },
                  select: {
                    plan: {
                      select: { priorityWeight: true, burstConcurrencyLimit: true },
                    },
                  },
                },
              },
            },
          },
        });

        interface CandidateOrg {
          orgId: string;
          pendingCount: number;
          weight: number;
          maxConc: number;
        }

        let pool: CandidateOrg[] = orgDetails.map((org) => {
          const plan = org.owner?.UserSubscription?.plan;
          return {
            orgId: org.id,
            pendingCount: pendingOrgs.find((p) => p.organizationId === org.id)?._count || 0,
            weight: plan?.priorityWeight || 1,
            maxConc: plan?.burstConcurrencyLimit || 1,
          };
        });

        let selectedOrgId: string | null = null;

        // 3. Strict transactional WRR loop with pessimistic lock
        while (pool.length > 0) {
          // Quick dirty check to prune clearly loaded orgs and calculate effective weights
          const dirtyRunningCounts = await tx.shotJob.groupBy({
            by: ['organizationId'],
            where: {
              organizationId: { in: pool.map((p) => p.orgId) },
              status: { in: [JobStatus.DISPATCHED, JobStatus.RUNNING] },
            },
            _count: true,
          });

          let totalWeight = 0;
          for (const c of pool) {
            const rc = dirtyRunningCounts.find((r) => r.organizationId === c.orgId)?._count || 0;
            const remaining = Math.max(0, c.maxConc - rc);
            // Effective Weight = Priority * min(Queue Length, Remaining Capacity)
            const effectiveWeight = c.weight * Math.min(c.pendingCount, remaining);
            (c as any)._effectiveWeight = effectiveWeight;
            totalWeight += effectiveWeight;
          }

          if (totalWeight <= 0) {
            break; // all orgs throttled
          }

          // Weighted random pick
          let randomWeight = Math.random() * totalWeight;
          let candidateId = pool[0].orgId;
          for (const c of pool) {
            randomWeight -= (c as any)._effectiveWeight;
            if (randomWeight <= 0) {
              candidateId = c.orgId;
              break;
            }
          }

          // 4. ATOMIC CHECK: Pessimistic Row Lock (FOR UPDATE)
          // Prevents concurrent worker instances from double-dipping and breaching burstConcurrencyLimit
          await tx.$queryRaw`SELECT id FROM "organizations" WHERE id = ${candidateId} FOR UPDATE`;

          // Re-fetch absolutely verified running count inside lock
          const actualRunning = await tx.shotJob.count({
            where: {
              organizationId: candidateId,
              status: { in: [JobStatus.DISPATCHED, JobStatus.RUNNING] },
            },
          });

          const maxConc = pool.find((p) => p.orgId === candidateId)?.maxConc || 1;

          if (actualRunning < maxConc) {
            selectedOrgId = candidateId;
            break; // Lock acquired and validated. Proceed to dispatch.
          } else {
            // Burst limit breached in race condition. Prune from pool and retry WRR.
            pool = pool.filter((p) => p.orgId !== candidateId);
          }
        }

        if (!selectedOrgId) {
          return null; // Wait for concurrent jobs to finish
        }

        const candidate = await tx.shotJob.findFirst({
          where: {
            organizationId: selectedOrgId,
            status: JobStatus.PENDING,
            type: { in: supportedJobTypes as any },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        });

        if (!candidate) {
          console.log(`[WorkerService] DEBUG: No candidate job found for ${workerId}`);
          if (supportedJobTypes.includes('CE06_NOVEL_PARSING')) {
            console.log('[WORKER_CLAIM] no claimable CE06 job found');
          }
          return null;
        }

        console.log('[WORKER_CLAIM] claimed job=', candidate.id, candidate.type);

        console.log(`[API_WORKER_NEXT_SVC] candidate job query result=${candidate.id}`);
        console.log(`[API_WORKER_NEXT_SVC] lease/claim start...`);

        // 2.2 Atomic Update
        const updateResult = await tx.shotJob.updateMany({
          where: {
            id: candidate.id,
            status: JobStatus.PENDING,
          },
          data: {
            status: JobStatus.DISPATCHED,
            workerId: workerNode.id,
          },
        });

        console.log(`[API_WORKER_NEXT_SVC] lease/claim success (update count=${updateResult.count})`);

        if (updateResult.count === 0) {
          return null;
        }

        // P3-A: Dual State Machine Physical Binding - RESERVED
        try {
          await tx.billingLedger.create({
            data: {
              jobId: candidate.id,
              projectId: candidate.projectId,
              billingState: 'RESERVED',
              amount: 1n,
              idempotencyKey: `${candidate.id}_RESERVED`,
            },
          });
        } catch (e: any) {
          if (e.code === 'P2002') {
            this.logger.warn(
              `[WorkerService] Billing idempotency hit: ${candidate.id}_RESERVED already exists`
            );
          } else {
            throw e; // Abort transaction
          }
        }

        // 2.3 Fetch full job details with engine binding
        const jobWithBinding = await tx.shotJob.findUnique({
          where: { id: candidate.id },
          include: { engineBinding: { include: { engine: true } } },
        });

        // P1-GATE: [Strict] Dispatch-time Double Check
        // 如果开启了 PRODUCTION_MODE，但 Job 缺失有效绑定或绑定了非生产引擎，则标记为 FAILED 并阻断
        const { PRODUCTION_MODE: isProd } = await import('@scu/config');
        if (isProd) {
          const binding = jobWithBinding?.engineBinding;
          if (!binding) {
            this.logger.error(
              `[P1-GATE] Dispatch blocked for Job ${jobWithBinding?.id}: Missing EngineBinding in PRODUCTION.`
            );
            await tx.shotJob.update({
              where: { id: jobWithBinding?.id },
              data: {
                status: JobStatus.FAILED,
                lastError: `PRODUCTION_MODE_DISPATCH_BLOCK: Missing EngineBinding. Illegal DB injection detected.`,
              },
            });
            return null;
          }

          const engine = binding.engine;
          const engineKey = binding.engineKey;
          const isStub = !engine || engine.mode !== 'http';
          const isDefault =
            engineKey.startsWith('default_') || (engine && engine.code.startsWith('default_'));

          if (isStub || isDefault) {
            this.logger.error(
              `[P1-GATE] Dispatch blocked for Job ${jobWithBinding.id}: Engine ${engineKey} is not allowed in production.`
            );
            await tx.shotJob.update({
              where: { id: jobWithBinding.id },
              data: {
                status: JobStatus.FAILED,
                lastError: `PRODUCTION_MODE_DISPATCH_BLOCK: Engine ${engineKey} is non-production`,
              },
            });
            return null;
          }
        }

        return jobWithBinding;
      });

      if (!dispatchedJob) {
        return null;
      }

      // P6-2-2-1: Update dispatch history
      const currentHistory = this.dispatchHistory.get(workerId) || [];
      currentHistory.push(Date.now());
      this.dispatchHistory.set(workerId, currentHistory);

      // 结构化日志：JOB_CLAIMED
      this.logger.log(
        JSON.stringify({
          event: 'JOB_CLAIMED',
          jobId: dispatchedJob.id,
          workerId,
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
          workerId,
          nodeId: workerNode.id,
          jobType: dispatchedJob.type,
          taskId: dispatchedJob.taskId,
        },
      });

      return dispatchedJob;
    } catch (error) {
      console.log(`[API_WORKER_NEXT_SVC] EXCEPTION CAUGHT: ${(error as any)?.message}`);
      console.log(`[API_WORKER_NEXT_SVC] STACK: ${(error as any)?.stack}`);
      this.logger.error(
        `[WorkerService] dispatchNextJobForWorker CRITICAL ERROR: ${error}`,
        (error as any)?.stack
      );
      if (this.shouldFallbackToPg(error)) {
        this.logger.warn(
          `[WorkerService] dispatchNextJobForWorker degrading to pg fallback for ${workerId}: ${(error as any)?.message}`
        );
        return this.dispatchNextJobForWorkerViaPg(workerId);
      }
      throw error;
    }
  }

  private async hasPendingDispatchableJobsViaPg(workerId: string): Promise<boolean | null> {
    try {
      return this.withPgClient(async (client) => {
        const workerResult = await client.query(
          `
            SELECT capabilities
            FROM worker_nodes
            WHERE "workerId" = $1
            LIMIT 1
          `,
          [workerId]
        );

        const workerNode = workerResult.rows[0];
        if (!workerNode) {
          return false;
        }

        const capabilities = (workerNode.capabilities as any) || {};
        const supportedJobTypes = Array.isArray(capabilities.supportedJobTypes)
          ? capabilities.supportedJobTypes
          : [];

        if (supportedJobTypes.length === 0) {
          return false;
        }

        const pendingCountResult = await client.query(
          `
            SELECT COUNT(*)::int AS count
            FROM shot_jobs
            WHERE status = $1
              AND type = ANY($2::"JobType"[])
          `,
          [JobStatus.PENDING, supportedJobTypes]
        );

        return (pendingCountResult.rows[0]?.count ?? 0) > 0;
      });
    } catch (error: any) {
      this.logger.warn(
        `[WorkerService] PG preflight unavailable for ${workerId}, falling back to Prisma dispatch path: ${error.message}`
      );
      return null;
    }
  }

  private async dispatchNextJobForWorkerViaPg(workerId: string) {
    return this.withPgClient(async (client) => {
      await client.query('BEGIN');
      try {
      const workerResult = await client.query(
        `
          SELECT id, "workerId", status, capabilities
          FROM worker_nodes
          WHERE "workerId" = $1
          LIMIT 1
        `,
        [workerId]
      );

      const workerNode = workerResult.rows[0];
      if (!workerNode) {
        this.logger.warn(`[WorkerService] PG fallback: worker not found for dispatch: ${workerId}`);
        return null;
      }

      const now = Date.now();
      let history = this.dispatchHistory.get(workerId) || [];
      history = history.filter((t) => now - t < this.CASCADE_WINDOW);
      if (history.length >= this.CASCADE_LIMIT) {
        this.logger.warn(
          `[WorkerService] PG fallback throttling worker ${workerId} (${history.length}/${this.CASCADE_LIMIT})`
        );
        return null;
      }
      this.dispatchHistory.set(workerId, history);

      const capabilities = (workerNode.capabilities as any) || {};
      const supportedJobTypes = Array.isArray(capabilities.supportedJobTypes)
        ? capabilities.supportedJobTypes
        : [];

      if (supportedJobTypes.length === 0) {
        this.logger.warn(
          `[WorkerService] PG fallback: worker ${workerId} has no supportedJobTypes defined.`
        );
        return null;
      }

      const pendingCountResult = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM shot_jobs
          WHERE status = $1
            AND type = ANY($2::"JobType"[])
        `,
        [JobStatus.PENDING, supportedJobTypes]
      );

      const pendingCount = pendingCountResult.rows[0]?.count ?? 0;
      if (pendingCount === 0) {
        await client.query('COMMIT');
        return null;
      }

      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          `[WorkerService] PG fallback detected ${pendingCount} pending jobs for ${workerId}, but direct pg dispatch is disabled in production. Returning null.`
        );
        await client.query('COMMIT');
        return null;
      }

      const existingJobResult = await client.query(
        `
          SELECT id, type, payload, "taskId", "shotId", "projectId", "episodeId", "sceneId",
                 "organizationId", "traceId", "createdAt", status
          FROM shot_jobs
          WHERE "workerId" = $1
            AND status = $2
          ORDER BY "createdAt" ASC
          LIMIT 1
        `,
        [workerNode.id, JobStatus.DISPATCHED]
      );

      if (existingJobResult.rows[0]) {
        await client.query('COMMIT');
        return existingJobResult.rows[0];
      }

      const candidateResult = await client.query(
        `
          SELECT id, type, payload, "taskId", "shotId", "projectId", "episodeId", "sceneId",
                 "organizationId", "traceId", "createdAt", priority
          FROM shot_jobs
          WHERE status = $1
            AND type = ANY($2::"JobType"[])
          ORDER BY priority DESC, "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `,
        [JobStatus.PENDING, supportedJobTypes]
      );

      const candidate = candidateResult.rows[0];
      if (!candidate) {
        await client.query('COMMIT');
        return null;
      }

      const updateResult = await client.query(
        `
          UPDATE shot_jobs
          SET status = $2,
              "workerId" = $3,
              "updatedAt" = NOW()
          WHERE id = $1
            AND status = $4
          RETURNING id, type, payload, "taskId", "shotId", "projectId", "episodeId", "sceneId",
                    "organizationId", "traceId", "createdAt", status
        `,
        [candidate.id, JobStatus.DISPATCHED, workerNode.id, JobStatus.PENDING]
      );

      const claimed = updateResult.rows[0] ?? null;
      await client.query('COMMIT');
      if (claimed) {
        const currentHistory = this.dispatchHistory.get(workerId) || [];
        currentHistory.push(Date.now());
        this.dispatchHistory.set(workerId, currentHistory);
      }
      return claimed;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    });
  }
}
