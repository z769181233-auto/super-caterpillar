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
            shotPlanning: {
              select: {
                data: true,
              },
            },
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
    const executionPolicy =
      asset?.shot?.params &&
      typeof asset.shot.params === 'object' &&
      !Array.isArray(asset.shot.params) &&
      'executionPolicy' in (asset.shot.params as Record<string, unknown>)
        ? ((asset.shot.params as Record<string, unknown>).executionPolicy as
            | Record<string, unknown>
            | undefined)
        : (((asset?.shot?.shotPlanning?.data as Record<string, unknown> | null) ?? {}).executionPolicy as
            | Record<string, unknown>
            | undefined);
    const timelinePolicy =
      ((asset?.shot?.shotPlanning?.data as Record<string, unknown> | null) ?? {}).timelinePolicy as
        | Record<string, unknown>
        | undefined;
    const gateDetails =
      publishEvidence?.gateDetails &&
      typeof publishEvidence.gateDetails === 'object' &&
      !Array.isArray(publishEvidence.gateDetails)
        ? (publishEvidence.gateDetails as Record<string, unknown>)
        : undefined;

    return await this.prisma.$transaction(async (tx) => {
      let pv = await tx.publishedVideo.findUnique({
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
                coverageRole:
                  typeof timelinePolicy?.coverageRole === 'string'
                    ? timelinePolicy.coverageRole
                    : typeof executionPolicy?.coverageRole === 'string'
                      ? executionPolicy.coverageRole
                      : null,
                rhythmClass:
                  typeof timelinePolicy?.rhythmClass === 'string'
                    ? timelinePolicy.rhythmClass
                    : typeof executionPolicy?.rhythmClass === 'string'
                      ? executionPolicy.rhythmClass
                      : null,
                plannerVersion:
                  typeof executionPolicy?.plannerVersion === 'string'
                    ? executionPolicy.plannerVersion
                    : typeof directorPlan?.plannerVersion === 'string'
                      ? directorPlan.plannerVersion
                      : null,
                shotPlannerRuleSetVersion:
                  typeof timelinePolicy?.ruleSetVersion === 'string'
                    ? timelinePolicy.ruleSetVersion
                    : typeof executionPolicy?.shotPlannerRuleSetVersion === 'string'
                      ? executionPolicy.shotPlannerRuleSetVersion
                      : typeof directorPlan?.shotPlannerRuleSetVersion === 'string'
                        ? directorPlan.shotPlannerRuleSetVersion
                        : null,
                shotPlannerMatchedRuleIds: Array.isArray(timelinePolicy?.matchedRules)
                  ? timelinePolicy.matchedRules
                      .map((rule) =>
                        rule && typeof rule === 'object' && typeof (rule as Record<string, unknown>).id === 'string'
                          ? ((rule as Record<string, unknown>).id as string)
                          : null,
                      )
                      .filter((value): value is string => typeof value === 'string' && value.length > 0)
                  : [],
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
                gatePolicyLevel:
                  typeof gateDetails?.gatePolicyLevel === 'string'
                    ? gateDetails.gatePolicyLevel
                    : null,
                publishAction:
                  typeof gateDetails?.publishAction === 'string'
                    ? gateDetails.publishAction
                    : null,
                publishEligibility:
                  typeof gateDetails?.publishEligibility === 'string'
                    ? gateDetails.publishEligibility
                    : null,
                reviewRequired:
                  typeof gateDetails?.reviewRequired === 'boolean'
                    ? gateDetails.reviewRequired
                    : null,
                policyStage:
                  typeof gateDetails?.policyStage === 'string'
                    ? gateDetails.policyStage
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
