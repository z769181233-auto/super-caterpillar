
import {
    EngineAdapter,
    EngineInvokeInput,
    EngineInvokeResult,
    EngineInvokeStatus,
    CE03VisualDensityInput,
    CE03VisualDensityOutput,
} from '@scu/shared-types';

/**
 * Visual Density Local Adapter (Worker Side)
 * CE03: 计算视觉密度指标
 */
export class VisualDensityLocalAdapterWorker implements EngineAdapter {
    public readonly name = 'ce03_visual_density';

    supports(engineKey: string): boolean {
        return engineKey === this.name;
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        const startTime = Date.now();
        try {
            const payload = input.payload as CE03VisualDensityInput;
            const scenes = JSON.parse(payload.structured_text);

            let totalTokens = 0;
            let totalKeywords = 0;

            // 简单的关键词列表
            const keywords = ['light', 'shadow', 'color', 'dark', 'bright', 'red', 'blue', 'green', 'texture'];

            // 计算指标
            if (Array.isArray(scenes)) {
                scenes.forEach((scene: any) => {
                    const text = JSON.stringify(scene);
                    totalTokens += text.split(/\s+/).length;

                    keywords.forEach(kw => {
                        const regex = new RegExp(kw, 'gi');
                        const matches = text.match(regex);
                        if (matches) {
                            totalKeywords += matches.length;
                        }
                    });
                });
            }

            const visualDensityScore = totalTokens > 0 ? (totalKeywords / totalTokens) * 100 : 0;

            const output: CE03VisualDensityOutput = {
                visual_density_score: Math.min(visualDensityScore, 100), // Cap at 100
                quality_indicators: {
                    token_count: totalTokens,
                    keyword_count: totalKeywords,
                    keyword_ratio: visualDensityScore / 100
                },
                audit_trail: JSON.stringify({
                    message: `Calculated density: ${visualDensityScore.toFixed(2)}% (${totalKeywords}/${totalTokens})`,
                    metrics: { totalTokens, totalKeywords }
                }),
                engine_version: '1.0.0',
                latency_ms: 0
            };

            const duration = Date.now() - startTime;
            output.latency_ms = duration; // Update latency

            return {
                status: 'SUCCESS' as EngineInvokeStatus,
                output,
                metrics: {
                    durationMs: duration,
                },
            };

        } catch (error: any) {
            return {
                status: 'FAILED' as EngineInvokeStatus,
                error: {
                    message: error.message,
                    code: 'VISUAL_DENSITY_ERROR',
                    details: error.stack
                },
                metrics: {
                    durationMs: Date.now() - startTime
                }
            };
        }
    }
}
