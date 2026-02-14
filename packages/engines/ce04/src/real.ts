import { CE04Input, CE04Output } from './types';
import { LLMClient } from '@scu/shared';

/**
 * 视觉增强引擎 - 增强版 (AI + 模板)
 * 
 * CE04 的目标是将原始文本转化为更具描述性、画面感的 Prompt。
 */
export async function ce04RealEngine(input: CE04Input): Promise<CE04Output> {
  const baseText = input.structured_text || '';
  const startTime = Date.now();

  // 1. 尝试使用 LLM 进行增强
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const isAiMode = !!apiKey && process.env.ENABLE_CE04_AI === '1';

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
            content: `你是一个专业的电影后期导演和提示词工程师。请将输入的小说镜头文本增强为高质量的图像生成提示词。
请从以下维度进行增强：
- Style: 电影感风格 (如 Cinematic, 35mm film, Cyberpunk 等)。全局风格锁定提示 (Style Locking): ${input.style_prompt || '无'}
- Lighting: 光影效果 (如 Volumetric lighting, Golden hour, Soft glow 等)
- Composition: 构图 (如 Rule of thirds, Master shot, Close-up 等)
- Detail: 画面细节和纹理。

请严格返回 JSON 格式：
{
  "enriched_prompt": "完整的增强提示词",
  "prompt_parts": {
    "style": "风格描述",
    "lighting": "光影描述",
    "composition": "构图描述",
    "detail": "细节描述"
  }
}`,
          },
          {
            role: 'user',
            content: baseText,
          },
        ],
        temperature: 0.7,
        responseFormat: 'json_object',
      });

      const result = JSON.parse(response.content);

      return {
        enrichment_quality: 0.95,
        enriched_prompt: result.enriched_prompt,
        prompt_parts: {
          style: result.prompt_parts?.style,
          lighting: result.prompt_parts?.lighting,
          composition: result.prompt_parts?.composition,
          ...result.prompt_parts
        },
        metadata: {
          engine_version: `real-v2-ai-${model}`,
          latency_ms: Date.now() - startTime,
        },
        audit_trail: {
          engine_version: `real-v2-ai-${model}`,
          timestamp: new Date().toISOString(),
        },
        billing_usage: response.usage ? {
          ...response.usage,
          model
        } : undefined,
      };
    } catch (error: any) {
      console.warn(`[CE04] AI Enrichment failed, falling back to template logic: ${error.message}`);
    }
  }

  // 2. 兜底逻辑：基于模板的增强 (Template-based Fallback)
  const summary = baseText.slice(0, 100).replace(/\n/g, ' ');
  const styleBias = input.style_prompt || 'Cinematic, 35mm film, soft light';
  const enriched = `Cinematic ultra detailed shot of ${summary}, ${styleBias}, dramatic composition, 8k resolution`;

  return {
    enrichment_quality: 0.85,
    enriched_prompt: enriched,
    prompt_parts: {
      style: input.style_prompt ? 'Custom Locking' : 'Cinematic, 35mm film',
      lighting: 'soft light',
      composition: 'dramatic',
    },
    metadata: {
      engine_version: 'real-v2-fallback',
      latency_ms: Date.now() - startTime,
    },
    audit_trail: {
      engine_version: 'real-v2-fallback',
      timestamp: new Date().toISOString(),
    },
    billing_usage: {
      promptTokens: baseText.length,
      completionTokens: enriched.length,
      totalTokens: baseText.length + enriched.length,
      model: 'ce04-template-v2',
    },
    assets: {
      image: 'node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/public/icon-1024.png',
    },
  };
}
