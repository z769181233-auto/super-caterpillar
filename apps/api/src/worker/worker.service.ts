import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly jobService: JobService, // S3-C.3: 注入 JobService 以使用统一的引擎信息提取方法
  ) {}

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
    userAgent?: string,
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
    _userAgent?: string,
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
        lastSeenAt: now,
        status: 'ALIVE',
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
    const { env } = await import('config');
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
    // Stage2-B: 使用 WorkerHeartbeat 模型检测超时
    // HEARTBEAT_TTL_SECONDS（默认 30 秒），超时阈值 = TTL * 3
    const HEARTBEAT_TTL_SECONDS = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
    const timeoutThreshold = new Date(Date.now() - HEARTBEAT_TTL_SECONDS * 3 * 1000);

    // 查找所有 lastSeenAt < now - TTL*3 的 WorkerHeartbeat，标记为 DEAD
    const deadHeartbeats = await this.prisma.workerHeartbeat.findMany({
      where: {
        lastSeenAt: {
          lt: timeoutThreshold,
        },
        status: {
          not: 'DEAD',
        },
      },
    });

    if (deadHeartbeats.length === 0) {
      return 0;
    }

    // 更新 WorkerHeartbeat 状态为 DEAD
    await this.prisma.workerHeartbeat.updateMany({
      where: {
        workerId: {
          in: deadHeartbeats.map((h) => h.workerId),
        },
        status: {
          not: 'DEAD',
        },
      },
      data: {
        status: 'DEAD',
      },
    });

    // 更新 WorkerNode 状态为 offline
    const workerIds = deadHeartbeats.map((h) => h.workerId);
    const workersToMarkOffline = await this.prisma.workerNode.findMany({
      where: {
        workerId: {
          in: workerIds,
        },
        status: {
          not: WorkerStatus.offline,
        },
      },
    });

    if (workersToMarkOffline.length === 0) {
      return 0;
    }

    const result = await this.prisma.workerNode.updateMany({
      where: {
        workerId: {
          in: workerIds,
        },
        status: {
          not: WorkerStatus.offline,
        },
      },
      data: {
        status: WorkerStatus.offline, // Dead = offline（心跳超时）
      },
    });

    // 记录结构化日志：Worker 被标记为 offline
    // 参考《平台日志监控与可观测性体系说明书_ObservabilityMonitoringSpec_V1.0》：结构化日志格式
    for (const worker of workersToMarkOffline) {
      this.logger.warn(
        JSON.stringify({
          event: 'WORKER_MARKED_OFFLINE',
          workerId: worker.workerId,
          statusBefore: worker.status,
          statusAfter: 'offline',
          lastSeenAt: deadHeartbeats.find((h) => h.workerId === worker.workerId)?.lastSeenAt.toISOString(),
          timeoutThreshold: timeoutThreshold.toISOString(),
          reason: 'heartbeat_timeout',
          timestamp: new Date().toISOString(),
        }),
      );
    }

    return result.count;
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
    const { env } = await import('config');
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
    const { env } = await import('config');
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

}

