
import {
    EngineAdapter,
    EngineInvokeInput,
    EngineInvokeResult,
    EngineInvokeStatus,
    CE04VisualEnrichmentInput,
    CE04VisualEnrichmentOutput,
} from '@scu/shared-types';

/**
 * Visual Enrichment Local Adapter (Worker Side)
 * CE04: 视觉丰富度计算与扩展
 */
export class VisualEnrichmentLocalAdapterWorker implements EngineAdapter {
    public readonly name = 'ce04_visual_enrichment';

    supports(engineKey: string): boolean {
        return engineKey === this.name;
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        const startTime = Date.now();
        try {
            const payload = input.payload as CE04VisualEnrichmentInput;
            let parsedInput: any;
            try {
                parsedInput = JSON.parse(payload.structured_text || '{}');
            } catch {
                parsedInput = {};
            }

            // P2 Logic: Support两种输入模式
            // 1) metadata object (from CE03): has keyword_ratio
            // 2) scenes array (from job payload): calculate enrichment from text length
            let densityScore = 0;

            if (Array.isArray(parsedInput)) {
                // Mode 1: Text/Scenes array - calculate enrichment from content richness
                const totalText = parsedInput.join(' ');
                const wordCount = totalText.split(/\s+/).length;
                // Simple heuristic: longer text = higher base density
                densityScore = Math.min(wordCount * 5, 100); // 5% per word, cap at 100
            } else if (parsedInput.keyword_ratio !== undefined) {
                // Mode 2: Metadata object from CE03
                densityScore = parsedInput.keyword_ratio ? parsedInput.keyword_ratio * 100 : 0;
            } else {
                // Fallback: assume moderate density
                densityScore = 20;
            }

            // Simple logic: if density is low, enrich more
            const enrichmentFactor = densityScore < 10 ? 2.0 : 1.2;
            const enrichmentQuality = Math.min(densityScore * enrichmentFactor, 100);

            const output: CE04VisualEnrichmentOutput = {
                enrichment_quality: enrichmentQuality,
                metadata: {
                    original_density: densityScore,
                    enrichment_factor: enrichmentFactor,
                    expanded_keywords: ['cinematic', 'detailed', '4k', 'unreal engine']
                },
                audit_trail: JSON.stringify({
                    message: `Enriched with factor ${enrichmentFactor}, quality: ${enrichmentQuality.toFixed(2)}`,
                    metrics: { densityScore, enrichmentFactor }
                }),
                enriched_text: JSON.stringify({
                    ...parsedInput,
                    expanded_keywords: ['cinematic', 'detailed', '4k', 'unreal engine']
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
                    code: 'VISUAL_ENRICHMENT_ERROR',
                    details: error.stack
                },
                metrics: {
                    durationMs: Date.now() - startTime
                }
            };
        }
    }
}
