import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getP1Metrics() {
    // 1. Job Counts
    const counts = await this.prisma.shotJob.groupBy({
      by: ['status'],
      _count: true,
    });

    const metricsMap = counts.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      },
      {} as Record<string, number>
    );

    const terminalStates = ['SUCCEEDED', 'FAILED', 'CANCELED', 'CANCELLED'];
    const total = Object.values(metricsMap).reduce((a, b) => a + b, 0);
    const succeeded = metricsMap['SUCCEEDED'] || 0;
    const failed = metricsMap['FAILED'] || 0;
    const pending =
      total -
      Object.entries(metricsMap).reduce((sum, [status, count]) => {
        return terminalStates.includes(status) ? sum + count : sum;
      }, 0);

    // 2. Ledger Duplicates (Financial Idempotency)
    // Checks cost_ledgers for duplicate (jobId, attempt) pairs which would indicate double-billing.
    const ledgerDups = await this.prisma.$queryRaw<any[]>`
      SELECT "jobId", "attempt", COUNT(*) as count
      FROM "cost_ledgers"
      GROUP BY "jobId", "attempt"
      HAVING COUNT(*) > 1
    `;

    // 3. Latency (P95) - Audit Perspective (Rolling 24h)
    // We use a 24h window to ensure performance doesn't degrade as the DB grows.
    const p95LatencyResult = await this.prisma.$queryRaw<any[]>`
      SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY (EXTRACT(EPOCH FROM "updatedAt") - EXTRACT(EPOCH FROM "createdAt")) * 1000) as p95
      FROM "shot_jobs"
      WHERE "status" IN ('SUCCEEDED', 'FAILED')
        AND "updatedAt" > NOW() - INTERVAL '24 hours'
    `;
    const latency_p95_ms = Math.round(p95LatencyResult[0]?.p95 || 0);

    return {
      timestamp: Date.now(),
      metrics: {
        jobs_total: total,
        jobs_pending: pending,
        jobs_succeeded: succeeded,
        jobs_failed: failed,
        ledger_dups: ledgerDups.length,
        latency_p95_ms,
        window: '24h',
      },
    };
  }
}
