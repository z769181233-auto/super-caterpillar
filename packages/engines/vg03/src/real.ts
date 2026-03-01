import { VG03Input, VG03Output, LightingPreset } from './types';
import { LLMClient } from '@scu/shared';

/**
 * VG03 Lighting Engine - Real Implementation
 *
 * Uses AI to choose lighting parameters based on the scene mood.
 */
export async function vg03RealEngine(input: VG03Input): Promise<VG03Output> {
  const mood = input.mood_description || '';

  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const isAiMode = !!apiKey && process.env.ENABLE_VG03_AI === '1';

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
            content: `你是一个专业的电影灯光师。请为给定的氛围描述选择最合适的光照预设和参数。
返回格式为 JSON：
{
  "preset": "cinematic",
  "parameters": {
    "brightness": -0.1,
    "contrast": 1.2,
    "gamma": 0.9,
    "saturation": 1.1
  },
  "reason": "为了营造一种..."
}`,
          },
          {
            role: 'user',
            content: `氛围描述：${mood}`,
          },
        ],
        temperature: 0.1,
        responseFormat: 'json_object',
      });

      const result = JSON.parse(response.content);
      const params = result.parameters;
      const filter = `eq=brightness=${params.brightness}:contrast=${params.contrast}:gamma=${params.gamma}:saturation=${params.saturation}`;

      return {
        preset: result.preset as LightingPreset,
        parameters: params,
        filter_string: filter,
        description: result.reason || mood,
        audit_trail: {
          engine_version: `real-v1-ai-${model}`,
          timestamp: new Date().toISOString(),
        },
        billing_usage: response.usage ? { ...response.usage, model } : undefined,
      };
    } catch (error: any) {
      console.warn(
        `[VG03] AI Lighting design failed, falling back to rule logic: ${error.message}`
      );
    }
  }

  // Fallback Rule-based logic
  let preset: LightingPreset = input.lighting_preset || 'neutral';
  let b = 0,
    c = 1,
    g = 1,
    s = 1;

  if (mood.includes('夜') || mood.includes('黑')) {
    preset = 'night';
    b = -0.3;
    c = 1.2;
    g = 0.8;
    s = 0.8;
  } else if (mood.includes('夕阳') || mood.includes('黄昏')) {
    preset = 'sunset';
    b = 0.0;
    c = 1.1;
    g = 1.0;
    s = 1.5;
  } else if (mood.includes('亮') || mood.includes('阳光')) {
    preset = 'bright';
    b = 0.1;
    c = 1.0;
    g = 1.1;
    s = 1.2;
  }

  const filter = `eq=brightness=${b}:contrast=${c}:gamma=${g}:saturation=${s}`;

  return {
    preset,
    parameters: { brightness: b, contrast: c, gamma: g, saturation: s },
    filter_string: filter,
    description: `Fallback: ${preset}`,
    audit_trail: {
      engine_version: 'real-v1-fallback',
      timestamp: new Date().toISOString(),
    },
  };
}
