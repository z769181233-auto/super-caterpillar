
import { IsString, IsOptional } from 'class-validator';

export class NovelInsightResponse {
    novelSourceId: string;
    projectId: string;
    ce06: NovelAnalysisArtifact[];
    ce07: MemoryUpdateArtifact[];
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
