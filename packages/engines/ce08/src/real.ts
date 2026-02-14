import { CE08Input, CE08Output, CharacterTrait } from './types';
import { LLMClient } from '@scu/shared';

/**
 * CE08 Character Arc Engine - Real Implementation
 *
 * Uses AI to track character development and psychological shifts.
 */
export async function ce08RealEngine(input: CE08Input): Promise<CE08Output> {
  const name = input.character_name;
  const text = input.scenario_text;

  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const isAiMode = !!apiKey && process.env.ENABLE_CE08_AI === '1';

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
            content: `你是一个专业的文学评论家和心理分析师。请分析给定角色在场景中的心理状态和弧光演变。
返回格式为 JSON：
{
  "archetype": "悲剧英雄",
  "current_state": {
    "emotional_stability": 0.4,
    "internal_conflict": 0.8,
    "resolve": 0.3,
    "traits": [
      { "name": "courage", "value": 0.7, "description": "面对恐惧依然前行" }
    ]
  },
  "progression_markers": ["FALL", "INTERNAL_CONFLICT"],
  "arc_status": "DEVELOPING",
  "reason": "在这个场景中，角色表现出了..."
}`,
          },
          {
            role: 'user',
            content: `角色：${name}\n场景描述：${text}\n前序状态：${JSON.stringify(input.previous_state || '无')}`,
          },
        ],
        temperature: 0.1,
        responseFormat: 'json_object',
      });

      const result = JSON.parse(response.content);

      return {
        character_name: name,
        archetype: result.archetype,
        current_state: result.current_state,
        progression_markers: result.progression_markers,
        arc_status: result.arc_status,
        description: result.reason,
        audit_trail: {
          engine_version: `real-v1-ai-${model}`,
          timestamp: new Date().toISOString(),
        },
        billing_usage: response.usage ? { ...response.usage, model } : undefined,
      };
    } catch (error: any) {
      console.warn(
        `[CE08] AI Character arc analysis failed, falling back to rule logic: ${error.message}`
      );
    }
  }

  // Fallback Rule-based logic
  const traits: CharacterTrait[] = [];
  if (text.includes('想') || text.includes('意识到'))
    traits.push({ name: 'internal_growth', value: 0.5, description: '初步自我觉醒' });

  return {
    character_name: name,
    archetype: 'unknown',
    current_state: {
      emotional_stability: 0.5,
      internal_conflict: 0.5,
      resolve: 0.5,
      traits,
    },
    progression_markers: traits.length > 0 ? ['DEVELOPING'] : ['STATIC'],
    arc_status: traits.length > 0 ? 'DEVELOPING' : 'STATIC',
    description: `Fallback analysis for ${name}`,
    audit_trail: {
      engine_version: 'real-v1-fallback',
      timestamp: new Date().toISOString(),
    },
  };
}
