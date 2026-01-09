/**
 * TaskGraphService
 * 任务依赖可视化服务，提供 Task → Job 的只读聚合查询
 *
 * 职责：
 * - 从 Task / ShotJob 表聚合出 Task → Job 关系图
 * - 提供只读查询接口，不修改任何数据
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TaskGraphJobNode {
  jobId: string;
  jobType: string;
  status: string;
  attempts: number;
  retryCount: number;
  maxRetry: number | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface TaskGraph {
  taskId: string;
  projectId: string;
  taskType: string;
  status: string;
  jobs: TaskGraphJobNode[];
}

@Injectable()
export class TaskGraphService {
  private readonly logger = new Logger(TaskGraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据 TaskId 查找 Task → Job 关系图
   * @param taskId Task ID
   * @returns TaskGraph 或 null
   */
  async findTaskGraph(taskId: string): Promise<TaskGraph | null> {
    // 1. 查询 Task 及其关联的 Jobs
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        jobs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      return null;
    }

    // 2. 构建 Job 节点列表
    // 注意：ShotJob 表中没有 startedAt 和 finishedAt 字段，使用 updatedAt 作为近似值
    const jobs: TaskGraphJobNode[] = task.jobs.map((job: any) => {
      // 如果 Job 状态是 SUCCEEDED 或 FAILED，使用 updatedAt 作为 finishedAt
      const finishedAt =
        job.status === 'SUCCEEDED' || job.status === 'FAILED' ? job.updatedAt : null;
      // 如果 Job 状态是 RUNNING 或已完成，使用 updatedAt 作为 startedAt 的近似值
      const startedAt =
        job.status === 'RUNNING' || job.status === 'SUCCEEDED' || job.status === 'FAILED'
          ? job.updatedAt
          : null;

      return {
        jobId: job.id,
        jobType: job.type,
        status: job.status,
        attempts: job.attempts || 0,
        retryCount: job.retryCount || 0,
        maxRetry: job.maxRetry || null,
        createdAt: job.createdAt.toISOString(),
        startedAt: startedAt ? startedAt.toISOString() : null,
        finishedAt: finishedAt ? finishedAt.toISOString() : null,
      };
    });

    // 3. 构建 TaskGraph
    return {
      taskId: task.id,
      projectId: task.projectId,
      taskType: task.type,
      status: task.status,
      jobs,
    };
  }
}
