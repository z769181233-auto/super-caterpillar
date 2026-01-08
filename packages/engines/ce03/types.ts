
export interface CE03Input {
    structured_text: string;
    context?: {
        projectId: string;
        [key: string]: any;
    };
}

export interface EngineBillingUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
}

export interface CE03Output {
    visual_density_score: number;
    quality_indicators: {
        text_length: number;
        adjective_count: number;
        lighting_keywords: number;
        camera_keywords: number;
    };
    audit_trail: {
        engine_version: string;
        timestamp: string;
        input_hash?: string;
    };
    billing_usage?: EngineBillingUsage;
}
