import { CharacterService } from './character.service';
import { CreateCharacterDto, UpdateCharacterDto, RecordAppearanceDto, TrainLoraDto } from './character.dto';
export declare class CharacterController {
    private readonly characterService;
    constructor(characterService: CharacterService);
    create(projectId: string, dto: CreateCharacterDto): Promise<{
        role: string | null;
        id: string;
        createdAt: Date;
        name: string;
        description: string | null;
        updatedAt: Date;
        projectId: string;
        nameEn: string | null;
        baseImageUrl: string | null;
        basePrompt: string | null;
        attributes: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        timeline: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        loraModelId: string | null;
        loraTrainingStatus: string | null;
        loraLastTrained: Date | null;
        totalShots: number;
        avgConsistencyScore: number | null;
    }>;
    findAll(projectId: string): Promise<{
        role: string | null;
        id: string;
        createdAt: Date;
        name: string;
        description: string | null;
        updatedAt: Date;
        projectId: string;
        nameEn: string | null;
        baseImageUrl: string | null;
        basePrompt: string | null;
        attributes: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        timeline: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        loraModelId: string | null;
        loraTrainingStatus: string | null;
        loraLastTrained: Date | null;
        totalShots: number;
        avgConsistencyScore: number | null;
    }[]>;
    findOne(characterId: string): Promise<{
        appearances: {
            id: string;
            createdAt: Date;
            shotId: string;
            consistencyScore: number | null;
            characterId: string;
            renderedImageUrl: string;
            promptUsed: string | null;
            evaluatedAt: Date | null;
            usedForTraining: boolean;
        }[];
    } & {
        role: string | null;
        id: string;
        createdAt: Date;
        name: string;
        description: string | null;
        updatedAt: Date;
        projectId: string;
        nameEn: string | null;
        baseImageUrl: string | null;
        basePrompt: string | null;
        attributes: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        timeline: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        loraModelId: string | null;
        loraTrainingStatus: string | null;
        loraLastTrained: Date | null;
        totalShots: number;
        avgConsistencyScore: number | null;
    }>;
    update(characterId: string, dto: UpdateCharacterDto): Promise<{
        role: string | null;
        id: string;
        createdAt: Date;
        name: string;
        description: string | null;
        updatedAt: Date;
        projectId: string;
        nameEn: string | null;
        baseImageUrl: string | null;
        basePrompt: string | null;
        attributes: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        timeline: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        loraModelId: string | null;
        loraTrainingStatus: string | null;
        loraLastTrained: Date | null;
        totalShots: number;
        avgConsistencyScore: number | null;
    }>;
    remove(characterId: string): Promise<void>;
    getAppearances(characterId: string, limit?: number): Promise<({
        shot: {
            id: string;
            sceneId: string;
            title: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        shotId: string;
        consistencyScore: number | null;
        characterId: string;
        renderedImageUrl: string;
        promptUsed: string | null;
        evaluatedAt: Date | null;
        usedForTraining: boolean;
    })[]>;
    recordAppearance(characterId: string, dto: RecordAppearanceDto): Promise<{
        id: string;
        createdAt: Date;
        shotId: string;
        consistencyScore: number | null;
        characterId: string;
        renderedImageUrl: string;
        promptUsed: string | null;
        evaluatedAt: Date | null;
        usedForTraining: boolean;
    }>;
    getTrainingImages(characterId: string, minScore?: number): Promise<{
        imageUrl: string;
        score: number;
        shotId: string;
    }[]>;
    trainLora(characterId: string, dto: TrainLoraDto): Promise<{
        message: string;
        characterId: string;
        dto: TrainLoraDto;
    }>;
}
