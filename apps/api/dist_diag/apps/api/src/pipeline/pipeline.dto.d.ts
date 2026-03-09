export type PipelineNodeType = 'PROJECT' | 'SEASON' | 'EPISODE' | 'SCENE' | 'SHOT';
export type GateStatus = 'PASS' | 'WARN' | 'FAIL' | 'PENDING' | 'SKIPPED' | 'FORCED_PASS';
export interface PipelineNode {
    nodeId: string;
    type: PipelineNodeType;
    refId: string;
    index?: number;
    title: string;
    canGenerate?: boolean;
    qaStatus?: GateStatus;
    blockingReason?: string | null;
    lastJob?: {
        id: string;
        status?: string;
        type?: string;
        engineKey?: string;
        createdAt?: string;
    } | null;
    children?: PipelineNode[];
}
export interface GetPipelineResponse {
    projectId: string;
    updatedAt: string;
    root: PipelineNode;
}
