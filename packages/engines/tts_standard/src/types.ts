/**
 * TTS Standard Engine - Type Definitions
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

export interface TTSStandardInput {
  // === Required ===
  traceId: string;
  projectId: string;

  // === TTS Params ===
  text: string;
  voiceId?: string;
  speed?: number;
}

export interface TTSStandardOutput {
  // === Result ===
  assets: {
    audio: string; // Absolute path to generated MP3/WAV
  };

  // === SSOT Required ===
  billing_usage: EngineBillingUsage;
  audit_trail?: EngineAuditTrail;
}

// === Hub Alignment ===
export type __ENGINE__Input = TTSStandardInput;
export type __ENGINE__Output = TTSStandardOutput;
