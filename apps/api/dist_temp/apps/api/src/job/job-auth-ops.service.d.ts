import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolver } from '../common/project-resolver';
export declare class JobAuthOpsService {
    private readonly prisma;
    private readonly projectResolver;
    constructor(prisma: PrismaService, projectResolver: ProjectResolver);
    checkShotOwnership(shotId: string, organizationId: string): Promise<{
        scene: {
            episode: ({
                project: {
                    id: string;
                    createdAt: Date;
                    name: string;
                    description: string | null;
                    status: import("database").$Enums.ProjectStatus;
                    updatedAt: Date;
                    ownerId: string;
                    organizationId: string;
                    metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
                    settingsJson: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
                    styleGuide: string | null;
                    stylePrompt: string | null;
                } | null;
                season: ({
                    project: {
                        id: string;
                        createdAt: Date;
                        name: string;
                        description: string | null;
                        status: import("database").$Enums.ProjectStatus;
                        updatedAt: Date;
                        ownerId: string;
                        organizationId: string;
                        metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
                        settingsJson: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
                        styleGuide: string | null;
                        stylePrompt: string | null;
                    };
                } & {
                    id: string;
                    createdAt: Date;
                    description: string | null;
                    updatedAt: Date;
                    projectId: string;
                    metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
                    index: number;
                    title: string;
                }) | null;
            } & {
                id: string;
                name: string;
                status: string | null;
                projectId: string | null;
                summary: string | null;
                index: number;
                seasonId: string | null;
                buildId: string | null;
                sourceRefId: string | null;
                chapterId: string | null;
            }) | null;
        } & {
            id: string;
            createdAt: Date;
            status: string | null;
            updatedAt: Date;
            projectId: string | null;
            summary: string | null;
            episodeId: string | null;
            title: string | null;
            characters: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            reviewStatus: import("database").$Enums.ShotReviewStatus;
            sceneIndex: number;
            buildId: string | null;
            sourceRefId: string | null;
            chapterId: string | null;
            visualDensityScore: import("../../../../packages/database/dist/generated/prisma/runtime/library").Decimal | null;
            visualDensityMeta: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            locationSlug: string | null;
            timeOfDay: string | null;
            environmentTags: string[];
            enrichedText: string | null;
            graphStateSnapshot: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            sceneDraftId: string | null;
            directingNotes: string | null;
            shotType: string | null;
            characterIds: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            entryStateJson: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            exitStateJson: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        };
    } & {
        params: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        qualityScore: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        id: string;
        type: string;
        description: string | null;
        organizationId: string | null;
        sceneId: string;
        index: number;
        title: string | null;
        reviewStatus: import("database").$Enums.ShotReviewStatus;
        buildId: string | null;
        sourceRefId: string | null;
        shotType: string | null;
        content: string | null;
        visualDescription: string | null;
        reviewedAt: Date | null;
        durationSeconds: number | null;
        enrichedPrompt: string | null;
        cameraMovement: string | null;
        cameraAngle: string | null;
        lightingPreset: string | null;
        renderStatus: import("database").$Enums.ShotRenderStatus;
        resultImageUrl: string | null;
        resultVideoUrl: string | null;
        visualPrompt: string | null;
        negativePrompt: string | null;
        actionDescription: string | null;
        dialogueContent: string | null;
        soundFx: string | null;
        assetBindings: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        controlnetSettings: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        durationSec: import("../../../../packages/database/dist/generated/prisma/runtime/library").Decimal | null;
        emotion: string | null;
        novelQuote: string | null;
        continuityJson: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
    }>;
}
