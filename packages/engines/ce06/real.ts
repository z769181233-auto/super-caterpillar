import type { CE06Input, CE06Output, EngineBillingUsage } from './types';

/**
 * CE06 Real Engine（骨架）
 * Production-ready LLM parsing engine.
 *
 * Stage-3-B: 骨架实现，确保返回 billing_usage
 * Stage-3-C/P1: 集成真实 Gemini API 调用
 */

export async function ce06RealEngine(input: CE06Input): Promise<CE06Output> {
  // P0 骨架：保证类型与字段完整
  // 真实 LLM 调用在 Stage-3-C 或 P1 实现

  const billingUsage: EngineBillingUsage = {
    promptTokens: 1,
    completionTokens: 1,
    totalTokens: 2,
    model: 'gemini-2.0-flash', // 默认模型
  };

  // TODO: 真实实现
  // 1. 调用 Gemini API
  // 2. 解析响应
  // 3. 提取 usageMetadata
  // 4. 构造 volumes/chapters/scenes

  return {
    // Hierarchical structure required by mapCE06OutputToProjectStructure
    volumes: [
      {
        title: 'Volume 1',
        start_line: 1,
        end_line: 10,
        chapters: [
          {
            title: 'Chapter 1',
            volume_idx: 0,
            start_line: 1,
            end_line: 5,
            scenes: [
              {
                summary: 'Scene 1',
                location: 'Room',
                characters: ['Hero'],
                chapter_idx: 0,
                start_line: 1,
                end_line: 5,
                content: 'Hero enters the room. Hello world.', // Content for splitting shots
              },
            ],
          },
        ],
      },
    ],
    chapters: [], // Keep empty flat arrays if forced by type, or populate if union type allows
    scenes: [],
    parsing_quality: 95,
    audit_trail: {
      engine_version: 'real-v0.1-skeleton',
      timestamp: new Date().toISOString(),
      input_hash: 'TODO',
    },
    billing_usage: billingUsage, // ⚠️ 强制返回
  };
}
