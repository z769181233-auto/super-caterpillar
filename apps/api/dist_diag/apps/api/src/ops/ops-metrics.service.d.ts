import { PrismaService } from '../prisma/prisma.service';
export declare class OpsMetricsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getProductionMetrics(): Promise<{
        job_success_rate_15m: number;
        job_counts_by_type: Record<string, number>;
        queue_depth: number;
        oldest_pending_age_ms: number;
        published_assets_24h: number;
        rework_rate_1h: number;
        ce23_real_scored_1h: number;
        ce23_real_shadow_1h: number;
        ce23_real_fail_1h: number;
        ce23_real_fail_rate_1h: number;
        rework_stats_1h: {
            avg_rework_cost_estimate: number;
            ce23_guardrail_blocked_1h: number;
            ce23_real_marginal_fail_1h: number;
            total_evaluations_1h: number;
            total_fails_1h: number;
            blocked_by_budget_1h: number;
            blocked_by_max_attempt_1h: number;
            idempotency_hit_1h: number;
            blocked_by_rate_limit_1h: number;
        };
        cost_by_engineKey_24h: Record<string, number>;
        audio_kill_switch_active: number;
        audio_vendor_calls_1h: number;
        audio_cache_hits_1h: number;
        audio_cache_misses_1h: number;
        audio_preview_requests_1h: number;
        audio_cache_hit_rate_1h: number;
        audio_metrics: {
            audio_vendor_calls_total: number;
            audio_cache_hits_total: number;
            audio_cache_misses_total: number;
            audio_preview_requests_total: number;
            audio_vendor_calls_1h: number;
            audio_cache_hits_1h: number;
            audio_cache_misses_1h: number;
            audio_preview_requests_1h: number;
            audio_cache_hit_rate_1h: number;
            audio_kill_switch_active: number;
        };
        timestamp: string;
    }>;
    private audioCounters;
    incrementAudioVendorCall(): void;
    incrementAudioCacheHit(): void;
    incrementAudioCacheMiss(): void;
    incrementAudioPreview(): void;
}
