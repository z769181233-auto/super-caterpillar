export interface ShotRenderInput {
  shotId: string;
  traceId: string;
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  negative_prompt?: string;
  style?: string;
  provider?: 'replicate' | 'hf' | 'local';
  context?: {
    projectId: string;
    [key: string]: any;
  };
}

export interface EngineBillingUsage {
  promptTokens: number;
  completionTokens: number; // For diffusers, maybe steps
  totalTokens: number;
  model: string;
  gpuSeconds?: number;
}

export interface ShotRenderOutput {
  asset: {
    uri: string; // Relative or absolute path
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    width: number;
    height: number;
  };
  render_meta: {
    model: string;
    steps: number;
    sampler: string;
    cfg_scale: number;
    seed: number;
  };
  audit_trail: {
    engineKey: string;
    engineVersion: string;
    timestamp: string;
    paramsHash: string;
    traceId?: string;
  };
  billing_usage: EngineBillingUsage;
}
