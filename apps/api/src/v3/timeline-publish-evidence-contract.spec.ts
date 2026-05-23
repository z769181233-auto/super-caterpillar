import {
  buildDirectorLayerEvidence,
  buildTimelineSemanticEvidence,
  projectDirectorLayerToReceipt,
} from '@scu/shared-types';

describe('timeline publish evidence contract', () => {
  it('projects shared publish metadata into receipt shape without losing review policy fields', () => {
    const timelineSemanticContext = buildTimelineSemanticEvidence({
      semanticCharacters: ['林夏', '陈河'],
      semanticLocationSlug: '旧码头',
      semanticTimeOfDay: '清晨',
      semanticConflictSummary: '陈河拦住她追问真相。',
      chapterContextSummary: '章节摘要',
      memoryContextSummary: '前情记忆',
      memoryContextSource: 'semantic-memory-stack-v1',
      crossChapterMemoryHit: true,
      filmIrSourceContextSummary: '导演摘要',
      filmIrDramaticGoal: '逼迫林夏表态',
      filmIrVisualStrategy: '近景压迫',
    });

    const directorLayer = buildDirectorLayerEvidence({
      shotId: 'shot-1',
      sceneId: 'scene-1',
      filmIrId: 'film-ir-1',
      latestGateResultId: 'gate-1',
      latestGateVersion: 'gate-v1',
      latestGateVerdict: 'WARN',
      publishReadinessScore: '0.82',
      evidenceRef: 'evidence-1',
      gateEvaluatedAt: '2026-04-03T10:00:00.000Z',
      assetStorageKey: 'storage-key',
      assetCreatedByJobId: 'job-1',
      hlsPlaylistUrl: 'playlist.m3u8',
      signedUrl: 'video.mp4',
      transitionHint: 'cut',
      editingRhythmStrategy: 'tense',
      audioMasterPriority: 'dialogue-first',
      silenceStrategy: 'hold-breath',
      coverageRole: 'detail',
      rhythmClass: 'tight',
      plannerVersion: 'planner-v1',
      shotPlannerRuleSetVersion: 'rules-v1',
      shotPlannerMatchedRuleIds: ['rule-1'],
      thresholdProfile: 'balanced',
      gateReason: 'needs-review',
      gateThresholds: { publishReadinessScore: 0.8 },
      timelineSemanticContext,
      directorLayerForPolicy: {
        gatePolicyLevel: 'WARN',
        publishAction: 'REQUIRE_REVIEW',
        publishEligibility: 'REVIEWABLE',
        reviewRequired: true,
        policyStage: 'REVIEW_GATE',
      },
      publishingReviewResult: 'require_review',
      approvalActionSource: 'approval-action',
      approvalActorUserId: 'user-1',
      approvalReviewStatus: 'REJECTED',
      approvalReviewNote: 'needs revision',
      approvalReviewedAt: '2026-04-03T11:00:00.000Z',
    });

    expect(directorLayer).toEqual(
      expect.objectContaining({
        semanticCharacters: ['林夏', '陈河'],
        publishAction: 'REQUIRE_REVIEW',
        publishEligibility: 'REVIEWABLE',
        reviewPolicyResult: 'require_review',
        reviewPolicySource: 'publishing-review',
        approvalActionSource: 'approval-action',
      }),
    );

    expect(projectDirectorLayerToReceipt(directorLayer)).toEqual(
      expect.objectContaining({
        scene_id: 'scene-1',
        film_ir_id: 'film-ir-1',
        publish_action: 'REQUIRE_REVIEW',
        publish_eligibility: 'REVIEWABLE',
        review_required: true,
        review_policy_result: 'require_review',
        review_policy_source: 'director-layer',
        approval_action_source: 'approval-action',
        shot_planner_rule_set_version: 'rules-v1',
        planner_version: 'planner-v1',
      }),
    );
  });
});
