import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublishedVideoService {
    constructor(private readonly prisma: PrismaService) { }

    async recordPublishedVideo(params: {
        projectId: string;
        episodeId: string;
        assetId: string;
        storageKey: string;
        checksum: string;
        pipelineRunId?: string;
    }) {
        const { projectId, episodeId, assetId, storageKey, checksum, pipelineRunId } = params;

        return await this.prisma.$transaction(async (tx) => {
            let pv = await tx.publishedVideo.findFirst({
                where: { assetId }
            });

            if (!pv) {
                pv = await tx.publishedVideo.create({
                    data: {
                        projectId,
                        episodeId,
                        assetId,
                        storageKey,
                        checksum,
                        status: 'INTERNAL_READY',
                        metadata: {
                            pipelineRunId,
                            publishedAt: new Date().toISOString(),
                        } as any,
                    },
                });
            }

            await tx.asset.update({
                where: { id: assetId },
                data: { status: 'PUBLISHED' },
            });

            return pv;
        });
    }
}
