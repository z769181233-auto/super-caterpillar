export type BlockReasonCode =
    | 'MISSING_NOVEL'
    | 'STRUCTURE_NOT_READY'
    | 'SCENE_MISSING_CHAR_BINDING'
    | 'SCENE_MISSING_LOCATION_BINDING'
    | 'SHOT_PLAN_NOT_READY'
    | 'ASSET_NOT_READY'
    | 'QUALITY_GATE_FAILED'
    | 'COST_LIMIT_EXCEEDED'
    | 'PERMISSION_DENIED';

export type StageKey =
    | 'NOVEL_IMPORT'
    | 'STRUCTURE_ANALYSIS'
    | 'SCRIPT_SEMANTIC'
    | 'SHOT_PLANNING'
    | 'ASSET_GENERATION'
    | 'VIDEO_GENERATION'
    | 'COMPOSE_EXPORT';

export interface ProjectHeaderDTO {
    id: string;
    idShort: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    status: 'DRAFT' | 'RUNNING' | 'BLOCKED' | 'FAILED' | 'READY' | 'ARCHIVED';
    stage: {
        currentKey: StageKey;
        currentLabel: string;
        progressPct: number; // 0-100
    };
    blocking: {
        isBlocked: boolean;
        reasonCode?: string;
        reasonTitle?: string;
        reasonDetail?: string;
        requiredFixes?: Array<{ code: string; title: string; link?: string }>;
    };
    risk: {
        quality: 'OK' | 'WARN' | 'FAIL';
        cost: 'OK' | 'WARN' | 'FAIL';
        compliance: 'OK' | 'WARN' | 'FAIL';
    };
}

export interface ProjectFlowStepDTO {
    key: StageKey;
    label: string;
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'BLOCKED';
    startedAt?: string;
    endedAt?: string;
    gate: {
        canRun: boolean;
        blockedReason?: string;
        missingInputs?: Array<{ code: string; title: string; howToFix?: string; link?: string }>;
    };
    actions: Array<{
        key: 'RUN' | 'RETRY' | 'VIEW_REPORT' | 'VIEW_ERRORS';
        label: string;
        enabled: boolean;
        disabledReason?: string;
        href?: string;
    }>;
}

export interface ProjectFlowDTO {
    nodes: Array<ProjectFlowStepDTO>;
}

export interface ProjectNextActionDTO {
    action: { key: string; label: string; href?: string; canRun: boolean; disabledReason?: string };
    why: string;
    estimate?: { etaSec?: number; costTokens?: number; costMoney?: number };
    jobType?: string;
    impact?: {
        level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
        text: string;
        willInvalidate?: Array<'SHOT_PLAN' | 'ASSETS' | 'VIDEOS' | 'EXPORT'>;
    };
}

export interface ProjectStructureStatsDTO {
    seasons: number;
    episodes: number;
    scenes: number;
    shots: number;
    issues: {
        total: number;
        missingBindings: number;
        semanticConflicts: number;
        qaFailed: number;
    };
    links: {
        structureView: string;
        issuesView: string; // 带 query，如 ?filter=qaFailed
    };
}

export interface JobBrief {
    id: string;
    type: string;
    status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
    progressPct?: number;
    startedAt?: string;
    workerId?: string;
    engineKey?: string;
    href?: string;
}

export interface ProjectJobsSummaryDTO {
    running: Array<JobBrief>;
    queuedCount: number;
    failed: Array<JobBrief & { error?: { code: string; message: string } }>;
}

export interface ProjectQualitySummaryDTO {
    structure: 'OK' | 'WARN' | 'FAIL';
    semantic: 'OK' | 'WARN' | 'FAIL';
    visual: 'OK' | 'WARN' | 'FAIL';
    lastReport?: { id: string; createdAt: string; href: string };
    topProblems?: Array<{ code: string; title: string; count: number; href?: string }>;
}

export interface ProjectCostSummaryDTO {
    total: { money?: number; tokens?: number; gpuSec?: number };
    last24h?: { money?: number; tokens?: number; gpuSec?: number };
    last1h?: { money?: number; tokens?: number; gpuSec?: number };
    currentRunEstimate?: { money?: number; tokens?: number; gpuSec?: number };
    alert?: { level: 'OK' | 'WARN' | 'FAIL'; reason?: string };
}

export interface ProjectAuditSummaryDTO {
    recent: Array<{
        at: string;
        actor: { id: string; name: string };
        action: string;
        target?: { type: string; id?: string; name?: string };
        result: 'OK' | 'FAIL';
    }>;
    href: string;
}

export interface ProjectOverviewDTO {
    header: ProjectHeaderDTO;
    flow: ProjectFlowDTO;
    next: ProjectNextActionDTO;
    stats: ProjectStructureStatsDTO;
    jobs: ProjectJobsSummaryDTO;
    quality: ProjectQualitySummaryDTO;
    cost: ProjectCostSummaryDTO;
    audit: ProjectAuditSummaryDTO;
}
