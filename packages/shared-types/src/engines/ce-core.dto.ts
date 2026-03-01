/**
 * CE Core Layer DTOs (Stage13)
 * CE06 / CE03 / CE04 Engine Input/Output Types
 */

// ============================================
// CE06: Novel Parsing
// ============================================

export interface CE06NovelParsingInput {
  structured_text: string;
  context: {
    projectId: string;
    novelSourceId?: string;
  };
}

export interface CE06NovelParsingOutput {
  volumes: Array<{
    id: string;
    title: string;
    chapters: Array<{
      id: string;
      title: string;
      scenes: Array<{
        id: string;
        title: string;
        content: string;
      }>;
    }>;
  }>;
  chapters?: Array<any>; // 兼容代码中的直接使用
  scenes?: Array<any>; // 兼容代码中的直接使用
  parsing_quality: number;
  audit_trail: string;
  engine_version: string;
  latency_ms: number;
}

// ============================================
// CE03: Visual Density
// ============================================

export interface CE03VisualDensityInput {
  structured_text: string;
  context: {
    projectId: string;
    sceneId?: string;
    episodeId?: string;
  };
}

export interface CE03VisualDensityOutput {
  visual_density_score: number;
  quality_indicators: Record<string, any>;
  audit_trail: string;
  engine_version: string;
  latency_ms: number;
}

// ============================================
// CE04: Visual Enrichment
// ============================================

export interface CE04VisualEnrichmentInput {
  structured_text: string;
  context: {
    projectId: string;
    sceneId?: string;
    shotId?: string;
  };
}

export interface CE04VisualEnrichmentOutput {
  enriched_text: string;
  enriched_prompt: string;
  prompt_parts: {
    style?: string;
    lighting?: string;
    camera?: string;
    composition?: string;
    negatives?: string;
    seed?: number;
  };
  enrichment_quality: number;
  metadata: Record<string, any>;
  audit_trail: string;
  engine_version: string;
  latency_ms: number;
}

// ============================================
// CE07: Memory Update
// ============================================

export interface CE07MemoryUpdateInput {
  current_text: string;
  previous_memory?: {
    summary: string;
    character_states: Record<string, any>;
  };
  context: {
    projectId: string;
    chapterId?: string;
    sceneId?: string;
  };
}

export interface CE07MemoryUpdateOutput {
  summary: string;
  character_states: Record<string, any>;
  key_facts: string[];
  audit_trail: string;
  engine_version: string;
  latency_ms: number;
}
