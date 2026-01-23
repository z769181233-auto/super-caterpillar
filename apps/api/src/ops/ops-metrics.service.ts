import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * EXEC-P11-1.1: Ops 指标聚合服务 (只读)
 */
@Injectable()
export class OpsMetricsService {
  private readonly logger = new Logger(OpsMetricsService.name);

  constructor(private readonly prisma: PrismaService) { }

  async getProductionMetrics() {
    const now = new Date();
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Job Success Rate (Last 15m)
    const recentJobs = await this.prisma.shotJob.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: fifteenMinsAgo },
      },
      _count: true,
    });

    const totalRecent = recentJobs.reduce((acc, cr) => acc + cr._count, 0);
    const succeededRecent = recentJobs.find((r) => r.status === 'SUCCEEDED')?._count || 0;
    const job_success_rate_15m = totalRecent > 0 ? (succeededRecent / totalRecent) * 100 : 100;

    // 2. Job Counts by Type (Last 24h)
    const jobCountsByType = await this.prisma.shotJob.groupBy({
      by: ['type'],
      where: { createdAt: { gte: twentyFourHoursAgo } },
      _count: true,
    });
    const job_counts_by_type = jobCountsByType.reduce(
      (acc, curr) => {
        acc[curr.type] = curr._count;
        return acc;
      },
      {} as Record<string, number>
    );

    // 3. Queue Depth & Oldest Pending
    const queueDepth = await this.prisma.shotJob.count({
      where: { status: { in: ['PENDING', 'DISPATCHED'] } },
    });

    const oldestPendingJob = await this.prisma.shotJob.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    const oldest_pending_age_ms = oldestPendingJob
      ? now.getTime() - oldestPendingJob.createdAt.getTime()
      : 0;

    // 4. Cost and Published (Simplified proxy)
    const costByEngine = await this.prisma.jobEngineBinding.groupBy({
      by: ['engineKey'],
      where: {
        status: 'COMPLETED',
        completedAt: { gte: twentyFourHoursAgo },
      },
      _count: true, // Placeholder for real credits if not in schema
    });

    const publishedCount = await this.prisma.publishedVideo.count({
      where: { createdAt: { gte: twentyFourHoursAgo } },
    });

    // 5. Rework Statistics (Last 1h)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const qualityScores = await this.prisma.qualityScore.findMany({
      where: { createdAt: { gte: oneHourAgo } },
      select: { verdict: true, signals: true },
    });

    const reworkStats = {
      total_evaluations_1h: qualityScores.length,
      total_fails_1h: qualityScores.filter((s) => s.verdict === 'FAIL').length,
      blocked_by_budget_1h: 0,
      blocked_by_max_attempt_1h: 0,
      idempotency_hit_1h: 0,
    };

    qualityScores.forEach((s) => {
      const stopReason = (s.signals as any)?.stopReason;
      if (stopReason === 'BUDGET_GUARD_BLOCKED') reworkStats.blocked_by_budget_1h++;
      if (stopReason === 'MAX_ATTEMPT_REACHED') reworkStats.blocked_by_max_attempt_1h++;
      if (stopReason === 'IDEMPOTENCY_HIT') reworkStats.idempotency_hit_1h++;
    });

    const rework_rate_1h =
      qualityScores.length > 0 ? (reworkStats.total_fails_1h / qualityScores.length) * 100 : 0;

    return {
      job_success_rate_15m: Number(job_success_rate_15m.toFixed(2)),
      job_counts_by_type,
      queue_depth: queueDepth,
      oldest_pending_age_ms,
      published_assets_24h: publishedCount,
      rework_statistics_1h: {
        ...reworkStats,
        rework_rate_1h: Number(rework_rate_1h.toFixed(2)),
      },
      cost_by_engineKey_24h: costByEngine.reduce(
        (acc, curr) => {
          acc[curr.engineKey] = curr._count; // Assuming 1 job = 1 unit for now
          return acc;
        },
        {} as Record<string, number>
      ),
      timestamp: now.toISOString(),
    };
  }
}
