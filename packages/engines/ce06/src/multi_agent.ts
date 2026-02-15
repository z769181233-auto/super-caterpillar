import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { CE06Output, EngineBillingUsage } from '../types';

/**
 * Multi-Agent Orchestrator for CE06
 * B1 Implementation: Three-role collaboration
 */
export async function runMultiAgentAnalysis(
  chapterText: string,
  apiKey: string,
  modelName: string = 'gemini-1.5-flash'
): Promise<CE06Output> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
  });

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  const billing: EngineBillingUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    model: modelName,
  };

  try {
    // 1. SCREENWRITER AGENT
    const draftPrompt = `Role: Screenwriter Agent\nTask: Split the provided chapter into logical cinematic scenes. Rule: Every scene must have a unique title and capture a continuous action in one location.\nYour output MUST follow this JSON schema:\n{"scenes": [{"title": "...", "raw_text": "..."}]}\n\nInput:\nChapter Text:\n${chapterText}`;
    const draftResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: draftPrompt }] }],
      // @ts-ignore
      generationConfig: { responseMimeType: 'application/json' },
      safetySettings,
    });
    const draftData = JSON.parse(draftResult.response.text());
    // @ts-ignore
    updateBilling(billing, draftResult.response.usageMetadata);

    const scenes = draftData.scenes || [];
    console.log(`[CE06_MULTI_AGENT] Screenwriter Agent produced ${scenes.length} scenes.`);

    // 2. DIRECTOR AGENT
    const visualPrompt = `Role: Director Agent\nTask: Enrich the visual descriptions for each scene. Focus: Lighting, camera angles, color palette, and character visual states. Constraint: You MUST provide "visual_prompt", "camera_movement", and "action_description" for EVERY scene. Requirement: Characters MUST contain "id", "name", and detailed "appearance" (clothing, hair).\nYour output MUST follow this JSON schema:\n{"scenes": [{"title": "...", "raw_text": "...", "visual_prompt": "cinematic photography of...", "camera_movement": "pan left", "action_description": "walking...", "visual_density_score": 0.8, "characters": [{"name": "...", "appearance": {"clothing": "...", "hair": "..."}}]}]}\n\nInput:\nScenes to process:\n${JSON.stringify(scenes)}`;
    const visualResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: visualPrompt }] }],
      // @ts-ignore
      generationConfig: { responseMimeType: 'application/json' },
      safetySettings,
    });
    const visualData = JSON.parse(visualResult.response.text());
    // @ts-ignore
    updateBilling(billing, visualResult.response.usageMetadata);

    // 3. AUDITOR AGENT
    const auditPrompt = `Role: Auditor Agent\nTask: Review the scenes for consistency and character identity preservation. Rule: Ensure no character description contradicts earlier scenes. Fix any JSON formatting issues. Check: Make sure visual_prompt and camera_movement are present and high quality.\nYour output MUST follow this JSON schema:\n{"scenes": [{"title": "...", "raw_text": "...", "visual_prompt": "...", "camera_movement": "...", "action_description": "...", "visual_density_score": 0.8, "characters": [...]}]}\n\nInput:\nFull Scenes Output:\n${JSON.stringify(visualData.scenes)}`;
    const auditResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: auditPrompt }] }],
      // @ts-ignore
      generationConfig: { responseMimeType: 'application/json' },
      safetySettings,
    });
    const auditData = JSON.parse(auditResult.response.text());
    // @ts-ignore
    updateBilling(billing, auditResult.response.usageMetadata);

    return {
      volumes: [],
      chapters: [],
      scenes: auditData.scenes || [],
      billing_usage: billing,
      audit_trail: {
        engineVersion: 'ce06-multi-agent-v1.5.0-sdk',
        timestamp: new Date().toISOString(),
        agents: ['Screenwriter', 'Director', 'Auditor'],
        agent_sequence: 'DRAFT -> VISUAL -> AUDIT',
      },
    };
  } catch (error: any) {
    console.error(`[CE06_MULTI_AGENT] SDK Error: ${error.message}`);
    throw error;
  }
}

function updateBilling(
  total: EngineBillingUsage,
  metadata?: any
) {
  if (metadata) {
    total.promptTokens += metadata.promptTokenCount || 0;
    total.completionTokens += metadata.candidatesTokenCount || 0;
    total.totalTokens += metadata.totalTokenCount || 0;
  }
}
