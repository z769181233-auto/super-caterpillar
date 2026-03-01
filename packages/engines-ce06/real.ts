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

export const ce06RealEngine = async (input: CE06Input, apiKey?: string): Promise<CE06Output> => {
  const phase = input.phase || 'SCAN';
  console.log(`[CE06_REAL] Executing Phase: ${phase}`);

  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing API Key for CE06 Real Engine');

  if (phase === 'SCAN') {
    return executeScanPhase(input);
  } else {
    // Check if multi-agent is enabled in input
    if (input.multi_agent) {
      return runMultiAgentAnalysis(input.structured_text, key, input.model || 'gemini-1.5-flash');
    }
    return executeChunkParsePhase(input, key);
  }
};

async function executeScanPhase(input: CE06Input): Promise<CE06Output> {
  const volumes = scanVolumes(input.structured_text);
  return {
    volumes,
    chapters: [],
    scenes: [],
    billing_usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'manual-regex' },
    audit_trail: {
      engineVersion: 'ce06-real-v1.3.1',
      timestamp: new Date().toISOString(),
      traceId: input.traceId || 'none',
    },
  };
}

async function executeChunkParsePhase(input: CE06Input, apiKey: string): Promise<CE06Output> {
  const chapterText = input.structured_text;
  let modelName = input.model || 'gemini-1.5-flash';
  console.log(`[CE06_REAL_DIAGNOSTIC] ${new Date().toISOString()} - Original Model: ${modelName}`);

  if (modelName === 'gemini-1.5-flash') {
    // modelName = 'gemini-flash-latest';
    // console.log(`[CE06_REAL_DIAGNOSTIC] Mapped to: ${modelName}`);
  }

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
        traceId: input.traceId || 'none',
      },
    };
  } catch (error: any) {
    console.error(`[CE06_REAL] SDK Error: ${error.message}`);
    throw error;
  }
}
