
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
    type: string; // CE03_VISUAL_DENSITY | CE04_VISUAL_ENRICHMENT
    status: string;
    score?: number; // density_score or enrichment_quality
    output_summary: any;
    created_at: Date;
}

export class NovelAnalysisArtifact {
    jobId: string;
    workerId?: string;
    engineKey?: string;
    engineVersion?: string;
    createdAt: Date;
    status: string;
    payload: any;
    result?: any;
}

export class MemoryUpdateArtifact {
    jobId: string;
    workerId?: string;
    engineKey?: string;
    engineVersion?: string;
    createdAt: Date;
    status: string;
    payload: any;
    memoryContent?: any; // The JSON content
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
