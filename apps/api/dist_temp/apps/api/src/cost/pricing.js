"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICING_SSOT = void 0;
exports.getEngineCost = getEngineCost;
exports.PRICING_SSOT = {
    REPLICATE_SDXL_COST_PER_IMAGE_USD: 0.0032,
    REPLICATE_SDXL_AVG_GPU_SECONDS: 2.5,
    ELEVENLABS_TTS_COST_PER_1K_CHARS_USD: 0.3,
    SUNO_BGM_COST_PER_TRACK_USD: 0.1,
};
function getEngineCost(engineKey, provider, usage) {
    if (engineKey === 'shot_render' && provider === 'replicate') {
        return (usage.imageCount || 0) * exports.PRICING_SSOT.REPLICATE_SDXL_COST_PER_IMAGE_USD;
    }
    if (engineKey === 'shot_render' && provider === 'local') {
        return 0;
    }
    return 0;
}
//# sourceMappingURL=pricing.js.map