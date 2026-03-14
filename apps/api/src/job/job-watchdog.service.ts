import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus, JobType } from 'database';
import { env } from '@scu/config';

const JobStatusEnum = JobStatus;

/**
 * Job Watchdog Service
 * 定期扫描并恢复长期挂起的 RUNNING 状态任务
 */
@Injectable()
export class JobWatchdogService {
  private readonly logger = new Logger(JobWatchdogService.name);
  private readonly jobTimeoutMs: number;
  private readonly workerHeartbeatTimeoutMs: number;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    console.log('[DEBUG_BOOT] JobWatchdogService constructor start');
    // P2 修复：统一使用 packages/config 的配置
    this.jobTimeoutMs = (env as any).jobWatchdogTimeoutMs ?? 3600000;
    this.workerHeartbeatTimeoutMs = env.workerHeartbeatTimeoutMs || 30000;
    console.log('[DEBUG_BOOT] JobWatchdogService constructor end');
  }

  /**
   * 定期扫描并恢复僵尸任务
   * 每 5 分钟执行一次
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async recoverStuckJobs() {
    // P2 修复：统一使用 packages/config 的配置
    if ((env.jobWatchdogEnabled as any) === false) {
      return;
    }

    try {
      this.logger.debug('[JobWatchdog] Starting stuck job recovery scan...');

      const now = new Date();
      const jobTimeoutThreshold = new Date(now.getTime() - this.jobTimeoutMs);
      const workerTimeoutThreshold = new Date(now.getTime() - this.workerHeartbeatTimeoutMs);

      // 1. 查找长期 RUNNING 的 job（双重检查：updatedAt OR leaseUntil）
      // A3 增强：添加 leaseUntil 超时检查
      const stuckJobs = await this.prisma.shotJob.findMany({
        where: {
          status: JobStatusEnum.RUNNING,
          OR: [
            {
              // 检查1：超过超时时间未更新
              updatedAt: {
                lt: jobTimeoutThreshold,
              },
            },
            {
              // 检查2：lease 已过期（A3新增）
              leaseUntil: {
                not: null,
                lt: now,
              },
            },
          ],
        },
        include: {
          worker: true,
        },
        take: 100, // 每次最多处理 100 个
      });

      if (stuckJobs.length === 0) {
        this.logger.debug('[JobWatchdog] No stuck jobs found');
        return;
      }

      this.logger.warn(`[JobWatchdog] Found ${stuckJobs.length} stuck jobs, starting recovery...`);

      let recoveredCount = 0;
      let failedCount = 0;

      // P0 修复：使用事务防止竞态条件，确保原子性
      // P0 修复：计数改为"事务返回结果 → 事务外计数"，确保计数可靠
      for (const job of stuckJobs) {
        try {
          // 2. 在事务中检查并恢复 job（防止并发恢复）
          const result = await this.prisma.$transaction(async (tx) => {
            // 重新查询 job 状态（防止在循环期间状态已改变）
            const currentJob = await tx.shotJob.findUnique({
              where: { id: job.id },
              include: { worker: true },
            });

            if (!currentJob || currentJob.status !== JobStatusEnum.RUNNING) {
              // Job 状态已改变，跳过
              return { action: 'SKIP' as const };
            }

            // 检查 Worker 是否在线
            const workerIsOnline =
              currentJob.worker && currentJob.worker.lastHeartbeat >= workerTimeoutThreshold;

            // A3增强：提前判断租约与更新状态
            const isLeaseExpired = currentJob.leaseUntil && currentJob.leaseUntil < now;
            const isUpdateExpired = currentJob.updatedAt < jobTimeoutThreshold;

            if (workerIsOnline && !isLeaseExpired) {
              // Worker 在线且 lease 未过期，可能只是由于 jobTimeoutMs 设置较短导致的“误报”
              // 我们保持现状，不做强制干预
              this.logger.debug(
                `[JobWatchdog] Job ${currentJob.id} is pending recovery but worker ${currentJob.worker?.workerId} is online and lease is valid.`
              );
              return { action: 'ONLINE_SKIP' as const };
            }

            if (workerIsOnline && isLeaseExpired) {
              // A3 关键增强：Worker 虽然在线（有心跳），但任务租约已过期
              // 这通常意味着任务在 Worker 内部挂起或丢失，必须强制回收
              this.logger.warn(
                `[JobWatchdog] FORCED RECOVERY: Job ${currentJob.id} lease expired but worker ${currentJob.worker?.workerId} is still online. ` +
                `Marking as RETRYING to break the hang.`
              );
            }

            // 3. Worker 离线，恢复 job 到 RETRYING 状态（原子操作）
            const newRetryCount = currentJob.retryCount + 1;
            const shouldFail = newRetryCount >= currentJob.maxRetry;

            let timeoutReason = '';
            if (isLeaseExpired && isUpdateExpired) {
              timeoutReason = `lease expired (${currentJob.leaseUntil?.toISOString()}) and updatedAt timeout`;
            } else if (isLeaseExpired) {
              timeoutReason = `lease expired at ${currentJob.leaseUntil?.toISOString()}`;
            } else {
              timeoutReason = `updatedAt timeout (last update: ${currentJob.updatedAt.toISOString()})`;
            }

            await tx.shotJob.update({
              where: { id: currentJob.id },
              data: {
                status: shouldFail ? JobStatusEnum.FAILED : JobStatusEnum.RETRYING,
                workerId: null, // 解除 worker 绑定
                leaseUntil: null, // A3增强：清除过期的lease
                retryCount: newRetryCount,
                lastError: shouldFail
                  ? `Job watchdog: Max retries exceeded after worker offline (${timeoutReason})`
                  : `Job watchdog recovery: Worker ${currentJob.workerId} appears offline (${timeoutReason}, last heartbeat: ${currentJob.worker?.lastHeartbeat})`,
                updatedAt: now,
              },
            });

            if (shouldFail) {
              this.logger.warn(
                `[JobWatchdog] Job ${currentJob.id} marked as FAILED (max retries exceeded)`
              );
              return { action: 'FAILED' as const };
            } else {
              this.logger.log(
                `[JobWatchdog] Recovered job ${currentJob.id} from RUNNING to RETRYING (worker ${currentJob.workerId} offline)`
              );
              return { action: 'RECOVERED' as const };
            }
          });

          // P0 修复：事务外计数，确保计数可靠（只统计确实提交了状态变更的）
          if (result.action === 'RECOVERED' || result.action === 'FAILED') {
            recoveredCount++;
          }
        } catch (error) {
          failedCount++;
          // P0 修复：生产日志禁止输出 stack
          const isProd = process.env.NODE_ENV === 'production';
          if (isProd) {
            this.logger.error(
              `[JobWatchdog] Failed to recover job ${job.id}: ${error?.message || 'error'}`
            );
          } else {
            this.logger.error(
              `[JobWatchdog] Failed to recover job ${job.id}: ${error.message}`,
              error.stack
            );
          }
        }
      }

      this.logger.log(
        `[JobWatchdog] Recovery completed: ${recoveredCount} recovered, ${failedCount} failed`
      );
    } catch (error) {
      // P0 修复：生产日志禁止输出 stack
      const isProd = process.env.NODE_ENV === 'production';
      if (isProd) {
        this.logger.error(`[JobWatchdog] Error during recovery scan: ${error?.message || 'error'}`);
      } else {
        this.logger.error(
          `[JobWatchdog] Error during recovery scan: ${error.message}`,
          error.stack
        );
      }
    }
  }
}
