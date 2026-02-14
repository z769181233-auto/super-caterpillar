export type LightingPreset = 'neutral' | 'night' | 'bright' | 'sunset' | 'cinematic' | 'horror' | 'ethereal';

export interface VG03Input {
    mood_description: string;
    lighting_preset?: LightingPreset;
    sourceUrl?: string; // Optional source image path
    context?: {
        projectId: string;
        [key: string]: any;
    };
}

export interface VG03Output {
    preset: LightingPreset;
    parameters: {
        brightness: number; // -1.0 to 1.0
        contrast: number;   // -1.0 to 1.0
        gamma: number;      // 0.1 to 10.0
        saturation: number; // 0.0 to 3.0
    };
    filter_string: string; // FFmpeg eq filter string
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
