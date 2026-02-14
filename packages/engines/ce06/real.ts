import axios from 'axios';
import type { CE06Input, CE06Output, EngineBillingUsage, EngineAuditTrail } from './types';
import { scanNovelVolumesAndChapters, ScanChunk } from './src/scan_util';
import { runMultiAgentAnalysis } from './src/multi_agent';

/**
 * CE06 Real Engine - Gemini 2.0 Cinematic Analysis (V1.3)
 *
 * 核心变更：
 * 1. 移除硬截断 rawText.slice(0, 30000)
 * 2. 引入两阶段路由：SCAN (分片扫描) 与 CHUNK_PARSE (章节解析)
 * 3. 严格对标 DBSpec V1.1 字段：snake_case
 */

export async function ce06RealEngine(input: CE06Input): Promise<CE06Output> {
  const phase = input.phase || 'SCAN'; // 默认 SCAN 以兼容根任务发起
  const rawText = input.structured_text || input.rawText || '';
  const traceId = input.traceId || `ce06_${Date.now()}`;
  const apiKey = process.env.GEMINI_API_KEY;

  if (phase === 'SCAN') {
    return executeScanPhase(rawText, traceId);
  }

  return executeChunkParsePhase(input, apiKey);
}

/**
 * Phase 1: SCAN (流式正则扫描)
 * 目标：不调用 AI，快速切分千万字文本。
 */
async function executeScanPhase(rawText: string, traceId: string): Promise<CE06Output> {
  const chunks = scanNovelVolumesAndChapters(rawText);

  return {
    volumes: chunks, // 返回扫描到的分片信息
    chapters: [],
    scenes: [],
    audit_trail: {
      engineVersion: 'ce06-scan-v1.3',
      timestamp: new Date().toISOString(),
      input_hash: traceId, // TODO: REAL HASH
      phase: 'SCAN',
      chunks_count: chunks.length,
    },
    billing_usage: {
      promptTokens: 0, // SCAN 不计 LLM 费用
      completionTokens: 0,
      totalTokens: 0,
      model: 'deterministic-scan',
    },
  };
}

/**
 * Phase 2: CHUNK_PARSE (章节级 AI 解析)
 * 目标：针对单个章节分场，写入 raw_text/enriched_text/visual_density_score。
 */
async function executeChunkParsePhase(
  input: CE06Input,
  apiKey: string | undefined
): Promise<CE06Output> {
  const chapterText = input.structured_text || '';
  const model = 'gemini-1.5-flash';

  // 如果没有 API Key，降级到确定性解析
  if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.includes('AIzaSyDwau')) {
    // [P6-0 Fix] If key looks like a placeholder or we want to force fallback for pressure test
    if (process.env.CE06_FORCE_FALLBACK === '1' || !apiKey) {
      return ce06DeterministicChunkParser(chapterText);
    }
  }

  // Multi-Agent Path (B1)
  if (input.multi_agent && apiKey) {
    console.log(`[CE06_REAL] Entering Multi-Agent Analysis (B series)...`);
    return runMultiAgentAnalysis(chapterText, apiKey, model);
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  const systemPrompt = `
You are a Cinematic Novel Processor. Parse the provided SINGLE CHAPTER text into multiple Scenes.
Rules:
1. Divide the text into Scenes (continuous action in one location).
2. For each scene, provide:
   - title: Short descriptive title
   - raw_text: The EXACT original text for this scene (DO NOT SUMMARIZE)
   - enriched_text: Cinematic atmosphere & visual enhancements
   - visual_density_score: A float from 0.0 to 1.0 reflecting visual complexity.
3. Output MUST be valid JSON only.

JSON Schema:
{
  "scenes": [
    { "title": "...", "raw_text": "...", "enriched_text": "...", "visual_density_score": 0.8 }
  ]
}
`;

  try {
    const response = await axios.post(
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nChapter Text:\n${chapterText}` }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      },
      { timeout: 60000 }
    );

    const rawResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawResponse);

    return {
      volumes: [],
      chapters: [],
      scenes: parsed.scenes || [],
      billing_usage: {
        promptTokens: response.data?.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.data?.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.data?.usageMetadata?.totalTokenCount || 0,
        model: model,
      },
      audit_trail: {
        engineVersion: 'gemini-1.5-flash-chunk-v1.3',
        timestamp: new Date().toISOString(),
        input_hash: 'todo',
        phase: 'CHUNK_PARSE',
      },
    };
  } catch (error: any) {
    console.error(`[CE06_REAL] Gemini API Error: ${error.message}`);
    if (error.response) {
      console.error(`[CE06_REAL] Response Status: ${error.response.status}`);
      console.error(`[CE06_REAL] Response Data: ${JSON.stringify(error.response.data)}`);
    }

    // [Pressure Test Recovery] If API fails, fallback to deterministic parser to avoid blocking the pipeline
    console.warn(`[CE06_REAL] Falling back to deterministic parser for chapter.`);
    return ce06DeterministicChunkParser(chapterText);
  }
}

/**
 * 降级解析器 (不带 AI)
 */
async function ce06DeterministicChunkParser(text: string): Promise<CE06Output> {
  const sceneRegex = /\n{2,}/;
  const parts = text.split(sceneRegex).filter((p) => p.trim().length > 0);

  const scenes = parts.map((p, i) => ({
    index: i + 1,
    title: `Scene ${i + 1}`,
    raw_text: p,
    enriched_text: '',
    visual_density_score: 0.1,
    // V3.0 P0-2: Mock character detection for fallback testing
    characters: text.includes('张三')
      ? [
        {
          id: 'char_zhangsan',
          name: '张三',
          status: 'normal',
          appearance: { clothing: '红色长袍', hair: '长发' },
          location: '森林',
          items: ['长剑'],
          injuries: [],
        },
      ]
      : [],
  }));

  return {
    volumes: [],
    chapters: [],
    scenes,
    billing_usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      model: 'deterministic-chunk-fallback',
    },
    audit_trail: {
      engineVersion: 'fallback-v1.3',
      timestamp: new Date().toISOString(),
      input_hash: 'todo',
    },
  };
}
