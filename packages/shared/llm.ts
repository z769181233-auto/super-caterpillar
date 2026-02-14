/**
 * 通用 LLM 客户端工具类
 * 
 * 功能：
 * - 支持 OpenAI 和 Anthropic 供应商
 * - 自动重试与指数退避机制
 * - 统一的错误处理
 */

export interface LLMRequestOptions {
    provider: 'openai' | 'anthropic';
    model: string;
    apiKey: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json_object' | 'text';
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    raw: any;
}

export class LLMClient {
    private maxRetries: number;
    private retryDelay: number;

    constructor(options: { maxRetries?: number; retryDelay?: number } = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
    }

    /**
     * 发送 LLM 请求（带重试机制）
     */
    async chat(options: LLMRequestOptions): Promise<LLMResponse> {
        // 允许通过环境变量或配置强制启用 Mock 模式
        const isMockMode = process.env.LLM_MOCK_MODE === '1' || options.apiKey === 'MOCK_KEY';
        if (isMockMode) {
            return this.getMockResponse(options);
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                if (options.provider === 'openai') {
                    return await this.callOpenAI(options);
                } else if (options.provider === 'anthropic') {
                    return await this.callAnthropic(options);
                }
                throw new Error(`Unsupported LLM provider: ${options.provider}`);
            } catch (error: any) {
                lastError = error;
                console.warn(`[LLMClient] Attempt ${attempt + 1} failed: ${error.message}`);

                if (attempt < this.maxRetries - 1) {
                    const delay = this.retryDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('LLM request failed after retries');
    }

    private getMockResponse(options: LLMRequestOptions): LLMResponse {
        const userMessage = options.messages.find(m => m.role === 'user')?.content || '';
        const systemMessage = options.messages.find(m => m.role === 'system')?.content || '';

        console.log(`[LLMClient MOCK] Received request for ${options.model}`);

        // CE03 Visual Density Mock
        if (systemMessage.includes('视觉评估') || systemMessage.includes('视觉密度')) {
            let score = 0.5;
            // 简单的内容识别
            if (userMessage.includes('彩色玻璃') || userMessage.includes('尘埃')) score = 0.9;
            else if (userMessage.includes('桌子') || userMessage.includes('阳光')) score = 0.6;
            else if (userMessage.includes('人生虚无')) score = 0.2;

            return {
                content: JSON.stringify({
                    score,
                    indicators: {
                        lighting: score,
                        texture: Math.max(0, score - 0.1),
                        composition: Math.min(1.0, score + 0.1)
                    }
                }),
                usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
                raw: { mock: true }
            };
        }

        // CE04 Visual Enrichment Mock
        if (systemMessage.includes('提示词工程师') || systemMessage.includes('视觉增强')) {
            const prompt = `Cinematic ${options.model === 'anthropic' ? 'Anthropic' : 'OpenAI'} Masterpiece: ${userMessage.slice(0, 30)}..., volumetric lighting, 8k, highly detailed.`;
            return {
                content: JSON.stringify({
                    enriched_prompt: prompt,
                    prompt_parts: {
                        style: "Cinematic",
                        lighting: "Volumetric lighting",
                        composition: "Golden hour",
                        detail: "Highly detailed texture"
                    }
                }),
                usage: { promptTokens: 150, completionTokens: 80, totalTokens: 230 },
                raw: { mock: true }
            };
        }

        // CE13 Pacing Analyzer Mock
        if (systemMessage.includes('电影剪辑师') || systemMessage.includes('叙事节奏')) {
            let pacing = 0.5;
            if (userMessage.length < 20) pacing = 0.8; // 短句节奏快

            return {
                content: JSON.stringify({
                    pacing_score: pacing,
                    emotional_intensity: 0.75,
                    tension_level: pacing > 0.7 ? "high" : "medium",
                    indicators: {
                        sentence_avg_length: Math.round(50 * (1 - pacing)),
                        action_verb_density: pacing * 0.5,
                        emotional_keywords_count: 3
                    }
                }),
                usage: { promptTokens: 120, completionTokens: 60, totalTokens: 180 },
                raw: { mock: true }
            };
        }

        // VG04 Camera Path Mock
        if (systemMessage.includes('摄影指导') || systemMessage.includes('运镜')) {
            const mode = userMessage.includes('跑') ? 'dolly' : 'pan';
            return {
                content: JSON.stringify({
                    mode,
                    reason: `为表现"${userMessage.slice(0, 10)}..."使用的${mode}运动`
                }),
                usage: { promptTokens: 100, completionTokens: 40, totalTokens: 140 },
                raw: { mock: true }
            };
        }

        // VG03 Lighting Engine Mock
        if (systemMessage.includes('电影灯光师') || systemMessage.includes('光照')) {
            const preset = userMessage.includes('夜') ? 'night' : 'cinematic';
            return {
                content: JSON.stringify({
                    preset,
                    parameters: {
                        brightness: preset === 'night' ? -0.2 : 0,
                        contrast: 1.2,
                        gamma: 0.9,
                        saturation: 1.1
                    },
                    reason: `基于氛围"${userMessage.slice(0, 10)}..."设计的${preset}光效`
                }),
                usage: { promptTokens: 90, completionTokens: 50, totalTokens: 140 },
                raw: { mock: true }
            };
        }

        // Scene Composition Mock
        if (systemMessage.includes('电影分镜师') || systemMessage.includes('构图')) {
            return {
                content: JSON.stringify({
                    mode: "rule_of_thirds",
                    elements: [
                        { id: "subject", x: 33, y: 50, scale: 1.2 }
                    ],
                    reason: "依据三分法原则平衡画面重心"
                }),
                usage: { promptTokens: 150, completionTokens: 70, totalTokens: 220 },
                raw: { mock: true }
            };
        }

        // CE08 Character Arc Mock
        if (systemMessage.includes('心理分析师') || systemMessage.includes('角色弧光')) {
            return {
                content: JSON.stringify({
                    archetype: "成长者",
                    current_state: {
                        emotional_stability: 0.6,
                        internal_conflict: 0.4,
                        resolve: 0.8,
                        traits: [
                            { "name": "courage", "value": 0.9, "description": "面对挑战毫不退缩" }
                        ]
                    },
                    progression_markers: ["GROWTH", "RESOLVE"],
                    arc_status: "DEVELOPING",
                    reason: `角色在"${userMessage.slice(0, 10)}..."中表现出了显著的内在觉醒`
                }),
                usage: { promptTokens: 110, completionTokens: 100, totalTokens: 210 },
                raw: { mock: true }
            };
        }

        // VG05 VFX Compositor Mock
        if (systemMessage.includes('后期调色师') || systemMessage.includes('特效')) {
            const vfx = userMessage.includes('电脑') ? 'glitch' : 'grain';
            return {
                content: JSON.stringify({
                    vfx_preset: vfx,
                    intensity: 0.6,
                    reason: `为匹配场景氛围"${userMessage.slice(0, 10)}..."选用的${vfx}特效`
                }),
                usage: { promptTokens: 100, completionTokens: 60, totalTokens: 160 },
                raw: { mock: true }
            };
        }

        // Generic JSON Mock
        if (options.responseFormat === 'json_object') {
            return {
                content: JSON.stringify({ result: "mocked success" }),
                usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
                raw: { mock: true }
            };
        }

        return {
            content: "Mocked plain text response.",
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            raw: { mock: true }
        };
    }

    private async callOpenAI(options: LLMRequestOptions): Promise<LLMResponse> {
        // 使用 global fetch (Node 18+)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model,
                messages: options.messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens,
                response_format: options.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
            raw: data,
        };
    }

    private async callAnthropic(options: LLMRequestOptions): Promise<LLMResponse> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': options.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: options.model,
                max_tokens: options.maxTokens || 4096,
                messages: options.messages.filter(m => m.role !== 'system'),
                system: options.messages.find(m => m.role === 'system')?.content,
                temperature: options.temperature ?? 0.7,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return {
            content: data.content[0].text,
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            } : undefined,
            raw: data,
        };
    }
}
