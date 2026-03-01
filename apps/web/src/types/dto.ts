export type JobStatus = 'PENDING' | 'RUNNING' | 'FAILED' | 'SUCCEEDED' | 'CANCELLED' | string;
export type JobType = string;

export interface JobDTO {
  id: string;
  type: JobType;
  status: JobStatus;
  engineKey?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
  result?: any;
}

export interface ListJobsResponse {
  jobs: JobDTO[];
  total: number;
}

export interface WorkerStatsDTO {
  activeWorkers?: number;
  workers?: number;
  active?: number;
  [k: string]: unknown;
}

export interface OrchestratorStatsDTO {
  queueDepth?: number;
  pending?: number;
  queue?: number;
  [k: string]: unknown;
}

export interface ProjectDTO {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectDetailDTO extends ProjectDTO {
  ownerId?: string;
  coverUrl?: string;
  status?: string | 'ACTIVE' | 'ARCHIVED';
  stats?: {
    shotCount?: number;
    assetCount?: number;
    jobCount?: number;
  };
  [k: string]: unknown;
}

export interface ImportNovelResultDTO {
  novelName?: string;
  author?: string;
  fileUrl?: string;
  // 后端返回的其他可能字段
  url?: string;
  projectId?: string;
  novelSourceId?: string;
  jobId?: string;
  [k: string]: unknown;
}

export interface UserDTO {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
  currentOrganizationId?: string;
  [k: string]: unknown;
}
