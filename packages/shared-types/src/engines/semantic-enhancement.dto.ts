// Stage4: Semantic Enhancement Engine DTO (MVP)

export interface SemanticEnhancementEngineInput {
  nodeType: 'episode' | 'scene' | 'shot';
  nodeId: string;
  text: string;
  context?: Record<string, unknown>;
  options?: {
    generateSummary?: boolean;
    extractKeywords?: boolean;
  };
}

export interface SemanticEnhancementEngineOutput {
  summary?: string;
  keywords?: string[];
}
