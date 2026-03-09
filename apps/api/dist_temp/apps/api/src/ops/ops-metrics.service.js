"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OpsMetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpsMetricsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let OpsMetricsService = OpsMetricsService_1 = class OpsMetricsService {
    prisma;
    logger = new common_1.Logger(OpsMetricsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProductionMetrics() {
        const now = new Date();
        const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
        const jobCountsByType = await this.prisma.shotJob.groupBy({
            by: ['type'],
            where: { createdAt: { gte: twentyFourHoursAgo } },
            _count: true,
        });
        const job_counts_by_type = jobCountsByType.reduce((acc, curr) => {
            acc[curr.type] = curr._count;
            return acc;
        }, {});
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
        const costByEngine = await this.prisma.jobEngineBinding.groupBy({
            by: ['engineKey'],
            where: {
                status: 'COMPLETED',
                completedAt: { gte: twentyFourHoursAgo },
            },
            _count: true,
        });
        const publishedCount = await this.prisma.publishedVideo.count({
            where: { createdAt: { gte: twentyFourHoursAgo } },
        });
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
            blocked_by_rate_limit_1h: 0,
        };
        qualityScores.forEach((s) => {
            const stopReason = s.signals?.stopReason;
            if (stopReason === 'BUDGET_GUARD_BLOCKED')
                reworkStats.blocked_by_budget_1h++;
            if (stopReason === 'MAX_ATTEMPT_REACHED')
                reworkStats.blocked_by_max_attempt_1h++;
            if (stopReason === 'IDEMPOTENCY_HIT')
                reworkStats.idempotency_hit_1h++;
            if (stopReason === 'RATE_LIMIT_BLOCKED')
                reworkStats.blocked_by_rate_limit_1h++;
        });
        const rework_rate_1h = qualityScores.length > 0 ? (reworkStats.total_fails_1h / qualityScores.length) * 100 : 0;
        const ce23Stats = {
            scored_total: 0,
            shadow_total: 0,
            fail_total: 0,
        };
        qualityScores.forEach((s) => {
            const signals = s.signals;
            if (signals?.identity_score_real_ppv64 !== undefined) {
                ce23Stats.scored_total++;
                if (signals.ce23_real_mode === 'shadow') {
                    ce23Stats.shadow_total++;
                }
                if (signals.identity_score_real_ppv64 < 0.8) {
                    ce23Stats.fail_total++;
                }
            }
        });
        const ce23_real_fail_rate_1h = ce23Stats.scored_total > 0 ? ce23Stats.fail_total / ce23Stats.scored_total : 0;
        let guardrailBlockedCount = 0;
        let marginalFailCount = 0;
        try {
            const guardrailRes = await this.prisma.$queryRaw `
        SELECT count(*)::int as count
        FROM quality_scores 
        WHERE "createdAt" >= (NOW() AT TIME ZONE 'UTC') - interval '1 hour'
          AND (signals->>'stopReason') = 'GUARDRAIL_BLOCKED_REWORK'
      `;
            guardrailBlockedCount = Number(guardrailRes[0]?.count || 0);
            const marginalRes = await this.prisma.$queryRaw `
        SELECT count(*)::int as count
        FROM quality_scores
        WHERE "createdAt" >= (NOW() AT TIME ZONE 'UTC') - interval '1 hour'
          AND (signals->>'identity_score_real_ppv64') IS NOT NULL
          AND (signals->>'ce23_real_threshold_used') IS NOT NULL
          AND ((signals->>'identity_score_real_ppv64')::float < (signals->>'ce23_real_threshold_used')::float)
          AND ((signals->>'identity_score_real_ppv64')::float >= ((signals->>'ce23_real_threshold_used')::float - 0.03))
      `;
            marginalFailCount = Number(marginalRes[0]?.count || 0);
            this.logger.log(`[P16-1.4] Metrics SQL Result: Guardrail=${guardrailBlockedCount}, Marginal=${marginalFailCount}`);
        }
        catch (err) {
            this.logger.error(`Failed to aggregate P16-1.4 metrics via SQL: ${err}`);
            guardrailBlockedCount = 0;
            marginalFailCount = 0;
        }
        const audio_kill_switch_active = process.env.AUDIO_REAL_FORCE_DISABLE === '1' ? 1 : 0;
        const vendor_calls_1h = this.audioCounters.vendorCalls.getSum();
        const cache_hits_1h = this.audioCounters.cacheHits.getSum();
        const cache_misses_1h = this.audioCounters.cacheMisses.getSum();
        const preview_requests_1h = this.audioCounters.previewRequests.getSum();
        const cache_total = cache_hits_1h + cache_misses_1h;
        return {
            job_success_rate_15m: Number(job_success_rate_15m.toFixed(2)),
            job_counts_by_type,
            queue_depth: queueDepth,
            oldest_pending_age_ms,
            published_assets_24h: publishedCount,
            rework_rate_1h: Number(rework_rate_1h.toFixed(2)),
            ce23_real_scored_1h: ce23Stats.scored_total,
            ce23_real_shadow_1h: ce23Stats.shadow_total,
            ce23_real_fail_1h: ce23Stats.fail_total,
            ce23_real_fail_rate_1h: Number(ce23_real_fail_rate_1h.toFixed(2)),
            rework_stats_1h: {
                ...reworkStats,
                avg_rework_cost_estimate: 0,
                ce23_guardrail_blocked_1h: guardrailBlockedCount,
                ce23_real_marginal_fail_1h: marginalFailCount,
            },
            cost_by_engineKey_24h: costByEngine.reduce((acc, curr) => {
                acc[curr.engineKey] = curr._count;
                return acc;
            }, {}),
            audio_kill_switch_active,
            audio_vendor_calls_1h: vendor_calls_1h,
            audio_cache_hits_1h: cache_hits_1h,
            audio_cache_misses_1h: cache_misses_1h,
            audio_preview_requests_1h: preview_requests_1h,
            audio_cache_hit_rate_1h: cache_total > 0 ? Number((cache_hits_1h / cache_total).toFixed(2)) : 0,
            audio_metrics: {
                audio_vendor_calls_total: this.audioCounters.vendorCallsTotal,
                audio_cache_hits_total: this.audioCounters.cacheHitsTotal,
                audio_cache_misses_total: this.audioCounters.cacheMissesTotal,
                audio_preview_requests_total: this.audioCounters.previewRequestsTotal,
                audio_vendor_calls_1h: vendor_calls_1h,
                audio_cache_hits_1h: cache_hits_1h,
                audio_cache_misses_1h: cache_misses_1h,
                audio_preview_requests_1h: preview_requests_1h,
                audio_cache_hit_rate_1h: cache_total > 0 ? Number((cache_hits_1h / cache_total).toFixed(2)) : 0,
                audio_kill_switch_active,
            },
            timestamp: now.toISOString(),
        };
    }
    audioCounters = {
        vendorCallsTotal: 0,
        cacheHitsTotal: 0,
        cacheMissesTotal: 0,
        previewRequestsTotal: 0,
        vendorCalls: new SlidingWindowCounter(),
        cacheHits: new SlidingWindowCounter(),
        cacheMisses: new SlidingWindowCounter(),
        previewRequests: new SlidingWindowCounter(),
    };
    incrementAudioVendorCall() {
        this.audioCounters.vendorCallsTotal++;
        this.audioCounters.vendorCalls.increment();
    }
    incrementAudioCacheHit() {
        this.audioCounters.cacheHitsTotal++;
        this.audioCounters.cacheHits.increment();
    }
    incrementAudioCacheMiss() {
        this.audioCounters.cacheMissesTotal++;
        this.audioCounters.cacheMisses.increment();
    }
    incrementAudioPreview() {
        this.audioCounters.previewRequestsTotal++;
        this.audioCounters.previewRequests.increment();
    }
};
exports.OpsMetricsService = OpsMetricsService;
exports.OpsMetricsService = OpsMetricsService = OpsMetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OpsMetricsService);
class SlidingWindowCounter {
    buckets = new Array(60).fill(0);
    lastMinute = -1;
    increment() {
        this.tick();
        const minute = new Date().getMinutes();
        this.buckets[minute]++;
    }
    getSum() {
        this.tick();
        return this.buckets.reduce((a, b) => a + b, 0);
    }
    tick() {
        const now = new Date();
        const currentMinute = now.getMinutes();
        if (this.lastMinute === -1) {
            this.lastMinute = currentMinute;
            return;
        }
        if (currentMinute !== this.lastMinute) {
            let m = (this.lastMinute + 1) % 60;
            while (m !== (currentMinute + 1) % 60) {
                this.buckets[m] = 0;
                m = (m + 1) % 60;
            }
            this.lastMinute = currentMinute;
        }
    }
}
//# sourceMappingURL=ops-metrics.service.js.map