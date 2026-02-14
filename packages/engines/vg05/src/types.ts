export type VFXPreset = 'grain' | 'vignette' | 'sepia' | 'scanlines' | 'bloom' | 'glitch' | 'dreamy' | 'none';

export interface VG05Input {
    scene_context: string;
    pacing_score?: number;
    emotional_intensity?: number;
    sourceUrl?: string;
    context?: {
        projectId: string;
        [key: string]: any;
    };
}

export interface VG05Output {
    vfx_preset: VFXPreset;
    intensity: number; // 0.0 to 1.0
    filter_string: string; // FFmpeg filter string
    description: string;
    audit_trail: {
        engine_version: string;
        timestamp: string;
    };
    billing_usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        model: string;
    };
}
