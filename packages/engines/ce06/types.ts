/**
 * CE06 Types SSOT (Stage-3-B)
 * 目标：
 * - 这里是唯一真源（SSOT）
 * - 同时兼容历史命名：CE06Input/CE06Output
 * - 输出必须包含 billing_usage（计费闭环）
 */

export interface EngineBillingUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string; // 用于价格表查价（如 'ce06-replay-mock' / 'gemini-2.0-flash'）
}

export interface EngineAuditTrail {
  engineKey?: string;
  engineVersion: string;
  timestamp: string;
  input_hash?: string;
  traceId?: string;
  phase?: string; // Phase identification (SCAN, CHUNK_PARSE)
  [k: string]: any;
}

/** 结构化输入（按现有字段命名保守兼容） */
export interface CE06NovelParsingInput {
  // NOTE：这里用"最小必需字段 + 扩展兼容字段"策略，避免破坏现有调用方
  structured_text: string;
  phase?: 'SCAN' | 'CHUNK_PARSE';

  // 允许旧链路仍然传入（不强制删除）
  raw_text?: string;
  rawText?: string;
  novelSourceId?: string;
  projectId?: string;
  traceId?: string;
  options?: any;
  context?: any;
  [k: string]: any;
}

/** 结构化输出（必须带计费） */
export interface CE06NovelParsingOutput {
  volumes: any[];
  chapters: any[];
  scenes: any[];
  parsing_quality?: number;
  audit_trail: EngineAuditTrail;

  // Stage-3-B 强制字段
  billing_usage: EngineBillingUsage;

  // 允许历史调用方读取到额外字段而不报错
  [k: string]: any;
}

/**
 * 兼容旧命名（历史代码可能在用 CE06Input/CE06Output）
 * 关键：不要让 repo 里再出现第二套"看起来一样但不兼容"的类型定义
 */
export type CE06Input = CE06NovelParsingInput;
export type CE06Output = CE06NovelParsingOutput;
