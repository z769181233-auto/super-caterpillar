export type RouterModel = 'gemini' | 'sdxl' | 'flux' | 'replay-stub';

export interface RouterV2Request {
  jobType: string;
  qualityThreshold?: number; // 0-1
  costLimit?: number; // Credits
  latencySLA?: number; // ms
  tags?: string[];
}

export interface RouterV2Result {
  selectedModel: RouterModel;
  reason: string;
}

/**
 * P1-A: ModelRouterV2
 * 核心路由逻辑：质量 -> 成本 -> 兜底
 */
export class ModelRouterV2 {
  static route(req: RouterV2Request): RouterV2Result {
    const { jobType, qualityThreshold = 0.8, costLimit = 10.0 } = req;

    // 1. CE04 (Visual Enrichment) 路由规则
    if (jobType === 'CE04_VISUAL_ENRICHMENT' || jobType === 'ce04_visual_enrichment') {
      if (qualityThreshold >= 0.9) {
        return { selectedModel: 'gemini', reason: 'High purity requirement mapped to Gemini' };
      }
      return { selectedModel: 'gemini', reason: 'Default Gemini for CE04 in P1' };
    }

    // 2. ShotRender 路由规则
    if (jobType === 'SHOT_RENDER' || jobType === 'shot_render') {
      // 如果预算极其有限
      if (costLimit < 1.0) {
        return {
          selectedModel: 'replay-stub',
          reason: 'Cost limit exceeded, falling back to Stub',
        };
      }

      // 如果追求极致质量且预算充足
      if (qualityThreshold >= 0.95 && costLimit >= 8.0) {
        return { selectedModel: 'flux', reason: 'Masterpiece quality requested via Flux' };
      }

      // 默认生产级选项
      return { selectedModel: 'sdxl', reason: 'Standard production quality via SDXL' };
    }

    // 3. 兜底逻辑
    return { selectedModel: 'replay-stub', reason: 'No specific rule found, safety fallback' };
  }
}
