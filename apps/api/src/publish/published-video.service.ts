import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublishedVideoService {
  constructor(private readonly prisma: PrismaService) {}

  async recordPublishedVideo(params: {
    projectId: string;
    episodeId: string;
    assetId: string;
    storageKey: string;
    checksum: string;
    pipelineRunId?: string;
  }) {
    const { projectId, episodeId, assetId, storageKey, checksum, pipelineRunId } = params;

    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        shotId: true,
        shot: {
          select: {
            id: true,
            filmIrId: true,
            scene: {
              select: {
                id: true,
                filmIrId: true,
              },
            },
          },
        },
      },
    });

    const publishEvidence = asset?.shot?.scene?.id
      ? await this.prisma.contentGateResult.findFirst({
          where: {
            projectId,
            sceneId: asset.shot.scene.id,
            filmIrId: asset.shot.filmIrId ?? asset.shot.scene.filmIrId ?? undefined,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            gateVersion: true,
            gateVerdict: true,
            publishReadinessScore: true,
            evidenceRef: true,
            createdAt: true,
          },
        })
      : null;

    return await this.prisma.$transaction(async (tx) => {
      let pv = await tx.publishedVideo.findFirst({
        where: { assetId },
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
              directorLayer: {
                shotId: asset?.shotId ?? null,
                sceneId: asset?.shot?.scene?.id ?? null,
                filmIrId: asset?.shot?.filmIrId ?? asset?.shot?.scene?.filmIrId ?? null,
                latestGateResultId: publishEvidence?.id ?? null,
                latestGateVersion: publishEvidence?.gateVersion ?? null,
                latestGateVerdict: publishEvidence?.gateVerdict ?? null,
                publishReadinessScore:
                  publishEvidence?.publishReadinessScore?.toString() ?? null,
                evidenceRef: publishEvidence?.evidenceRef ?? null,
                gateEvaluatedAt: publishEvidence?.createdAt?.toISOString?.() ?? null,
              },
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
