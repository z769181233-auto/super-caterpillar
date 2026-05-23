import { normalizeReviewPolicy } from './review-policy';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export interface TimelineSemanticEvidence {
  semanticCharacters: string[];
  semanticLocationSlug: string | null;
  semanticTimeOfDay: string | null;
  semanticConflictSummary: string | null;
  chapterContextSummary: string | null;
  memoryContextSummary: string | null;
  memoryContextSource: string | null;
  crossChapterMemoryHit: boolean;
  filmIrSourceContextSummary: string | null;
  filmIrDramaticGoal: string | null;
  filmIrVisualStrategy: string | null;
}

export interface DirectorLayerEvidence {
  shotId: string | null;
  sceneId: string | null;
  filmIrId: string | null;
  latestGateResultId: string | null;
  latestGateVersion: string | null;
  latestGateVerdict: string | null;
  publishReadinessScore: string | null;
  evidenceRef: unknown;
  gateEvaluatedAt: string | null;
  assetStorageKey: string | null;
  assetCreatedByJobId: string | null;
  hlsPlaylistUrl: string | null;
  signedUrl: string | null;
  transitionHint: string | null;
  editingRhythmStrategy: string | null;
  audioMasterPriority: string | null;
  silenceStrategy: string | null;
  coverageRole: string | null;
  rhythmClass: string | null;
  plannerVersion: string | null;
  shotPlannerRuleSetVersion: string | null;
  shotPlannerMatchedRuleIds: string[];
  thresholdProfile: string | null;
  gateReason: string | null;
  gateThresholds: unknown;
  gatePolicyLevel: string | null;
  publishAction: string | null;
  publishEligibility: string | null;
  reviewRequired: boolean | null;
  policyStage: string | null;
  gatePolicyStatus: string | null;
  reviewPolicyResult: string | null;
  reviewPolicySource: string | null;
  approvalActionSource: string | null;
  approvalActorUserId: string | null;
  approvalReviewStatus: string | null;
  approvalReviewNote: string | null;
  approvalReviewedAt: string | null;
  semanticCharacters: string[];
  semanticLocationSlug: string | null;
  semanticTimeOfDay: string | null;
  semanticConflictSummary: string | null;
  chapterContextSummary: string | null;
  memoryContextSummary: string | null;
  memoryContextSource: string | null;
  crossChapterMemoryHit: boolean;
  filmIrSourceContextSummary: string | null;
  filmIrDramaticGoal: string | null;
  filmIrVisualStrategy: string | null;
}

export interface ReceiptDirectorLayerEvidence {
  scene_id: string | null;
  film_ir_id: string | null;
  gate_verdict: string | null;
  gate_reason: string | null;
  threshold_profile: string | null;
  gate_policy_level: string | null;
  publish_action: string | null;
  publish_eligibility: string | null;
  review_required: boolean | null;
  policy_stage: string | null;
  review_policy_result: string | null;
  review_policy_source: string | null;
  approval_action_source: string | null;
  approval_actor_user_id: string | null;
  approval_review_status: string | null;
  approval_review_note: string | null;
  approval_reviewed_at: string | null;
  shot_planner_rule_set_version: string | null;
  shot_planner_matched_rule_ids: string[] | null;
  planner_version: string | null;
  coverage_role: string | null;
  rhythm_class: string | null;
  transition_hint: string | null;
  rhythm_strategy: string | null;
  audio_master_priority: string | null;
  silence_strategy: string | null;
}

export function buildTimelineSemanticEvidence(
  sceneSemanticContext: unknown,
): TimelineSemanticEvidence | null {
  if (!isRecord(sceneSemanticContext)) return null;

  return {
    semanticCharacters: readStringArray(sceneSemanticContext.semanticCharacters),
    semanticLocationSlug: readString(sceneSemanticContext.semanticLocationSlug),
    semanticTimeOfDay: readString(sceneSemanticContext.semanticTimeOfDay),
    semanticConflictSummary: readString(sceneSemanticContext.semanticConflictSummary),
    chapterContextSummary: readString(sceneSemanticContext.chapterContextSummary),
    memoryContextSummary: readString(sceneSemanticContext.memoryContextSummary),
    memoryContextSource: readString(sceneSemanticContext.memoryContextSource),
    crossChapterMemoryHit: sceneSemanticContext.crossChapterMemoryHit === true,
    filmIrSourceContextSummary: readString(sceneSemanticContext.filmIrSourceContextSummary),
    filmIrDramaticGoal: readString(sceneSemanticContext.filmIrDramaticGoal),
    filmIrVisualStrategy: readString(sceneSemanticContext.filmIrVisualStrategy),
  };
}

