import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'database';
import { JobStatus, JobType } from 'database';
const { Client } = require('pg');

const JobStatusEnum = JobStatus;
const JobTypeEnum = JobType;

export interface CapacityCheckResult {
  allowed: boolean;
  reason?: string;
  errorCode?: string;
  currentCount?: number;
  limit?: number;
}

/**
 * 容量门禁服务
 * 负责检查用户/租户的并发渲染上限、队列积压阈值等
 */
@Injectable()
export class CapacityGateService {
  private readonly logger = new Logger(CapacityGateService.name);
  private readonly prismaQueryTimeoutMs = Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000');

  // 配置项（可从环境变量读取）
  private readonly MAX_CONCURRENT_VIDEO_RENDER = parseInt(
    process.env.MAX_CONCURRENT_VIDEO_RENDER || '10',
    10
  );
  private readonly MAX_PENDING_JOBS = parseInt(process.env.MAX_PENDING_JOBS || '100', 10);
  private readonly MAX_PENDING_VIDEO_RENDER = parseInt(
    process.env.MAX_PENDING_VIDEO_RENDER || '50',
    10
  );

  constructor(private readonly prisma: PrismaService) {}

  private isPrismaTimeout(error: any): boolean {
    const message = String(error?.message || '');
    return (
      message.includes('PRISMA_QUERY_TIMEOUT') ||
      message.includes(`exceeded ${this.prismaQueryTimeoutMs}ms`) ||
      error?.code === 'P1001'
    );
  }

