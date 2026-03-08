export interface EngineProfileQuery {
    engineKey?: string;
    projectId?: string;
    from?: string;
    to?: string;
}
export interface EngineProfileSummary {
    engineKey: string;
    engineVersion?: string | null;
    adapterName?: string | null;
    totalJobs: number;
    successCount: number;
    failedCount: number;
    retryCount: number;
    avgQualityScore?: number | null;
    avgConfidence?: number | null;
    avgDurationMs?: number | null;
    avgTokens?: number | null;
    avgCostUsd?: number | null;
    successRate?: number | null;
}
export interface EngineProfileResponse {
    summaries: EngineProfileSummary[];
    total: number;
}
