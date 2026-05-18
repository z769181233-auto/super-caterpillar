type JsonRecord = Record<string, unknown>;

export type ReviewPolicyResult = 'pass' | 'require_review' | 'reject';
export type ReviewPolicySource = 'publishing-review' | 'director-layer' | 'derived-fallback';
export type ReviewPolicyDecision = 'publishable' | 'review_required' | 'blocked' | 'pending';
export type ShotReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function policyFromReviewResult(result: ReviewPolicyResult) {
  if (result === 'pass') {
    return {
      gatePolicyLevel: 'ADVISORY',
      publishAction: 'ALLOW_PUBLISH',
      publishEligibility: 'ELIGIBLE',
      reviewRequired: false,
      policyStage: 'READY',
      effectiveDecision: 'publishable' as ReviewPolicyDecision,
    };
  }

  if (result === 'reject') {
    return {
      gatePolicyLevel: 'BLOCK',
      publishAction: 'BLOCK_PUBLISH',
      publishEligibility: 'INELIGIBLE',
      reviewRequired: true,
      policyStage: 'BLOCKING_GATE',
      effectiveDecision: 'blocked' as ReviewPolicyDecision,
    };
  }

  return {
    gatePolicyLevel: 'WARN',
    publishAction: 'REQUIRE_REVIEW',
    publishEligibility: 'REVIEWABLE',
    reviewRequired: true,
    policyStage: 'REVIEW_GATE',
    effectiveDecision: 'review_required' as ReviewPolicyDecision,
  };
}

function reviewResultFromPublishAction(action: string | null): ReviewPolicyResult | null {
  if (action === 'ALLOW_PUBLISH') return 'pass';
  if (action === 'BLOCK_PUBLISH') return 'reject';
  if (action === 'REQUIRE_REVIEW') return 'require_review';
  return null;
}

export function reviewResultToShotReviewStatus(
  result: ReviewPolicyResult | null | undefined
): ShotReviewStatus {
  if (result === 'pass') return 'APPROVED';
  if (result === 'reject') return 'REJECTED';
  return 'PENDING';
}

export function shotReviewStatusToReviewResult(
  status: ShotReviewStatus | null | undefined
): ReviewPolicyResult {
  if (status === 'APPROVED') return 'pass';
  if (status === 'REJECTED') return 'reject';
  return 'require_review';
}

export function normalizeReviewPolicy(input: {
  directorLayer?: unknown;
  publishingReviewResult?: unknown;
}) {
  const directorLayer = isRecord(input.directorLayer) ? input.directorLayer : {};
  const explicitReviewResult = readString(input.publishingReviewResult) as ReviewPolicyResult | null;

  if (
    explicitReviewResult === 'pass' ||
    explicitReviewResult === 'reject' ||
    explicitReviewResult === 'require_review'
  ) {
    const policy = policyFromReviewResult(explicitReviewResult);
    return {
      ...policy,
      reviewPolicyResult: explicitReviewResult,
      reviewPolicySource: 'publishing-review' as ReviewPolicySource,
    };
  }

  const publishAction = readString(directorLayer.publishAction);
  const publishEligibility = readString(directorLayer.publishEligibility);
  const reviewRequired = readBoolean(directorLayer.reviewRequired);
  const policyStage = readString(directorLayer.policyStage);
  const gatePolicyLevel = readString(directorLayer.gatePolicyLevel);
  const gatePolicyStatus = readString(directorLayer.gatePolicyStatus);
  const reviewPolicyResult = reviewResultFromPublishAction(publishAction);

  const effectiveDecision =
    gatePolicyStatus === 'publishable' ||
    gatePolicyStatus === 'review_required' ||
    gatePolicyStatus === 'blocked' ||
    gatePolicyStatus === 'pending'
      ? (gatePolicyStatus as ReviewPolicyDecision)
      : reviewPolicyResult === 'pass'
        ? 'publishable'
        : reviewPolicyResult === 'reject'
          ? 'blocked'
          : reviewPolicyResult === 'require_review' || reviewRequired === true
            ? 'review_required'
            : publishEligibility === 'ELIGIBLE'
              ? 'publishable'
              : publishEligibility === 'INELIGIBLE'
                ? 'blocked'
                : publishEligibility === 'REVIEWABLE'
                  ? 'review_required'
                  : 'pending';

  return {
    gatePolicyLevel,
    publishAction,
    publishEligibility,
    reviewRequired: reviewRequired ?? (reviewPolicyResult === 'require_review' ? true : null),
    policyStage,
    effectiveDecision,
    reviewPolicyResult,
    reviewPolicySource:
      publishAction ||
      publishEligibility ||
      typeof reviewRequired === 'boolean' ||
      policyStage ||
      gatePolicyLevel ||
      gatePolicyStatus
        ? ('director-layer' as ReviewPolicySource)
        : ('derived-fallback' as ReviewPolicySource),
  };
}
