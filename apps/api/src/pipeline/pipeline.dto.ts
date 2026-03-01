export type PipelineNodeType = 'PROJECT' | 'SEASON' | 'EPISODE' | 'SCENE' | 'SHOT';

export type GateStatus = 'PASS' | 'WARN' | 'FAIL' | 'PENDING' | 'SKIPPED' | 'FORCED_PASS';

export interface PipelineNode {
  nodeId: string; // 统一 nodeId：`${type}:${id}`
  type: PipelineNodeType;
  refId: string; // 原始 id
  index?: number;
  title: string;

  // Gate fields (来自结构树字段/或推导)
  canGenerate?: boolean;
  qaStatus?: GateStatus; // 兼容结构树现有 PASS/WARN/FAIL/PENDING
  blockingReason?: string | null;

  // Optional job summary (不强依赖)
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
  updatedAt: string; // ISO
  root: PipelineNode;
}
