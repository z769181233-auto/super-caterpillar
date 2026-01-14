/**
 * Pricing SSOT (Phase 0-R)
 * 
 * Single Source of Truth for engine pricing
 * Used by CostLimitService for accurate cost calculation
 */

export const PRICING_SSOT = {
    // Replicate SDXL
    REPLICATE_SDXL_COST_PER_IMAGE_USD: 0.0032,

    // GPU seconds estimation
    REPLICATE_SDXL_AVG_GPU_SECONDS: 2.5,

    // Future engines (placeholder)
    ELEVENLABS_TTS_COST_PER_1K_CHARS_USD: 0.30,
    SUNO_BGM_COST_PER_TRACK_USD: 0.10,
} as const;

/**
 * Get cost for specific engine/provider
 */
export function getEngineCost(
    engineKey: string,
    provider: string,
    usage: { imageCount?: number; audioSeconds?: number }
): number {
    // Shot Render - Replicate
    if (engineKey === 'shot_render' && provider === 'replicate') {
        return (usage.imageCount || 0) * PRICING_SSOT.REPLICATE_SDXL_COST_PER_IMAGE_USD;
    }

    // Shot Render - Local (free)
    if (engineKey === 'shot_render' && provider === 'local') {
        return 0;
    }

    // Default: 0 for unknown
    return 0;
}
