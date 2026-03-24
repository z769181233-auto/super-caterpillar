export interface CE06NovelParsingInput {
    structured_text: string;
    context: {
        projectId: string;
        novelSourceId?: string;
    };
}
export interface CE06NovelParsingOutput {
    volumes: Array<{
        id: string;
        title: string;
        chapters: Array<{
            id: string;
            title: string;
            scenes: Array<{
                id: string;
                title: string;
                content: string;
            }>;
        }>;
    }>;
    chapters?: Array<any>;
    scenes?: Array<any>;
    parsing_quality: number;
    audit_trail: string;
    engine_version: string;
    latency_ms: number;
}
export interface CE03VisualDensityInput {
    structured_text: string;
    context: {
        projectId: string;
        sceneId?: string;
        episodeId?: string;
    };
}
export interface CE03VisualDensityOutput {
    visual_density_score: number;
    quality_indicators: Record<string, any>;
    audit_trail: string;
    engine_version: string;
    latency_ms: number;
}
export interface CE04VisualEnrichmentInput {
    structured_text: string;
    context: {
        projectId: string;
        sceneId?: string;
        shotId?: string;
    };
}
export interface CE04VisualEnrichmentOutput {
    enriched_text: string;
    enriched_prompt: string;
    prompt_parts: {
        style?: string;
        lighting?: string;
        camera?: string;
        composition?: string;
        negatives?: string;
        seed?: number;
    };
    enrichment_quality: number;
    metadata: Record<string, any>;
    audit_trail: string;
    engine_version: string;
    latency_ms: number;
}
export interface CE07MemoryUpdateInput {
    current_text: string;
    previous_memory?: {
        summary: string;
        character_states: Record<string, any>;
    };
    context: {
        projectId: string;
        chapterId?: string;
        sceneId?: string;
    };
}
export interface CE07MemoryUpdateOutput {
    summary: string;
    character_states: Record<string, any>;
    key_facts: string[];
    audit_trail: string;
    engine_version: string;
    latency_ms: number;
}
