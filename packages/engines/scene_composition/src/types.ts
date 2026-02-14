export interface CompositionElement {
    id: string;
    url: string;
    description: string; // Description of the element for LLM
    x?: number;
    y?: number;
    scale?: number;
    depth_layer?: number; // 0: background, 1+: foreground
}

export interface CompositionInput {
    scene_description: string;
    background_url: string;
    elements: CompositionElement[];
    aspect_ratio?: '16:9' | '9:16' | '1:1';
    context?: {
        projectId: string;
        [key: string]: any;
    };
}

export interface CompositionOutput {
    background_url: string;
    elements: Array<Required<CompositionElement>>;
    composition_mode: string; // e.g., 'rule_of_thirds', 'centered', 'symmetric'
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
