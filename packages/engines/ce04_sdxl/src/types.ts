/**
 * CE04 SDXL Engine - Type Definitions
 */

export interface EngineBillingUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  gpuSeconds?: number;
}

export interface EngineAuditTrail {
  engineKey: string;
  engineVersion: string;
  timestamp: string;
  paramsHash: string;
  traceId?: string;
}

export interface CE04SDXLInput {
  // === Required ===
  traceId: string;
  projectId: string;

  // === SDXL Params ===
  prompt: string;
  negative_prompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
}

export interface CE04SDXLOutput {
  // === Result ===
  assets: {
    image: string; // Absolute path to generated PNG
  };

  // === SSOT Required ===
  billing_usage: EngineBillingUsage;
  audit_trail?: EngineAuditTrail;
}
