/**
 * EngineTaskService
 * 引擎任务视图服务，提供 Task → EngineTask 的只读聚合查询
 *
 * 职责：
 * - 从 Task / ShotJob 表聚合出 EngineTask 视图
 * - 解析 engineKey 和 adapterName
 * - 提供只读查询接口，不修改任何数据
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineTaskSummary, EngineJobSummary, EngineExecutionStatus } from '@scu/shared-types';
import { JobType as JobTypeEnum, JobStatus as JobStatusEnum } from 'database';

@Injectable()
export class EngineTaskService {
  private readonly logger = new Logger(EngineTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineRegistry: EngineRegistry
  ) {
    console.log('[DEBUG_BOOT] EngineTaskService constructor start');
    console.log('[DEBUG_BOOT] EngineTaskService constructor end');
  }

  /**
   * 根据 TaskId 查找 EngineTaskSummary
   * @param taskId Task ID
   * @returns EngineTaskSummary 或 null
   */
  async findEngineTaskByTaskId(taskId: string): Promise<EngineTaskSummary | null> {
    // 1. 查询 Task 及其关联的 Jobs
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        jobs: {
          where: {
            type: JobTypeEnum.NOVEL_ANALYSIS, // 只查询 NOVEL_ANALYSIS 类型的 Job
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      return null;
    }

    // 2. 如果没有关联的 NOVEL_ANALYSIS Job，返回 null
    if (!task.jobs || task.jobs.length === 0) {
      this.logger.debug(`Task ${taskId} has no NOVEL_ANALYSIS jobs`);
      return null;
    }

    // 3. 解析 engineKey
    const engineKey = this.extractEngineKey(task, task.jobs[0]);

    // 4. 解析 adapterName
    const adapterName = this.extractAdapterName(engineKey, task.type);

    // 5. 构建 Job 摘要列表
    const jobs: EngineJobSummary[] = task.jobs.map((job: any) => this.mapJobToSummary(job));

    // 6. 构建 EngineTaskSummary
    return {
      taskId: task.id,
      projectId: task.projectId,
      taskType: task.type,
      status: task.status,
      engineKey,
      adapterName,
      jobs,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  /**
   * 根据 ProjectId 查找 EngineTaskSummary 列表
   * @param projectId Project ID
   * @param taskType 任务类型（可选，如 'NOVEL_ANALYSIS'）
   * @returns EngineTaskSummary[]
   */
  async findEngineTasksByProject(
    projectId: string,
    taskType?: string
  ): Promise<EngineTaskSummary[]> {
    // 1. 构建查询条件
    const where: any = {
      projectId,
    };

    if (taskType) {
      where.type = taskType;
    }

    // 2. 查询所有符合条件的 Task
    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        jobs: {
          where: {
            type: JobTypeEnum.NOVEL_ANALYSIS,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. 过滤出有 NOVEL_ANALYSIS Job 的 Task，并转换为 EngineTaskSummary
    const engineTasks: EngineTaskSummary[] = [];

    for (const task of tasks) {
      if (!task.jobs || task.jobs.length === 0) {
        continue; // 跳过没有 NOVEL_ANALYSIS Job 的 Task
      }

      // 解析 engineKey
      const engineKey = this.extractEngineKey(task, task.jobs[0]);

      // 解析 adapterName
      const adapterName = this.extractAdapterName(engineKey, task.type);

      // 构建 Job 摘要列表
      const jobs: EngineJobSummary[] = task.jobs.map((job: any) => this.mapJobToSummary(job));

      // 构建 EngineTaskSummary
      engineTasks.push({
        taskId: task.id,
        projectId: task.projectId,
        taskType: task.type,
        status: task.status,
        engineKey,
        adapterName,
        jobs,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      });
    }

    return engineTasks;
  }

  /**
   * 从 Task 和 Job 中提取 engineKey
   * 优先级：
   * 1. Job.payload.engineKey
   * 2. Task.payload.engineKey
   * 3. EngineRegistry.getDefaultEngineKeyForJobType(taskType)
   */
  private extractEngineKey(task: any, job: any): string {
    // 1. 优先从 Job.payload 读取
    if (job?.payload && typeof job.payload === 'object') {
      const jobPayload = job.payload as any;
      if (jobPayload.engineKey && typeof jobPayload.engineKey === 'string') {
        return jobPayload.engineKey;
      }
    }

    // 2. 从 Task.payload 读取
    if (task?.payload && typeof task.payload === 'object') {
      const taskPayload = task.payload as any;
      if (taskPayload.engineKey && typeof taskPayload.engineKey === 'string') {
        return taskPayload.engineKey;
      }
    }

    // 3. 使用 EngineRegistry 的默认映射
    // 注意：EngineRegistry.getDefaultEngineKeyForJobType 是 private，需要通过 findAdapter 间接获取
    // 但我们可以根据已知的映射规则直接返回
    const defaultKey = this.getDefaultEngineKeyForTaskType(task.type);
    if (defaultKey) {
      return defaultKey;
    }

    // 4. 降级：使用全局默认引擎
    return 'default_novel_analysis';
  }

  /**
   * 根据 TaskType 获取默认引擎标识
   * 注意：TaskType 和 JobType 在 NOVEL_ANALYSIS 场景下是一致的
   * 这里直接使用已知的映射关系，与 EngineRegistry 保持一致
   */
  private getDefaultEngineKeyForTaskType(taskType: string): string | null {
    // TaskType 和 JobType 的映射关系（与 EngineRegistry.getDefaultEngineKeyForJobType 保持一致）
    const taskTypeToEngineKey: Record<string, string> = {
      NOVEL_ANALYSIS: 'default_novel_analysis',
      SHOT_RENDER: 'default_shot_render',
    };

    return taskTypeToEngineKey[taskType] || null;
  }

  /**
   * 从 engineKey 提取 adapterName
   * 通过 EngineRegistry 查找对应的 adapter
   */
  private extractAdapterName(engineKey: string, taskType: string): string {
    try {
      // 1. 尝试通过 EngineRegistry 查找 adapter
      const adapter = this.engineRegistry.getAdapter(engineKey);
      if (adapter) {
        return adapter.name;
      }

      // 2. 如果找不到，尝试通过 findAdapter 查找（会回退到默认）
      const foundAdapter = this.engineRegistry.findAdapter(engineKey, taskType);
      if (foundAdapter) {
        return foundAdapter.name;
      }

      // 3. 降级：使用 engineKey 作为 adapterName
      this.logger.warn(
        `Adapter not found for engineKey: ${engineKey}, using engineKey as adapterName`
      );
      return engineKey;
    } catch (error) {
      // 4. 异常降级：使用 engineKey
      this.logger.warn(
        `Error finding adapter for engineKey: ${engineKey}, using engineKey as adapterName`,
        error
      );
      return engineKey;
    }
  }

  /**
   * 将 ShotJob 映射为 EngineJobSummary
   */
  private mapJobToSummary(job: any): EngineJobSummary {
    // 映射 JobStatus 到 EngineExecutionStatus
    const statusMap: Record<string, EngineExecutionStatus> = {
      PENDING: 'PENDING',
      RUNNING: 'RUNNING',
      SUCCEEDED: 'SUCCEEDED',
      FAILED: 'FAILED',
      RETRYING: 'RETRYING',
    };

    const status = statusMap[job.status] || 'PENDING';

    return {
      id: job.id,
      jobType: job.type,
      status,
      attempts: job.attempts || 0,
      retryCount: job.retryCount || 0,
      maxRetry: job.maxRetry || null,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
    };
  }
}
