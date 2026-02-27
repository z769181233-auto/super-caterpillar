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

/**
 * Worker 管理服务
 * 负责 Worker 注册、心跳、状态管理
 */
@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

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
    // 查找或创建 WorkerNode
    let worker = await this.prisma.workerNode.findUnique({
      where: { workerId },
    });

    if (worker) {
      // 更新现有 Worker
      worker = await this.prisma.workerNode.update({
        where: { workerId },
        data: {
          status: WorkerStatus.online,
          capabilities: capabilities as any,
          gpuCount,
          gpuMemory,
          gpuType,
          lastHeartbeat: new Date(),
        },
      });
    } else {
      // 创建新 Worker
      worker = await this.prisma.workerNode.create({
        data: {
          workerId,
          status: WorkerStatus.online,
          capabilities: capabilities as any,
          gpuCount,
          gpuMemory,
          gpuType,
          lastHeartbeat: new Date(),
        },
      });
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
    const worker = await this.prisma.workerNode.findUnique({
      where: { workerId },
    });

    if (!worker) {
      throw new NotFoundException(`Worker ${workerId} not found`);
    }

    // Stage2-B: 使用 WorkerHeartbeat 模型 upsert 心跳记录
    const now = new Date();
    await this.prisma.workerHeartbeat.upsert({
      where: { workerId },
      create: {
        workerId,
        lastSeenAt: now,
        status: 'ALIVE',
      },
      update: {
        // SSOT 单入口:heartbeat 只更新时间戳,禁止把 DEAD 直接改回 ALIVE
        lastSeenAt: now,
      },
    });

    // 查询该 Worker 的 RUNNING Job 数量（用于状态判断和 tasksRunning 更新）
    const runningJobCount = await this.prisma.shotJob.count({
      where: {
        workerId: worker.id,
        status: JobStatus.RUNNING,
      },
    });

    const updateData: any = {
      lastHeartbeat: now,
    };

    // 如果 Worker 没有显式传递 status，根据当前 RUNNING Job 数量自动判断状态
    // 参考调度系统设计书 §3.3：Worker 状态判断（Idle/Busy/Dead）
    if (status) {
      updateData.status = status;
    } else {
      // 自动判断状态：根据当前 RUNNING Job 数量
      const actualTasksRunning = tasksRunning !== undefined ? tasksRunning : runningJobCount;

      if (actualTasksRunning > 0) {
        updateData.status = WorkerStatus.busy;
      } else {
        // 如果 Worker 在线且没有运行任务，标记为 idle
        // 注意：online 状态是基础状态，idle/busy 是运行时状态
        // 如果当前是 offline，保持 offline；否则设置为 idle
        if (worker.status === WorkerStatus.offline) {
          updateData.status = WorkerStatus.offline;
        } else {
          updateData.status = WorkerStatus.idle;
        }
      }
    }

    if (tasksRunning !== undefined) {
      updateData.tasksRunning = tasksRunning;
    } else {
      // 如果没有传递 tasksRunning，使用实际 RUNNING Job 数量
      updateData.tasksRunning = runningJobCount;
    }

    if (temperature !== undefined) {
      updateData.temperature = temperature;
    }

    const updatedWorker = await this.prisma.workerNode.update({
      where: { workerId },
      data: updateData,
    });

    return updatedWorker;
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
    console.log(`[XXX_DEBUG] WorkerService.dispatchNextJobForWorker called for ${workerId}`);
    // 1. Resolve WorkerNode (String -> UUID)
    try {
      const workerNode = await this.prisma.workerNode.findUnique({
        where: { workerId },
        include: { shotJobs: { where: { status: JobStatus.RUNNING } } },
      });

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

        console.log(`[WorkerService] DEBUG: Searching PENDING jobs for ${workerId}. Types: ${supportedJobTypes.join(',')}`);

        // DEBUG: Count pending jobs of these types
        const pendingCount = await tx.shotJob.count({
          where: {
            status: JobStatus.PENDING,
            type: { in: supportedJobTypes as any },
          }
        });
        console.log(`[WorkerService] DEBUG_X: Found ${pendingCount} PENDING jobs matching worker types ${supportedJobTypes.join(',')}`);

        const candidate = await tx.shotJob.findFirst({
          where: {
            status: JobStatus.PENDING,
            type: { in: supportedJobTypes as any },
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' },
          ],
          take: 1,
        });

        if (!candidate) {
          console.log(`[WorkerService] DEBUG: No candidate job found for ${workerId}`);
          return null;
        }

        console.log(`[WorkerService] DEBUG: Found candidate job ${candidate.id} (${candidate.type}). Attempting atomic update.`);

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

        console.log(`[WorkerService] DEBUG: Atomic update result count: ${updateResult.count}`);

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
            }
          });
        } catch (e: any) {
          if (e.code === 'P2002') {
            this.logger.warn(`[WorkerService] Billing idempotency hit: ${candidate.id}_RESERVED already exists`);
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
            this.logger.error(`[P1-GATE] Dispatch blocked for Job ${jobWithBinding?.id}: Missing EngineBinding in PRODUCTION.`);
            await tx.shotJob.update({
              where: { id: jobWithBinding?.id },
              data: {
                status: JobStatus.FAILED,
                lastError: `PRODUCTION_MODE_DISPATCH_BLOCK: Missing EngineBinding. Illegal DB injection detected.`,
              }
            });
            return null;
          }

          const engine = binding.engine;
          const engineKey = binding.engineKey;
          const isStub = !engine || engine.mode !== 'http';
          const isDefault = engineKey.startsWith('default_') || (engine && engine.code.startsWith('default_'));

          if (isStub || isDefault) {
            this.logger.error(`[P1-GATE] Dispatch blocked for Job ${jobWithBinding.id}: Engine ${engineKey} is not allowed in production.`);
            await tx.shotJob.update({
              where: { id: jobWithBinding.id },
              data: {
                status: JobStatus.FAILED,
                lastError: `PRODUCTION_MODE_DISPATCH_BLOCK: Engine ${engineKey} is stub/mock/default`
              }
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
      this.logger.error(
        `[WorkerService] dispatchNextJobForWorker CRITICAL ERROR: ${error}`,
        (error as any)?.stack
      );
      throw error;
    }
  }
}
