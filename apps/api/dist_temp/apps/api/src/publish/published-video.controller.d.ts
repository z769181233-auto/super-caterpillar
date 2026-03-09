import { PrismaService } from '../prisma/prisma.service';
export declare class PublishedVideoController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getPublishedVideos(projectId?: string, assetId?: string, pipelineRunId?: string): Promise<{
        success: boolean;
        data: ({
            asset: {
                id: string;
                createdAt: Date;
                type: import("database").$Enums.AssetType;
                status: import("database").$Enums.AssetStatus;
                projectId: string;
                ownerId: string;
                shotId: string | null;
                checksum: string | null;
                createdByJobId: string | null;
                ownerType: import("database").$Enums.AssetOwnerType;
                storageKey: string;
                hlsPlaylistUrl: string | null;
                signedUrl: string | null;
                watermarkMode: string | null;
                fingerprintId: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            status: string;
            updatedAt: Date;
            projectId: string;
            metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            episodeId: string;
            checksum: string;
            storageKey: string;
            assetId: string;
        })[];
        record: {
            asset: {
                id: string;
                createdAt: Date;
                type: import("database").$Enums.AssetType;
                status: import("database").$Enums.AssetStatus;
                projectId: string;
                ownerId: string;
                shotId: string | null;
                checksum: string | null;
                createdByJobId: string | null;
                ownerType: import("database").$Enums.AssetOwnerType;
                storageKey: string;
                hlsPlaylistUrl: string | null;
                signedUrl: string | null;
                watermarkMode: string | null;
                fingerprintId: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            status: string;
            updatedAt: Date;
            projectId: string;
            metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
            episodeId: string;
            checksum: string;
            storageKey: string;
            assetId: string;
        };
        status: string;
    }>;
}
