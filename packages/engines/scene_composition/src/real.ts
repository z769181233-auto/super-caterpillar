import { CompositionInput, CompositionOutput, CompositionElement } from './types';
import { LLMClient } from '@scu/shared';

/**
 * Scene Composition Engine - Real Implementation
 * 
 * Uses AI to decide the best position and scale for each element.
 */
export async function sceneCompositionRealEngine(input: CompositionInput): Promise<CompositionOutput> {
    const elements = input.elements || [];
    const sceneDesc = input.scene_description || '';

    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const isAiMode = !!apiKey && process.env.ENABLE_SCENE_COMP_AI === '1';

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
                        content: `你是一个专业的电影分镜师。请根据场景描述和提供的图层元素，决定每个图层在 100x100 坐标系中的位置 (x, y) 和缩放比例 (scale)。
x: 0 (左) - 100 (右)
y: 0 (上) - 100 (下)
scale: 0.1 - 2.0 (1.0 为原大小)

请遵循美学构图规律（如三分法、中心构图等）。
返回格式为 JSON：
{
  "mode": "rule_of_thirds",
  "elements": [
    { "id": "element-id", "x": 33, "y": 50, "scale": 1.2 }
  ],
  "reason": "将主体放在黄金分割点..."
}`,
                    },
                    {
                        role: 'user',
                        content: `场景描述：${sceneDesc}\n元素列表：${JSON.stringify(elements.map(e => ({ id: e.id, desc: e.description })))}`,
                    },
                ],
                temperature: 0.1,
                responseFormat: 'json_object',
            });

            const result = JSON.parse(response.content);
            const outputElements = elements.map(e => {
                const decision = result.elements.find((d: any) => d.id === e.id) || {};
                return {
                    ...e,
                    x: decision.x ?? 50,
                    y: decision.y ?? 50,
                    scale: decision.scale ?? 1.0,
                    depth_layer: e.depth_layer ?? 1
                } as Required<CompositionElement>;
            });

            return {
                background_url: input.background_url,
                elements: outputElements,
                composition_mode: result.mode || 'custom',
                description: result.reason || sceneDesc,
                audit_trail: {
                    engine_version: `real-v1-ai-${model}`,
                    timestamp: new Date().toISOString(),
                },
                billing_usage: response.usage ? { ...response.usage, model } : undefined,
            };
        } catch (error: any) {
            console.warn(`[SceneComposition] AI composition failed, falling back to rule logic: ${error.message}`);
        }
    }

    // Fallback Rule-based logic (Uniform Centering)
    const outputElements = elements.map((e, i) => ({
        ...e,
        x: 50 + (i * 10),
        y: 50,
        scale: 1.0,
        depth_layer: e.depth_layer ?? 1
    } as Required<CompositionElement>));

    return {
        background_url: input.background_url,
        elements: outputElements,
        composition_mode: 'centered_fallback',
        description: `Fallback: centered`,
        audit_trail: {
            engine_version: 'real-v1-fallback',
            timestamp: new Date().toISOString(),
        },
    };
}
