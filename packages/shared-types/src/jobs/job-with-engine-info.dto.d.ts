export interface JobEngineMetrics {
    durationMs: number | null;
    costUsd: number | null;
    tokens?: number | null;
}
export interface JobQualityScore {
    score: number | null;
    confidence: number | null;
}
export interface JobWithEngineInfo {
    id: string;
    type: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    engineKey: string;
    engineVersion: string | null;
    adapterName: string;
    qualityScore: JobQualityScore | null;
    metrics: JobEngineMetrics | null;
}
