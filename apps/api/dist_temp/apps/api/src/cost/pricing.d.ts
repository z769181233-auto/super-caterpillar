export declare const PRICING_SSOT: {
    readonly REPLICATE_SDXL_COST_PER_IMAGE_USD: 0.0032;
    readonly REPLICATE_SDXL_AVG_GPU_SECONDS: 2.5;
    readonly ELEVENLABS_TTS_COST_PER_1K_CHARS_USD: 0.3;
    readonly SUNO_BGM_COST_PER_TRACK_USD: 0.1;
};
export declare function getEngineCost(engineKey: string, provider: string, usage: {
    imageCount?: number;
    audioSeconds?: number;
}): number;
