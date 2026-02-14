import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { JobWatchdogService } from './job-watchdog.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus } from 'database';

/**
 * A3任务：Job Watchdog 管理端点
 *
 * 提供运维接口：
 * - 手动触发Watchdog
 * - 查看卡住的任务
 * - 查看Watchdog统计信息
 *
 * @see docs/_evidence/A3_TASK_COMPLETION_REPORT.md
 */
@Controller('api/ops/job-watchdog')
export class JobWatchdogController {
  constructor(
    private readonly watchdogService: JobWatchdogService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * 手动触发Watchdog扫描（运维用）
   */
  @Post('trigger')
  async triggerWatchdog() {
    await this.watchdogService.recoverStuckJobs();
    return {
      success: true,
      message: 'Watchdog scan triggered manually',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 查看当前卡住的任务
   */
  @Get('stuck-jobs')
  async getStuckJobs() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const stuckJobs = await this.prisma.shotJob.findMany({
      where: {
        status: JobStatus.RUNNING,
        OR: [
          {
            updatedAt: {
              lt: oneHourAgo,
            },
          },
          {
            leaseUntil: {
              not: null,
              lt: now,
            },
          },
        ],
      },
      select: {
        id: true,
        type: true,
        status: true,
        workerId: true,
        retryCount: true,
        maxRetry: true,
        createdAt: true,
        updatedAt: true,
        leaseUntil: true,
        lastError: true,
        worker: {
          select: {
            workerId: true,
            lastHeartbeat: true,
            status: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'asc',
      },
      take: 50,
    });

    return {
      success: true,
      count: stuckJobs.length,
      jobs: stuckJobs.map((job) => ({
        ...job,
        stuckDuration: Math.floor((now.getTime() - job.updatedAt.getTime()) / 1000),
        leaseExpired: job.leaseUntil ? job.leaseUntil < now : false,
      })),
      timestamp: now.toISOString(),
    };
  }

  /**
   * 查看Watchdog统计信息
   */
  @Get('stats')
  async getWatchdogStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalRunning,
      stuckByUpdatedAt,
      stuckByLease,
      stuckBoth,
      recoveredLast24h,
      failedLast24h,
    ] = await Promise.all([
      // 总的RUNNING任务
      this.prisma.shotJob.count({
        where: { status: JobStatus.RUNNING },
      }),

      // 按updatedAt超时的
      this.prisma.shotJob.count({
        where: {
          status: JobStatus.RUNNING,
          updatedAt: { lt: oneHourAgo },
        },
      }),

      // 按lease超时的
      this.prisma.shotJob.count({
        where: {
          status: JobStatus.RUNNING,
          leaseUntil: {
            not: null,
            lt: now,
          },
        },
      }),

      // 两者都超时的
      this.prisma.shotJob.count({
        where: {
          status: JobStatus.RUNNING,
          updatedAt: { lt: oneHourAgo },
          leaseUntil: {
            not: null,
            lt: now,
          },
        },
      }),

      // 24小时内恢复的任务（从lastError判断）
      this.prisma.shotJob.count({
        where: {
          status: JobStatus.RETRYING,
          updatedAt: { gte: oneDayAgo },
          lastError: {
            contains: 'Job watchdog recovery',
          },
        },
      }),

      // 24小时内因watchdog失败的任务
      this.prisma.shotJob.count({
        where: {
          status: JobStatus.FAILED,
          updatedAt: { gte: oneDayAgo },
          lastError: {
            contains: 'Job watchdog: Max retries exceeded',
          },
        },
      }),
    ]);

    return {
      success: true,
      stats: {
        totalRunning,
        stuck: {
          byUpdatedAt: stuckByUpdatedAt,
          byLease: stuckByLease,
          both: stuckBoth,
          total: Math.max(stuckByUpdatedAt, stuckByLease), // 去重
        },
        last24h: {
          recovered: recoveredLast24h,
          failed: failedLast24h,
        },
      },
      timestamp: now.toISOString(),
    };
  }
}
