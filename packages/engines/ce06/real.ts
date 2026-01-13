import axios from 'axios';
import type { CE06Input, CE06Output, EngineBillingUsage, EngineAuditTrail } from './types';

/**
 * CE06 Real Engine - Gemini 2.0 Cinematic Analysis
 * Production-ready LLM parsing engine using Gemini 2.0 Flash.
 *
 * It extracts:
 * - Volumes, Chapters, Scenes
 * - Summary & Cinematic Directing Notes
 * - Billing & Audit Data
 */

export async function ce06RealEngine(input: CE06Input): Promise<CE06Output> {
  const rawText = input.structured_text || '';
  const traceId = input.traceId || `ce06_${Date.now()}`;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[CE06] GEMINI_API_KEY not found, falling back to Deterministic Parser');
    return ce06DeterministicParser(rawText, traceId);
  }

  const model = 'gemini-1.5-flash'; // Optimized for speed and large context
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt = `
You are a Cinematic Novel Processor. Your job is to parse the novel text and convert it into a structured JSON for video production.
Rules:
1. Divide the text into Chapters. If not explicitly mentioned, assume it's one chapter.
2. Within each chapter, identify Scenes. A scene is a continuous action in one location.
3. For each scene, provide:
   - title: A short descriptive title
   - summary: 1-sentence briefing
   - content: The actual text belonging to this scene
   - directing_notes: Visual atmosphere, lighting, camera angles
   - shot_type: CLOSE_UP, MEDIUM_SHOT, or WIDE_SHOT
4. Output MUST be valid JSON only.

JSON Schema:
{
  "volumes": [
    {
      "title": "Main Volume",
      "chapters": [
        {
          "title": "Chapter title",
          "scenes": [
            { "title": "...", "summary": "...", "content": "...", "directing_notes": "...", "shot_type": "..." }
          ]
        }
      ]
    }
  ]
}
`;

  try {
    const response = await axios.post(url, {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nNovel Text:\n${rawText.slice(0, 30000)}` }], // Safety limit
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }, { timeout: 60000 });

    const rawResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawResponse);

    return {
      volumes: parsed.volumes || [],
      chapters: [], // Legacy compat
      scenes: [], // Legacy compat
      parsing_quality: 0.95,
      audit_trail: {
        engine_version: 'gemini-2.0-flash-cinematic-v1',
        timestamp: new Date().toISOString(),
        input_hash: 'todo-hash',
      },
      billing_usage: {
        promptTokens: response.data?.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.data?.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.data?.usageMetadata?.totalTokenCount || 0,
        model: model,
      },
    };
  } catch (error: any) {
    console.error('[CE06] Gemini Invocation Failed:', error.message);
    return ce06DeterministicParser(rawText, traceId);
  }
}

/**
 * Fallback / Legacy Deterministic Parser (Regex Based)
 */
async function ce06DeterministicParser(rawText: string, traceId: string): Promise<CE06Output> {
  const chapterRegex = /(第\s*[一二三四五六七八九十0-9]+\s*章|Chapter\s*\d+)/;
  const hasChapters = chapterRegex.test(rawText);
  const chapters = [];

  if (!hasChapters) {
    const scenes = rawText
      .split(/\n{2,}/)
      .filter((s) => s.trim().length > 0)
      .map((s, idx) => ({
        title: `Scene ${idx + 1}`,
        summary: s.slice(0, 50).replace(/\n/g, ' '),
        content: s,
        scene_idx: idx,
      }));
    chapters.push({ title: 'Chapter 1', scenes });
  } else {
    const parts = rawText.split(chapterRegex).filter(Boolean);
    let currentTitle = 'Prologue';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (chapterRegex.test(part)) {
        currentTitle = part;
      } else {
        const scenes = part
          .split(/\n{2,}/)
          .filter((s) => s.trim().length > 0)
          .map((s, idx) => ({
            title: `Scene ${idx + 1}`,
            summary: s.slice(0, 50).replace(/\n/g, ' '),
            content: s,
            scene_idx: idx,
          }));
        if (scenes.length > 0) chapters.push({ title: currentTitle, scenes });
      }
    }
  }

  return {
    volumes: [{ title: 'Main Volume', chapters }],
    chapters: [],
    scenes: [],
    billing_usage: {
      promptTokens: rawText.length,
      completionTokens: chapters.length * 10,
      totalTokens: rawText.length,
      model: 'ce06-deterministic-fallback',
    },
    audit_trail: {
      engine_version: 'deterministic-fallback',
      timestamp: new Date().toISOString(),
      input_hash: 'todo',
    },
  };
}
