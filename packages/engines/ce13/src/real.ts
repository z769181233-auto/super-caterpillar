import { CE13Input, CE13Output } from './types';
import { LLMClient } from '@scu/shared';

/**
 * 节奏分析引擎 (Pacing Analyzer) - CE13
 * 
 * 目标：分析文本的情感波峰、紧张度和叙事节奏。
 */
export async function ce13RealEngine(input: CE13Input): Promise<CE13Output> {
    const text = input.structured_text || '';
    const startTime = Date.now();

    // 1. 尝试使用 LLM 进行节奏分析
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const isAiMode = !!apiKey && process.env.ENABLE_CE13_AI === '1';

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
                        content: `你是一个专业的文学评论家和电影剪辑师。请分析以下文本片段的叙事节奏和情感强度。
分析维度：
- Pacing Score (0.0-1.0): 叙事推进的速度。大量动词、短句、动作描述会提高得分。
- Emotional Intensity (0.0-1.0): 情感的浓烈程度。
- Tension Level: 紧张等级 (low, medium, high, extreme)。

请严格返回 JSON 格式：
{
  "pacing_score": 0.8,
  "emotional_intensity": 0.7,
  "tension_level": "high",
  "indicators": {
    "sentence_avg_length": 15,
    "action_verb_density": 0.4,
    "emotional_keywords_count": 5
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
                ...result,
                audit_trail: {
                    engine_version: `real-v1-ai-${model}`,
                    timestamp: new Date().toISOString(),
                },
                billing_usage: response.usage ? {
                    ...response.usage,
                    model
                } : undefined,
            };
        } catch (error: any) {
            console.warn(`[CE13] AI Pacing analysis failed, falling back to rule logic: ${error.message}`);
        }
    }

    // 2. 兜底逻辑：简单的规则分析 (Rule-based Fallback)
    const sentences = text.split(/[。！？!?]/).filter(s => s.trim().length > 0);
    const avgLength = sentences.length > 0 ? text.length / sentences.length : 0;

    // 简单的节奏估算：句子越短，节奏越快
    const pacingBase = Math.max(0, Math.min(1.0, 1 - (avgLength / 50)));

    return {
        pacing_score: pacingBase,
        emotional_intensity: 0.5,
        tension_level: pacingBase > 0.7 ? 'medium' : 'low',
        indicators: {
            sentence_avg_length: avgLength,
            action_verb_density: 0.1,
            emotional_keywords_count: 0,
        },
        audit_trail: {
            engine_version: 'real-v1-fallback',
            timestamp: new Date().toISOString(),
        },
        billing_usage: {
            promptTokens: text.length,
            completionTokens: 1,
            totalTokens: text.length + 1,
            model: 'ce13-rule-v1',
        },
    };
}
