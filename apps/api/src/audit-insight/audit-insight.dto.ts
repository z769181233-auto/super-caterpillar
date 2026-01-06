
import { IsString, IsOptional } from 'class-validator';

export class NovelInsightResponse {
    novelSourceId: string;
    projectId: string;
    ce06: NovelAnalysisArtifact[];
    ce07: MemoryUpdateArtifact[];
    ce03_04: VisualMetricArtifact[];
}

export class VisualMetricArtifact {
    jobId: string;
    type: string;
    status: string;
    score?: number;
    output_summary: any;
    created_at: Date;
}

export class NovelAnalysisArtifact {
    jobId: string;
    workerId?: string;
    createdAt: Date;
    status: string;
    payload: any;
    result?: any;
}

export class MemoryUpdateArtifact {
    jobId: string;
    workerId?: string;
    createdAt: Date;
    status: string;
    payload: any;
    memoryContent?: any;
}

export class JobAuditResponse {
    jobId: string;
    type: string;
    status: string;
    workerId?: string;
    createdAt: Date;
    updatedAt: Date;
    payload: any;
    result: any;
    auditLogs: any[];
}

export class AuditJobSummaryDto {
    jobId: string;
    traceId: string;
    status: string;
    createdAtIso: string;
    workerId?: string;
}

export class DirectorAuditSummaryDto {
    mode: 'realtime' | 'stored';
    shotsEvaluated: number;
    isValid: boolean;
    violationsCount: number;
    suggestionsCount: number;
    violationsSample: Array<{ ruleId: string; severity: 'WARNING' | 'ERROR'; message: string }>;
    computedAtIso: string;
}


export class VideoAssetDto {
    status: string;
    secureUrl?: string;
    jobId?: string;
    assetId?: string;
    storageKey?: string;
}

export class DagRunSummaryDto {
    traceId: string;
    timeline: Array<{ phase: 'CE06' | 'CE03' | 'CE04' | 'SHOT' | 'VIDEO'; jobId: string; status: string }>;
    missingPhases: string[];
    builtFrom: 'latest_ce04_trace' | 'latest_run' | 'empty';
    builtAtIso: string;
}

export class NovelAuditFullResponse {
    novelSourceId: string;
    projectId: string;
    latestJobs: {
        ce06?: AuditJobSummaryDto | null;
        ce07?: AuditJobSummaryDto | null;
        ce03?: AuditJobSummaryDto | null;
        ce04?: AuditJobSummaryDto | null;
        video?: AuditJobSummaryDto | null;
    };
    metrics: {
        ce03Score: number;
        ce04Score: number;
    };
    director: DirectorAuditSummaryDto;
    dag: DagRunSummaryDto;
    videoAsset?: VideoAssetDto;
}
