import { CE06Input, CE06Output, EngineBillingUsage } from './types';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { runMultiAgentAnalysis } from './src/multi_agent';
import { scanNovelVolumesAndChapters as scanVolumes } from './src/scan_util';

/**
 * Real Implementation of CE06 Novel Parsing Engine
 * V1.5.1: SDK Support + Multi-Agent Orchestration
 */
export async function executeCE06Real(input: CE06Input, apiKey: string): Promise<CE06Output> {
  return ce06RealEngine(input, apiKey);
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export const ce06RealEngine = async (input: CE06Input, apiKey?: string): Promise<CE06Output> => {
  const phase = input.phase;
  if (phase !== 'SCAN' && phase !== 'CHUNK_PARSE') {
    throw new Error('CE06_PHASE_REQUIRED: phase must be SCAN or CHUNK_PARSE');
  }

  const structuredText = asNonEmptyString(input.structured_text);
  if (!structuredText) {
    throw new Error('CE06_TEXT_REQUIRED: structured_text must be non-empty');
  }

  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing API Key for CE06 Real Engine');

  if (phase === 'SCAN') {
    return executeScanPhase(input, structuredText);
  } else {
    const modelName = asNonEmptyString(input.model) ?? asNonEmptyString(input.options?.model);
    if (!modelName) {
      throw new Error('CE06_MODEL_REQUIRED: chunk parsing requires an explicit model');
    }

    if (input.multi_agent) {
      return runMultiAgentAnalysis(structuredText, key, modelName);
    }
    return executeChunkParsePhase(input, structuredText, key, modelName);
  }
};

async function executeScanPhase(input: CE06Input, structuredText: string): Promise<CE06Output> {
  const volumes = scanVolumes(structuredText);
  return {
    volumes,
    chapters: [],
    scenes: [],
    billing_usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'manual-regex' },
    audit_trail: {
      engineVersion: 'ce06-real-v1.3.1',
      timestamp: new Date().toISOString(),
      traceId: asNonEmptyString(input.traceId),
    },
  };
}

async function executeChunkParsePhase(
  input: CE06Input,
  chapterText: string,
  apiKey: string,
  modelName: string
): Promise<CE06Output> {
  const systemPrompt = `You are a professional Screenwriter. Split the following chapter into scenes for a movie production. For each scene, capture the location, characters, and key actions.
Your output MUST be a JSON object with a "scenes" array. Each scene MUST have "title", "visual_prompt", and "characters" (list of character objects with "name" and "appearance").`;

  const genAI = new GoogleGenerativeAI(apiKey);
  // @ts-ignore - v1beta options might not be in older types
  const model = genAI.getGenerativeModel(
    {
      model: modelName,
    },
    { apiVersion: 'v1beta' }
  );

  try {
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nChapter Text:\n${chapterText}` }] },
      ],
      // @ts-ignore
      generationConfig: { responseMimeType: 'application/json' },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const output = JSON.parse(result.response.text());

    const billing: EngineBillingUsage = {
      // @ts-ignore
      promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
      // @ts-ignore
      completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
      // @ts-ignore
      totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
      model: modelName,
    };

    return {
      volumes: [],
      chapters: [],
      scenes: output.scenes || [],
      billing_usage: billing,
      audit_trail: {
        engineVersion: 'ce06-real-v1.5.0-sdk',
        timestamp: new Date().toISOString(),
        traceId: asNonEmptyString(input.traceId),
      },
    };
  } catch (error: any) {
    throw error;
  }
}
