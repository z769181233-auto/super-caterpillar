import { PrismaService } from '../prisma/prisma.service';
export declare class PublishedVideoService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    recordPublishedVideo(params: {
        projectId: string;
        episodeId: string;
        assetId: string;
        storageKey: string;
        checksum: string;
        pipelineRunId?: string;
    }): Promise<{
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
    }>;
}
