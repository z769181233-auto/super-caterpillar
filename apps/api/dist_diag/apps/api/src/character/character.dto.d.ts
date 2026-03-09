export declare class CreateCharacterDto {
    name: string;
    nameEn?: string;
    role?: string;
    description?: string;
    baseImageUrl?: string;
    basePrompt?: string;
    attributes: {
        age?: number;
        gender?: string;
        ethnicity?: string;
        clothing?: string;
        hairstyle?: string;
        accessories?: string[];
        [key: string]: any;
    };
    timeline?: Array<{
        episodeId: string;
        changes: Record<string, any>;
    }>;
}
export declare class UpdateCharacterDto {
    name?: string;
    nameEn?: string;
    role?: string;
    description?: string;
    baseImageUrl?: string;
    basePrompt?: string;
    attributes?: Record<string, any>;
    timeline?: Array<{
        episodeId: string;
        changes: Record<string, any>;
    }>;
    loraModelId?: string;
    loraTrainingStatus?: string;
}
export declare class RecordAppearanceDto {
    shotId: string;
    renderedImageUrl: string;
    promptUsed?: string;
    consistencyScore?: number;
}
export declare class TrainLoraDto {
    minConsistencyScore?: number;
    forceRetrain?: boolean;
}