export function buildDirectorLayerEvidence(input: {
  shotId: string | null;
  sceneId: string | null;
  filmIrId: string | null;
  latestGateResultId: string | null;
  latestGateVersion: string | null;
  latestGateVerdict: string | null;
  publishReadinessScore: string | null;
  evidenceRef: unknown;
  gateEvaluatedAt: string | null;
  assetStorageKey: string | null;
  assetCreatedByJobId: string | null;
  hlsPlaylistUrl: string | null;
  signedUrl: string | null;
  transitionHint: string | null;
  editingRhythmStrategy: string | null;
  audioMasterPriority: string | null;
  silenceStrategy: string | null;
  coverageRole: string | null;
  rhythmClass: string | null;
  plannerVersion: string | null;
  shotPlannerRuleSetVersion: string | null;
  shotPlannerMatchedRuleIds: string[];
  thresholdProfile: string | null;
  gateReason: string | null;
  gateThresholds: unknown;
  timelineSemanticContext: unknown;
  directorLayerForPolicy?: unknown;
  publishingReviewResult?: unknown;
  approvalActionSource: string | null;
  approvalActorUserId: string | null;
  approvalReviewStatus: string | null;
  approvalReviewNote: string | null;
  approvalReviewedAt: string | null;
}): DirectorLayerEvidence {
  const reviewPolicy = normalizeReviewPolicy({
    directorLayer: input.directorLayerForPolicy,
    publishingReviewResult: input.publishingReviewResult,
  });
  const semantic = buildTimelineSemanticEvidence(input.timelineSemanticContext);

  return {
    shotId: input.shotId,
    sceneId: input.sceneId,
    filmIrId: input.filmIrId,
    latestGateResultId: input.latestGateResultId,
    latestGateVersion: input.latestGateVersion,
    latestGateVerdict: input.latestGateVerdict,
    publishReadinessScore: input.publishReadinessScore,
    evidenceRef: input.evidenceRef,
    gateEvaluatedAt: input.gateEvaluatedAt,
    assetStorageKey: input.assetStorageKey,
    assetCreatedByJobId: input.assetCreatedByJobId,
    hlsPlaylistUrl: input.hlsPlaylistUrl,
    signedUrl: input.signedUrl,
    transitionHint: input.transitionHint,
    editingRhythmStrategy: input.editingRhythmStrategy,
    audioMasterPriority: input.audioMasterPriority,
    silenceStrategy: input.silenceStrategy,
    coverageRole: input.coverageRole,
    rhythmClass: input.rhythmClass,
    plannerVersion: input.plannerVersion,
    shotPlannerRuleSetVersion: input.shotPlannerRuleSetVersion,
    shotPlannerMatchedRuleIds: input.shotPlannerMatchedRuleIds,
    thresholdProfile: input.thresholdProfile,
    gateReason: input.gateReason,
    gateThresholds: input.gateThresholds,
    gatePolicyLevel: reviewPolicy.gatePolicyLevel,
    publishAction: reviewPolicy.publishAction,
    publishEligibility: reviewPolicy.publishEligibility,
    reviewRequired: reviewPolicy.reviewRequired,
    policyStage: reviewPolicy.policyStage,
    gatePolicyStatus: reviewPolicy.effectiveDecision,
    reviewPolicyResult: reviewPolicy.reviewPolicyResult,
    reviewPolicySource: reviewPolicy.reviewPolicySource,
    approvalActionSource: input.approvalActionSource,
    approvalActorUserId: input.approvalActorUserId,
    approvalReviewStatus: input.approvalReviewStatus,
    approvalReviewNote: input.approvalReviewNote,
    approvalReviewedAt: input.approvalReviewedAt,
    semanticCharacters: semantic?.semanticCharacters ?? [],
    semanticLocationSlug: semantic?.semanticLocationSlug ?? null,
    semanticTimeOfDay: semantic?.semanticTimeOfDay ?? null,
    semanticConflictSummary: semantic?.semanticConflictSummary ?? null,
    chapterContextSummary: semantic?.chapterContextSummary ?? null,
    memoryContextSummary: semantic?.memoryContextSummary ?? null,
    memoryContextSource: semantic?.memoryContextSource ?? null,
    crossChapterMemoryHit: semantic?.crossChapterMemoryHit === true,
    filmIrSourceContextSummary: semantic?.filmIrSourceContextSummary ?? null,
    filmIrDramaticGoal: semantic?.filmIrDramaticGoal ?? null,
    filmIrVisualStrategy: semantic?.filmIrVisualStrategy ?? null,
  };
}

export function projectDirectorLayerToReceipt(
  directorLayer: unknown,
): ReceiptDirectorLayerEvidence | null {
  if (!isRecord(directorLayer)) return null;
  const reviewPolicy = normalizeReviewPolicy({ directorLayer });

  return {
    scene_id: readString(directorLayer.sceneId),
    film_ir_id: readString(directorLayer.filmIrId),
    gate_verdict: readString(directorLayer.latestGateVerdict),
    gate_reason: readString(directorLayer.gateReason),
    threshold_profile: readString(directorLayer.thresholdProfile),
    gate_policy_level: reviewPolicy.gatePolicyLevel,
    publish_action: reviewPolicy.publishAction,
    publish_eligibility: reviewPolicy.publishEligibility,
    review_required: reviewPolicy.reviewRequired,
    policy_stage: reviewPolicy.policyStage,
    review_policy_result: reviewPolicy.reviewPolicyResult,
    review_policy_source: reviewPolicy.reviewPolicySource,
    approval_action_source: readString(directorLayer.approvalActionSource),
    approval_actor_user_id: readString(directorLayer.approvalActorUserId),
    approval_review_status: readString(directorLayer.approvalReviewStatus),
    approval_review_note: readString(directorLayer.approvalReviewNote),
    approval_reviewed_at: readString(directorLayer.approvalReviewedAt),
    shot_planner_rule_set_version: readString(directorLayer.shotPlannerRuleSetVersion),
    shot_planner_matched_rule_ids: Array.isArray(directorLayer.shotPlannerMatchedRuleIds)
      ? directorLayer.shotPlannerMatchedRuleIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : null,
    planner_version: readString(directorLayer.plannerVersion),
    coverage_role: readString(directorLayer.coverageRole),
    rhythm_class: readString(directorLayer.rhythmClass),
    transition_hint: readString(directorLayer.transitionHint),
    rhythm_strategy: readString(directorLayer.editingRhythmStrategy),
    audio_master_priority: readString(directorLayer.audioMasterPriority),
    silence_strategy: readString(directorLayer.silenceStrategy),
  };
}
