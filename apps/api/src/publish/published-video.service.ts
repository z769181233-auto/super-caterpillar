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
        createdByJobId: true,
        storageKey: true,
        hlsPlaylistUrl: true,
        signedUrl: true,
        shotId: true,
        shot: {
          select: {
            id: true,
            filmIrId: true,
            params: true,
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
            gateDetails: true,
          },
        })
      : null;

    const directorPlan =
      asset?.shot?.params &&
      typeof asset.shot.params === 'object' &&
      !Array.isArray(asset.shot.params) &&
      'directorPlan' in (asset.shot.params as Record<string, unknown>)
        ? ((asset.shot.params as Record<string, unknown>).directorPlan as
            | Record<string, unknown>
            | undefined)
        : undefined;
    const gateDetails =
      publishEvidence?.gateDetails &&
      typeof publishEvidence.gateDetails === 'object' &&
      !Array.isArray(publishEvidence.gateDetails)
        ? (publishEvidence.gateDetails as Record<string, unknown>)
        : undefined;

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
                assetStorageKey: asset?.storageKey ?? storageKey ?? null,
                assetCreatedByJobId: asset?.createdByJobId ?? null,
                hlsPlaylistUrl: asset?.hlsPlaylistUrl ?? null,
                signedUrl: asset?.signedUrl ?? null,
                transitionHint:
                  typeof directorPlan?.transitionHint === 'string'
                    ? directorPlan.transitionHint
                    : null,
                editingRhythmStrategy:
                  typeof directorPlan?.editingRhythmStrategy === 'string'
                    ? directorPlan.editingRhythmStrategy
                    : null,
                audioMasterPriority:
                  typeof directorPlan?.soundStrategy === 'string'
                    ? directorPlan.soundStrategy
                    : null,
                silenceStrategy:
                  typeof directorPlan?.silenceStrategy === 'string'
                    ? directorPlan.silenceStrategy
                    : null,
                thresholdProfile:
                  typeof gateDetails?.thresholdProfile === 'string'
                    ? gateDetails.thresholdProfile
                    : null,
                gateReason:
                  typeof gateDetails?.gateReason === 'string' ? gateDetails.gateReason : null,
                gateThresholds:
                  gateDetails?.thresholds && typeof gateDetails.thresholds === 'object'
                    ? gateDetails.thresholds
                    : null,
                gatePolicyStatus:
                  publishEvidence?.gateVerdict === 'PASS'
                    ? 'publishable'
                    : publishEvidence?.gateVerdict === 'WARN'
                      ? 'review_required'
                      : publishEvidence?.gateVerdict === 'BLOCK'
                        ? 'blocked'
                        : 'pending',
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
