import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Prisma, TaskType as TaskTypeEnum, TaskStatus as TaskStatusEnum } from 'database';
import { randomUUID } from 'crypto';
const { Client } = require('pg');

/**
 * Task Service
 * 平台级任务管理服务
 *
 * Task 定义：跨 Worker、跨重试、带业务语义的任务
 * 职责：包含任务类型、业务对象关联、重试策略、优先级等平台级元信息
 */
@Injectable()
export class TaskService {
  private readonly prismaQueryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || 5000);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {
    console.log('[DEBUG_BOOT] TaskService constructor start');
    console.log('[DEBUG_BOOT] TaskService constructor end');
  }

  private isPrismaTimeout(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return message.includes('PRISMA_QUERY_TIMEOUT');
  }

  private async withPgClient<T>(fn: (client: InstanceType<typeof Client>) => Promise<T>): Promise<T> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL required for pg fallback');
    }

    const client = new Client({
      connectionString,
      statement_timeout: this.prismaQueryTimeoutMs,
      query_timeout: this.prismaQueryTimeoutMs,
    });

    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

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
    const createWithPg = async () =>
      this.withPgClient(async (client) => {
        const id = randomUUID();
        await client.query(
          `
            INSERT INTO "Task"
              (id, "organizationId", "projectId", type, status, payload, attempts, "maxRetry", "retryCount", error, "traceId", "updatedAt")
            VALUES
              ($1, $2, $3, $4::"TaskType", $5::"TaskStatus", $6::jsonb, $7, $8, $9, $10, $11, NOW())
            RETURNING id, "organizationId", "projectId", type, status
          `,
          [
            id,
            params.organizationId,
            params.projectId,
            params.type,
            params.status ?? TaskStatusEnum.PENDING,
            params.payload == null ? null : JSON.stringify(params.payload),
            params.attempts ?? 0,
            params.maxRetry ?? 3,
            params.retryCount ?? 0,
            params.error ?? null,
            params.traceId ?? null,
          ]
        );

        return {
          id,
          organizationId: params.organizationId,
          projectId: params.projectId,
          type: params.type,
          status: params.status ?? TaskStatusEnum.PENDING,
        };
      });

    let task;
    try {
      task = await this.prisma.task.create({
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
          traceId: params.traceId,
        },
      });
    } catch (error) {
      if (!this.isPrismaTimeout(error)) {
        throw error;
      }
      task = await createWithPg();
    }

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