  private async withPgClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for pg fallback');
    }

    const client = new Client({
      connectionString: databaseUrl,
      statement_timeout: this.prismaQueryTimeoutMs,
      query_timeout: this.prismaQueryTimeoutMs,
    });

    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async countJobsViaPg(
    organizationId: string,
    clauses: Array<string>,
    values: Array<any>
  ): Promise<number> {
    return this.withPgClient(async (client) => {
      const whereSql = ['\"organizationId\" = $1', ...clauses].join(' AND ');
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM "shot_jobs" WHERE ${whereSql}`,
        [organizationId, ...values]
      );
      return Number(result.rows?.[0]?.count || 0);
    });
  }

  private async getCapacityUsageViaPg(organizationId: string): Promise<{
    videoRender: { inProgress: number; pending: number; limit: number; pendingLimit: number };
    total: { pending: number; limit: number };
  }> {
    const videoRenderType = String(JobTypeEnum.VIDEO_RENDER);
    const pendingStatus = String(JobStatusEnum.PENDING);
    const dispatchedStatus = String(JobStatusEnum.DISPATCHED);
    const runningStatus = String(JobStatusEnum.RUNNING);

    const [inProgress, pending, totalPending] = await Promise.all([
      this.countJobsViaPg(
        organizationId,
        [
          '"type"::text = $2',
          '"status"::text = ANY($3::text[])',
        ],
        [videoRenderType, [pendingStatus, dispatchedStatus, runningStatus]]
      ),
      this.countJobsViaPg(
        organizationId,
        ['"type"::text = $2', '"status"::text = $3'],
        [videoRenderType, pendingStatus]
      ),
      this.countJobsViaPg(organizationId, ['"status"::text = $2'], [pendingStatus]),
    ]);

    return {
      videoRender: {
        inProgress,
        pending,
        limit: this.MAX_CONCURRENT_VIDEO_RENDER,
        pendingLimit: this.MAX_PENDING_VIDEO_RENDER,
      },
      total: {
        pending: totalPending,
        limit: this.MAX_PENDING_JOBS,
      },
    };
  }

  /**
   * 检查是否可以创建新的 VIDEO_RENDER job
   * @param organizationId 组织ID
   * @param userId 用户ID（可选，用于用户级限制）
   * @param tx 可选的事务客户端（用于在事务中检查，防止竞态条件）
   */
  async checkVideoRenderCapacity(
    organizationId: string,
    userId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<CapacityCheckResult> {
    // Feature Flag: 容量门禁开关
    if (process.env.CAPACITY_GATE_ENABLED === 'false') {
      this.logger.debug('[CapacityGate] Capacity gate disabled by feature flag');
      return { allowed: true };
    }

    try {
      // 使用传入的事务客户端或默认的 prisma 客户端
      const client = tx || this.prisma;

      // 1. 检查并发中的 VIDEO_RENDER jobs
      const inProgressCount = await client.shotJob.count({
        where: {
          organizationId,
          type: JobTypeEnum.VIDEO_RENDER,
          status: {
            in: [JobStatusEnum.PENDING, JobStatusEnum.DISPATCHED, JobStatusEnum.RUNNING],
          },
        },
      });

      if (inProgressCount >= this.MAX_CONCURRENT_VIDEO_RENDER) {
        return {
          allowed: false,
          reason: `已达到并发渲染上限 (${inProgressCount}/${this.MAX_CONCURRENT_VIDEO_RENDER})`,
          errorCode: 'CAPACITY_EXCEEDED_CONCURRENT',
          currentCount: inProgressCount,
          limit: this.MAX_CONCURRENT_VIDEO_RENDER,
        };
      }

      // 2. 检查队列积压（pending jobs）
      const pendingCount = await client.shotJob.count({
        where: {
          organizationId,
          type: JobTypeEnum.VIDEO_RENDER,
          status: JobStatusEnum.PENDING,
        },
      });

      if (pendingCount >= this.MAX_PENDING_VIDEO_RENDER) {
        return {
          allowed: false,
          reason: `队列积压过多 (${pendingCount}/${this.MAX_PENDING_VIDEO_RENDER})`,
          errorCode: 'CAPACITY_EXCEEDED_QUEUE',
          currentCount: pendingCount,
          limit: this.MAX_PENDING_VIDEO_RENDER,
        };
      }

      // 3. 检查总 pending jobs（所有类型）
      const totalPendingCount = await client.shotJob.count({
        where: {
          organizationId,
          status: JobStatusEnum.PENDING,
        },
      });

      if (totalPendingCount >= this.MAX_PENDING_JOBS) {
        return {
          allowed: false,
          reason: `总队列积压过多 (${totalPendingCount}/${this.MAX_PENDING_JOBS})`,
          errorCode: 'CAPACITY_EXCEEDED_TOTAL_QUEUE',
          currentCount: totalPendingCount,
          limit: this.MAX_PENDING_JOBS,
        };
      }

      // 4. 用户级限制（如果提供了 userId）
      if (userId) {
        const userInProgressCount = await client.shotJob.count({
          where: {
            organizationId,
            type: JobTypeEnum.VIDEO_RENDER,
            status: {
              in: [JobStatusEnum.PENDING, JobStatusEnum.DISPATCHED, JobStatusEnum.RUNNING],
            },
            // 注意：ShotJob 没有直接的 userId 字段，需要通过关联查询
            // 这里简化处理，实际可能需要通过 Task 或其他关联查询
          },
        });

        // 用户级限制（可配置，默认与组织级相同）
        const userMaxConcurrent = parseInt(
          process.env.MAX_USER_CONCURRENT_VIDEO_RENDER || String(this.MAX_CONCURRENT_VIDEO_RENDER),
          10
        );

        if (userInProgressCount >= userMaxConcurrent) {
          return {
            allowed: false,
            reason: `用户并发渲染上限 (${userInProgressCount}/${userMaxConcurrent})`,
            errorCode: 'CAPACITY_EXCEEDED_USER_CONCURRENT',
            currentCount: userInProgressCount,
            limit: userMaxConcurrent,
          };
        }
      }

      return {
        allowed: true,
        currentCount: inProgressCount,
        limit: this.MAX_CONCURRENT_VIDEO_RENDER,
      };
    } catch (error) {
      this.logger.error(`[CapacityGate] Error checking capacity: ${error.message}`, error.stack);
      // 容错：如果检查失败，允许创建（避免阻塞正常流程）
      return {
        allowed: true,
        reason: 'Capacity check failed, allowing by default',
      };
    }
  }

  /**
   * 检查是否可以创建指定类型的 job
   * @param jobType Job 类型
   * @param organizationId 组织ID
   * @param userId 用户ID（可选）
   */
  async checkJobCapacity(
    jobType: JobType,
    organizationId: string,
    userId?: string
  ): Promise<CapacityCheckResult> {
    if (jobType === JobTypeEnum.VIDEO_RENDER) {
      return this.checkVideoRenderCapacity(organizationId, userId);
    }

    // 其他类型的 job 使用通用检查
    const totalPendingCount = await this.prisma.shotJob.count({
      where: {
        organizationId,
        status: JobStatusEnum.PENDING,
      },
    });

    if (totalPendingCount >= this.MAX_PENDING_JOBS) {
      return {
        allowed: false,
        reason: `总队列积压过多 (${totalPendingCount}/${this.MAX_PENDING_JOBS})`,
        errorCode: 'CAPACITY_EXCEEDED_TOTAL_QUEUE',
        currentCount: totalPendingCount,
        limit: this.MAX_PENDING_JOBS,
      };
    }

    return { allowed: true };
  }

  /**
   * 获取容量使用情况（用于监控和前端显示）
   */
  async getCapacityUsage(organizationId: string): Promise<{
    videoRender: {
      inProgress: number;
      pending: number;
      limit: number;
      pendingLimit: number;
    };
    total: {
      pending: number;
      limit: number;
    };
  }> {
    try {
      const [inProgress, pending, totalPending] = await Promise.all([
        this.prisma.shotJob.count({
          where: {
            organizationId,
            type: JobTypeEnum.VIDEO_RENDER,
            status: {
              in: [JobStatusEnum.PENDING, JobStatusEnum.DISPATCHED, JobStatusEnum.RUNNING],
            },
          },
        }),
        this.prisma.shotJob.count({
          where: {
            organizationId,
            type: JobTypeEnum.VIDEO_RENDER,
            status: JobStatusEnum.PENDING,
          },
        }),
        this.prisma.shotJob.count({
          where: {
            organizationId,
            status: JobStatusEnum.PENDING,
          },
        }),
      ]);

      return {
        videoRender: {
          inProgress,
          pending,
          limit: this.MAX_CONCURRENT_VIDEO_RENDER,
          pendingLimit: this.MAX_PENDING_VIDEO_RENDER,
        },
        total: {
          pending: totalPending,
          limit: this.MAX_PENDING_JOBS,
        },
      };
    } catch (error: any) {
      if (!this.isPrismaTimeout(error)) {
        throw error;
      }

      this.logger.warn(
        `[CapacityGate] Prisma getCapacityUsage degraded for ${organizationId}, using pg fallback: ${error.message}`
      );
      return this.getCapacityUsageViaPg(organizationId);
    }
  }
}
