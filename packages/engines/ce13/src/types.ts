export interface CE13Input {
    structured_text: string;
    context?: {
        projectId: string;
        [key: string]: any;
    };
}

export interface CE13Output {
    pacing_score: number; // 0.0 - 1.0, 越快则得分越高
    emotional_intensity: number; // 0.0 - 1.0
    tension_level: 'low' | 'medium' | 'high' | 'extreme';
    indicators: {
        sentence_avg_length: number;
        action_verb_density: number;
        emotional_keywords_count: number;
    };
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
