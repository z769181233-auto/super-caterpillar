export interface CharacterTrait {
    name: string;
    value: number; // 0.0 to 1.0
    description: string;
}

export interface CE08Input {
    character_name: string;
    scenario_text: string;
    previous_state?: {
        emotional_stability: number;
        internal_conflict: number;
        resolve: number;
        traits: CharacterTrait[];
    };
    context?: {
        projectId: string;
        [key: string]: any;
    };
}

export interface CE08Output {
    character_name: string;
    archetype: string;
    current_state: {
        emotional_stability: number;
        internal_conflict: number;
        resolve: number;
        traits: CharacterTrait[];
    };
    progression_markers: string[]; // e.g., 'REALIZATION', 'BREAKTHROUGH', 'FALL'
    arc_status: 'STATIC' | 'DEVELOPING' | 'TRANSFORMING';
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
