export interface QualityScoreRecord {
  taskId: string;
  jobId: string;
  engineKey: string;
  adapterName: string;
  modelInfo?: {
    modelName?: string;
    version?: string;
  };
  metrics: {
    durationMs?: number;
    tokens?: number;
    costUsd?: number;
  };
  quality: {
    confidence?: number;
    score?: number;
  };
  timestamp: string;
}
