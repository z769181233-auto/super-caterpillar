import axios from 'axios';
import { CE06Output, EngineBillingUsage } from '../types';

/**
 * Multi-Agent Orchestrator for CE06
 * B1 Implementation: Three-role collaboration
 */
export async function runMultiAgentAnalysis(
    chapterText: string,
    apiKey: string,
    model: string = 'gemini-1.5-flash'
): Promise<CE06Output> {
    const billing: EngineBillingUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: model,
    };

    try {
        // 1. SCREENWRITER AGENT: Focuses on plot structure and scene partitioning
        const draftResult = await callAgent(
            apiKey,
            model,
            'Screenwriter Agent',
            `You are an expert Screenwriter. 
       Task: Split the provided chapter into logical cinematic scenes.
       Rule: Every scene must have a unique title and capture a continuous action in one location.`,
            `Chapter Text:\n${chapterText}`,
            '{"scenes": [{"title": "...", "raw_text": "..."}]}'
        );
        updateBilling(billing, draftResult.usage);

        const scenes = draftResult.data.scenes || [];
        console.log(`[CE06_MULTI_AGENT] Screenwriter Agent produced ${scenes.length} scenes.`);

        // 2. DIRECTOR AGENT: Focuses on visual atmosphere and character appearance
        const visualResult = await callAgent(
            apiKey,
            model,
            'Director Agent',
            `You are a Film Director. 
       Task: Enrich the visual descriptions for each scene.
       Focus: Lighting, camera angles, color palette, and character visual states.
       Requirement: Use "enriched_text" for cinematics and "visual_density_score" (0.0-1.0).`,
            `Scenes to process:\n${JSON.stringify(scenes)}`,
            '{"scenes": [{"title": "...", "raw_text": "...", "enriched_text": "...", "visual_density_score": 0.8, "characters": [{"name": "...", "appearance": "..."}]}]}'
        );
        updateBilling(billing, visualResult.usage);

        // 3. AUDITOR AGENT: Final quality check
        const auditResult = await callAgent(
            apiKey,
            model,
            'Auditor Agent',
            `You are a Quality Auditor.
       Task: Review the scenes for consistency and character identity preservation.
       Rule: Ensure no character description contradicts earlier scenes. Fix any JSON formatting issues.`,
            `Full Scenes Output:\n${JSON.stringify(visualResult.data.scenes)}`,
            '{"scenes": [{"title": "...", "raw_text": "...", "enriched_text": "...", "visual_density_score": 0.8, "characters": [...]}]}'
        );
        updateBilling(billing, auditResult.usage);

        return {
            volumes: [],
            chapters: [],
            scenes: auditResult.data.scenes || [],
            billing_usage: billing,
            audit_trail: {
                engineVersion: 'ce06-multi-agent-v1.4.1',
                timestamp: new Date().toISOString(),
                agents: ['Screenwriter', 'Director', 'Auditor'],
                agent_sequence: 'DRAFT -> VISUAL -> AUDIT',
            },
        };
    } catch (error: any) {
        console.error(`[CE06_MULTI_AGENT] Error: ${error.message}`);
        throw error;
    }
}

async function callAgent(
    apiKey: string,
    model: string,
    role: string,
    systemPrompt: string,
    userMessage: string,
    jsonSchema: string
) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    const fullPrompt = `Role: ${role}\n${systemPrompt}\n\nYour output MUST follow this JSON schema:\n${jsonSchema}\n\nInput:\n${userMessage}`;

    const response = await axios.post(
        url,
        {
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        },
        { timeout: 90000 }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const data = JSON.parse(rawText);

    return {
        data,
        usage: {
            promptTokens: response.data?.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.data?.usageMetadata?.candidatesTokenCount || 0,
        },
    };
}

function updateBilling(total: EngineBillingUsage, delta: { promptTokens: number; completionTokens: number }) {
    total.promptTokens += delta.promptTokens;
    total.completionTokens += delta.completionTokens;
    total.totalTokens += delta.promptTokens + delta.completionTokens;
}
