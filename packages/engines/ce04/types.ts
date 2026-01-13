export interface CE04Input {
  structured_text: string; // Scene or Shot text
  context?: {
    projectId: string;
    [key: string]: any;
  };
}

export interface EngineBillingUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}

export interface CE04Output {
  enrichment_quality: number;
  enriched_prompt: string;
  prompt_parts: {
    style?: string;
    lighting?: string;
    camera?: string;
    composition?: string;
    negatives?: string;
    seed?: number;
  };
  metadata: {
    engine_version: string;
    latency_ms: number;
  };
  audit_trail: {
    engine_version: string;
    timestamp: string;
    input_hash?: string;
  };
  billing_usage?: EngineBillingUsage;
  assets?: {
    image?: string;
  };
}
