import { AssetReceiptResolverService } from './asset-receipt-resolver.service';

describe('AssetReceiptResolverService review policy wiring', () => {
  it('maps unified review policy fields from directorLayer into the receipt', async () => {
    const prisma = {
      asset: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'asset-1',
            hlsPlaylistUrl: 'playlist.m3u8',
            signedUrl: 'video.mp4',
            checksum: 'checksum-1',
            storageKey: 'storage-key-1',
            publishedVideo: {
              metadata: {
                duration_sec: 12,
                directorLayer: {
                  sceneId: 'scene-1',
                  filmIrId: 'film-ir-1',
                  latestGateVerdict: 'WARN',
                  gateReason: 'publish_readiness_below_threshold',
                  thresholdProfile: 'balanced',
                  gatePolicyLevel: 'WARN',
                  publishAction: 'REQUIRE_REVIEW',
                  publishEligibility: 'REVIEWABLE',
                  reviewRequired: true,
                  policyStage: 'REVIEW_GATE',
                  reviewPolicyResult: 'require_review',
                  reviewPolicySource: 'publishing-review',
                  approvalActionSource: 'approval-action',
                  approvalActorUserId: 'user-1',
                  approvalReviewStatus: 'REJECTED',
                  approvalReviewNote: 'needs revision',
                  approvalReviewedAt: '2026-04-02T11:00:00.000Z',
                },
              },
            },
          },
        ]),
      },
    } as any;

    const service = new AssetReceiptResolverService(prisma);
    const receipt = await service.resolveAsset({
      projectId: 'project-1',
      traceId: 'trace-1',
      jobId: 'job-1',
      jobCreatedAt: new Date('2026-04-02T00:00:00.000Z'),
    });

    expect(receipt.director_layer).toEqual(
      expect.objectContaining({
        scene_id: 'scene-1',
        film_ir_id: 'film-ir-1',
        publish_action: 'REQUIRE_REVIEW',
        publish_eligibility: 'REVIEWABLE',
        review_required: true,
        policy_stage: 'REVIEW_GATE',
        review_policy_result: 'require_review',
        review_policy_source: 'director-layer',
        approval_action_source: 'approval-action',
        approval_actor_user_id: 'user-1',
        approval_review_status: 'REJECTED',
        approval_review_note: 'needs revision',
        approval_reviewed_at: '2026-04-02T11:00:00.000Z',
      }),
    );
  });
});
