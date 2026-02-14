import { CE03Input, CE03Output } from './types';
import { LLMClient } from '@scu/shared';

/**
 * 视觉密度评分引擎 - 增强版 (AI + 关键词)
 * 
 * CE03 的目标是评估文本的"视觉丰富度"，以便决定该镜头是否需要更高级的配置。
 */
export async function ce03RealEngine(input: CE03Input): Promise<CE03Output> {
  const text = input.structured_text || '';

  // 1. 尝试使用 LLM 进行高级分析
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const isAiMode = !!apiKey && process.env.ENABLE_CE03_AI === '1';

  if (isAiMode && apiKey) {
    try {
      const llmClient = new LLMClient();
      const provider = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
      const model = provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4-turbo-preview';

      const response = await llmClient.chat({
        provider: provider as any,
        model,
        apiKey,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的视觉评估助手。请分析输入的文本片段的视觉密度。
评分标准（float 0.0-1.0）：
- 0.0-0.3: 纯对白或抽象思考，缺乏视觉细节。
- 0.4-0.6: 有基础的环境描写或人物外貌。
- 0.7-0.9: 具有丰富的感官细节、光影、纹理和动态描写。
- 1.0: 极致的画面感。

请严格返回 JSON 格式：
{
  "score": 0.85,
  "indicators": {
    "lighting": 0.8,
    "texture": 0.7,
    "composition": 0.9
  }
}`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.1,
        responseFormat: 'json_object',
      });

      const result = JSON.parse(response.content);

      return {
        visual_density_score: result.score ?? 0.5,
        quality_indicators: {
          text_length: text.length,
          adjective_count: 0,
          lighting_keywords: Math.round((result.indicators?.lighting || 0) * 10),
          camera_keywords: Math.round((result.indicators?.composition || 0) * 10),
        },
        audit_trail: {
          engine_version: `real-v2-ai-${model}`,
          timestamp: new Date().toISOString(),
          input_hash: undefined,
        },
        billing_usage: response.usage ? {
          ...response.usage,
          model
        } : undefined,
      };
    } catch (error: any) {
      console.warn(`[CE03] AI Scoring failed, falling back to keyword logic: ${error.message}`);
    }
  }

  // 2. 兜底逻辑：关键词匹配 (Keyword-based Fallback)
  const words = text.split(/\s+/);
  const visualWords = [
    '看见', '光', '暗', '红', '黑', '白', '蓝', '绿', '脸', '眼睛', '天空', '道路', '房间', '窗', '门', '手', '血',
    'light', 'shadow', 'dark', 'bright', 'dim', 'red', 'blue', 'green', 'face', 'eye', 'sky', 'room', 'window',
  ];

  let visualCount = 0;
  for (const w of words) {
    if (visualWords.some((vw) => w.includes(vw))) {
      visualCount++;
    }
  }

  const density = words.length > 0 ? Math.min(1.0, (visualCount * 5) / words.length) : 0;

  return {
    visual_density_score: density,
    quality_indicators: {
      text_length: text.length,
      adjective_count: 0,
      lighting_keywords: visualCount,
      camera_keywords: 0,
    },
    audit_trail: {
      engine_version: 'real-v2-fallback',
      timestamp: new Date().toISOString(),
    },
    billing_usage: {
      promptTokens: text.length,
      completionTokens: 1,
      totalTokens: text.length + 1,
      model: 'ce03-algo-v2',
    },
  };
}
