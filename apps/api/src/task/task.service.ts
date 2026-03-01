import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Prisma, TaskType as TaskTypeEnum, TaskStatus as TaskStatusEnum } from 'database';

/**
 * Task Service
 * 平台级任务管理服务
 *
 * Task 定义：跨 Worker、跨重试、带业务语义的任务
 * 职责：包含任务类型、业务对象关联、重试策略、优先级等平台级元信息
 */
@Injectable()
export class TaskService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  /**
   * 创建 Task
   * @param params 任务创建参数
   * @returns 创建的 Task
   */
  async create(params: {
    organizationId: string;
    projectId: string;
    type: TaskTypeEnum;
    payload?: any; // Prisma.InputJsonValue 类型在 Prisma 5.22.0 中可能不存在
    status?: TaskStatusEnum;
    attempts?: number;
    maxRetry?: number;
    retryCount?: number;
    error?: string;
    traceId?: string; // Stage13-Final: Pipeline 级 traceId
  }) {
    const task = await this.prisma.task.create({
      data: {
        organizationId: params.organizationId,
        projectId: params.projectId,
        type: params.type,
        status: params.status ?? TaskStatusEnum.PENDING,
        payload: params.payload,
        attempts: params.attempts ?? 0,
        maxRetry: params.maxRetry ?? 3,
        retryCount: params.retryCount ?? 0,
        error: params.error,
        traceId: params.traceId, // Stage13-Final: Pipeline 级 traceId
      },
    });

    // 记录审计日志
    await this.auditLogService.record({
      action: 'TASK_CREATED',
      resourceType: 'task',
      resourceId: task.id,
      details: {
        type: task.type,
        organizationId: task.organizationId,
      },
    });

    return task;
  }

  /**
   * 根据 ID 查找 Task
   */
  async findById(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: { jobs: true },
    });
  }

  /**
   * 更新 Task 状态
   * S1-FIX-A: 新增 output 和 workerId 参数
   */
  async updateStatus(
    id: string,
    status: TaskStatusEnum,
    payload?: any,
    errorMessage?: string,
    output?: any,
    workerId?: string | null
  ) {
    return this.prisma.task.update({
      where: { id },
      data: {
        status,
        ...(payload !== undefined ? { payload } : {}),
        ...(errorMessage ? { error: errorMessage } : {}),
        ...(output !== undefined ? { output } : {}),
        ...(workerId !== undefined ? { workerId } : {}),
      },
    });
  }
}
