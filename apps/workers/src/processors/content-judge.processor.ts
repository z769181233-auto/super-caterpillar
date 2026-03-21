import { ProcessorContext } from '../types/processor-context';

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampScore(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function averageScores(...values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function deriveContinuityScore(params: {
  identityScore: number | null;
  realIdentityScore: number | null;
  continuityContext: {
    snapshotType?: string | null;
    lockId?: string | null;
    overrideId?: string | null;
  } | null;
}) {
  const { identityScore, realIdentityScore, continuityContext } = params;
  const base = averageScores(identityScore, realIdentityScore);
  if (base === null) return null;

  let modifier = 0;
  if (continuityContext?.lockId) modifier += 0.04;
  if (continuityContext?.overrideId) modifier += 0.02;
  if (String(continuityContext?.snapshotType || '').includes('LOCKED')) modifier += 0.02;
  if (String(continuityContext?.snapshotType || '').includes('OVERRIDE')) modifier += 0.02;

  return clampScore(base + modifier);
}

function deriveRhythmScore(params: {
  overallScore: number | null;
  shotPlanPresent: boolean;
  planningContext: Record<string, any>;
}) {
  const { overallScore, shotPlanPresent, planningContext } = params;
  const rhythm = String(
    planningContext.timelinePolicy?.rhythmClass ||
      planningContext.executionPolicy?.rhythmClass ||
      planningContext.directorPlan?.editingRhythmStrategy ||
      '',
  ).toUpperCase();
  const transitionHint = String(
    planningContext.timelinePolicy?.transitionHint ||
      planningContext.executionPolicy?.transitionHint ||
      planningContext.directorPlan?.transitionHint ||
      '',
  ).toLowerCase();

  let modifier = 0;
  if (shotPlanPresent) modifier += 0.05;
  if (transitionHint === 'match_cut') modifier += 0.03;
  if (transitionHint === 'hold') modifier += 0.02;
  if (rhythm.includes('FAST') || rhythm.includes('TIGHT')) modifier += 0.04;
  if (rhythm.includes('LINGER') || rhythm.includes('HOLD')) modifier += 0.02;
  if (planningContext.timelinePolicy?.coverageRole === 'detail') modifier += 0.01;

  return clampScore((overallScore ?? 0) + modifier);
}

function deriveVisualStrategyMatchScore(params: {
  renderScore: number | null;
  planningContext: Record<string, any>;
}) {
  const { renderScore, planningContext } = params;
  const visualPolicy = planningContext.executionPolicy?.visualPolicy || {};
  const cameraPolicy = planningContext.executionPolicy?.cameraPolicy || {};
  const directorPlan = planningContext.directorPlan || {};
  const hasVisualIntent = !!(
    visualPolicy.visualStrategy ||
    cameraPolicy.compositionStyle ||
    cameraPolicy.distanceStrategy ||
    cameraPolicy.angleStrategy ||
    directorPlan.visualStrategy ||
    directorPlan.compositionStyle ||
    directorPlan.cameraDistanceStrategy ||
    directorPlan.cameraAngleStrategy
  );

  return clampScore((renderScore ?? 0) + (hasVisualIntent ? 0.1 : 0));
}

function derivePublishReadinessScore(params: {
  overallScore: number | null;
  renderScore: number | null;
  audioScore: number | null;
  gateVerdictHint: string;
}) {
  const { overallScore, renderScore, audioScore, gateVerdictHint } = params;
  const base = averageScores(overallScore, renderScore, audioScore);
  if (base === null) return null;
  if (gateVerdictHint === 'PASS') return clampScore(base + 0.05);
  if (gateVerdictHint === 'WARN') return clampScore(base);
  return clampScore(base - 0.08);
}

function resolveGateDecision(params: {
  thresholdProfile: string;
  verdict: string;
  overallScore: number | null;
  dramaticAlignmentScore: number | null;
  visualStrategyMatchScore: number | null;
  continuityScore: number | null;
  shotCoherenceScore: number | null;
  rhythmScore: number | null;
  characterConsistencyScore: number | null;
  soundAlignmentScore: number | null;
  publishReadinessScore: number | null;
  identityScore: number | null;
  audioScore: number | null;
  renderScore: number | null;
}) {
  const {
    thresholdProfile,
    verdict,
    overallScore,
    dramaticAlignmentScore,
    visualStrategyMatchScore,
    continuityScore,
    shotCoherenceScore,
    rhythmScore,
    characterConsistencyScore,
    soundAlignmentScore,
    publishReadinessScore,
    identityScore,
    audioScore,
    renderScore,
  } = params;

  const profile = thresholdProfile.toLowerCase();
  const thresholds =
    profile === 'strict'
      ? { pass: 0.85, warn: 0.72, identity: 0.8, publish: 0.8, continuity: 0.75 }
      : profile === 'advisory'
        ? { pass: 0.7, warn: 0.55, identity: 0.6, publish: 0.58, continuity: 0.55 }
        : { pass: 0.78, warn: 0.62, identity: 0.7, publish: 0.68, continuity: 0.64 };

  const toPolicy = (gateVerdict: 'PASS' | 'WARN' | 'BLOCK', reason: string) => ({
    gateVerdict,
    thresholds,
    reason,
    gatePolicyLevel:
      gateVerdict === 'PASS' ? 'ADVISORY' : gateVerdict === 'WARN' ? 'WARN' : 'BLOCK',
    publishAction:
      gateVerdict === 'PASS'
        ? 'ALLOW_PUBLISH'
        : gateVerdict === 'WARN'
          ? 'REQUIRE_REVIEW'
          : 'BLOCK_PUBLISH',
  });

  if (renderScore === 0 || audioScore === 0) {
    return toPolicy(
      profile === 'advisory' ? 'WARN' : 'BLOCK',
      'missing_required_media_signals',
    );
  }

  const compositeScore = averageScores(
    overallScore,
    dramaticAlignmentScore,
    visualStrategyMatchScore,
    continuityScore,
    shotCoherenceScore,
    rhythmScore,
    characterConsistencyScore,
    soundAlignmentScore,
    publishReadinessScore,
  );

  if (
    publishReadinessScore !== null &&
    publishReadinessScore < thresholds.publish
  ) {
    return toPolicy(
      profile === 'advisory' ? 'WARN' : 'BLOCK',
      'publish_readiness_below_threshold',
    );
  }

  if (
    continuityScore !== null &&
    continuityScore < thresholds.continuity
  ) {
    return toPolicy(
      profile === 'advisory' ? 'WARN' : 'BLOCK',
      'continuity_below_threshold',
    );
  }

  if (verdict === 'PASS' && compositeScore !== null && compositeScore >= thresholds.pass) {
    return toPolicy('PASS', 'meets_pass_threshold');
  }

  if (
    compositeScore !== null &&
    compositeScore >= thresholds.warn &&
    (identityScore === null || identityScore >= thresholds.identity)
  ) {
    return toPolicy('WARN', 'below_pass_but_within_warn_band');
  }

  return toPolicy(profile === 'advisory' ? 'WARN' : 'BLOCK', 'below_quality_threshold');
}

export async function processContentJudgeJob(
  context: ProcessorContext
): Promise<{ success: boolean; output?: any; error?: string }> {
  const { job, apiClient, prisma } = context;
  const payload = (job.payload || {}) as Record<string, any>;

  const shotId = payload.shotId || job.shotId;
  if (!shotId || typeof shotId !== 'string') {
    return {
      success: false,
      error: 'Missing shotId for CE_CONTENT_JUDGE job',
    };
  }

  const traceId =
    (typeof payload.traceId === 'string' && payload.traceId) ||
    (typeof job.traceId === 'string' && job.traceId) ||
    job.id;
  const thresholdProfile =
    (typeof payload.thresholdProfile === 'string' && payload.thresholdProfile) ||
    'standard';
  const gateVersion =
    (typeof payload.gateVersion === 'string' && payload.gateVersion) ||
    'content-judge-v1';

  const response = await apiClient.triggerQualityScore({
    shotId,
    traceId,
    attempt: typeof payload.attempt === 'number' ? payload.attempt : 1,
  });

  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    select: {
      id: true,
      filmIrId: true,
      params: true,
      shotPlanning: {
        select: {
          data: true,
          engineKey: true,
          engineVersion: true,
        },
      },
      scene: {
        select: {
          id: true,
          episodeId: true,
          projectId: true,
          filmIrId: true,
        },
      },
    },
  });

  const continuityRows = shot?.scene?.id
    ? await (prisma as any).$queryRawUnsafe(
        `
          SELECT snapshot_type, snapshot_data, evidence_ref
          FROM continuity_state_snapshots
          WHERE scene_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        shot.scene.id,
      )
    : [];
  const latestContinuity = Array.isArray(continuityRows) ? continuityRows[0] ?? null : null;
  const continuityData =
    latestContinuity?.snapshot_data &&
    typeof latestContinuity.snapshot_data === 'object' &&
    !Array.isArray(latestContinuity.snapshot_data)
      ? (latestContinuity.snapshot_data as Record<string, any>)
      : null;
  const continuityContext = latestContinuity
    ? {
        snapshotType:
          typeof latestContinuity.snapshot_type === 'string'
            ? latestContinuity.snapshot_type
            : null,
        evidenceRef:
          typeof latestContinuity.evidence_ref === 'string' ? latestContinuity.evidence_ref : null,
        lockId: typeof continuityData?.lockId === 'string' ? continuityData.lockId : null,
        lockReason:
          typeof continuityData?.lockReason === 'string' ? continuityData.lockReason : null,
        overrideId:
          typeof continuityData?.overrideId === 'string' ? continuityData.overrideId : null,
        overrideReason:
          typeof continuityData?.overrideReason === 'string'
            ? continuityData.overrideReason
            : null,
      }
    : null;

  if (shot?.scene?.projectId) {
    const score = response as Record<string, any>;
    const overallScore = toNumber(score.overallScore) ?? toNumber(score.overall_score);
    const signals =
      score.signals && typeof score.signals === 'object' ? (score.signals as Record<string, any>) : {};
    const identityScore = toNumber(signals.identity_score);
    const realIdentityScore = toNumber(signals.identity_score_real_ppv64);
    const audioScore = toNumber(signals.audio_existence);
    const renderScore = toNumber(signals.render_physical);
    const verdict = typeof score.verdict === 'string' ? score.verdict : 'PENDING';
    const shotParams = (shot.params as Record<string, any> | null) ?? {};
    const shotPlanningData = (shot.shotPlanning?.data as Record<string, any> | null) ?? {};
    const planningContext = {
      directorPlan:
        (shotParams.directorPlan as Record<string, any> | undefined) ||
        shotPlanningData.directorPlan ||
        shotPlanningData,
      executionPolicy:
        (shotParams.executionPolicy as Record<string, any> | undefined) ||
        shotPlanningData.executionPolicy ||
        null,
      timelinePolicy: shotPlanningData.timelinePolicy || null,
    };
    const shotPlanPresent = !!shot.shotPlanning;
    const dramaticAlignmentScore = clampScore(overallScore);
    const visualStrategyMatchScore = deriveVisualStrategyMatchScore({
      renderScore,
      planningContext,
    });
    const continuityScore = deriveContinuityScore({
      identityScore,
      realIdentityScore,
      continuityContext,
    });
    const shotCoherenceScore = clampScore(
      averageScores(overallScore, renderScore, shotPlanPresent ? 1 : 0),
    );
    const rhythmScore = deriveRhythmScore({
      overallScore,
      shotPlanPresent,
      planningContext,
    });
    const characterConsistencyScore = clampScore(identityScore);
    const soundAlignmentScore = clampScore(audioScore);
    const publishReadinessScore = derivePublishReadinessScore({
      overallScore,
      renderScore,
      audioScore,
      gateVerdictHint: verdict,
    });
    const gateDecision = resolveGateDecision({
      thresholdProfile,
      verdict,
      overallScore,
      dramaticAlignmentScore,
      visualStrategyMatchScore,
      continuityScore,
      shotCoherenceScore,
      rhythmScore,
      characterConsistencyScore,
      soundAlignmentScore,
      publishReadinessScore,
      identityScore,
      audioScore,
      renderScore,
    });

    await prisma.contentGateResult.create({
      data: {
        projectId: shot.scene.projectId,
        sceneId: shot.scene.id,
        episodeId: shot.scene.episodeId,
        filmIrId: shot.filmIrId ?? shot.scene.filmIrId ?? null,
        gateVersion,
        dramaticAlignmentScore,
        visualStrategyMatchScore,
        continuityScore,
        shotCoherenceScore,
        rhythmScore,
        characterConsistencyScore,
        soundAlignmentScore,
        publishReadinessScore,
        gateVerdict: gateDecision.gateVerdict,
        gateDetails: {
          qualityScoreId: score.id ?? null,
          jobId: job.id,
          shotId,
          traceId,
          verdict,
          overallScore,
          thresholdProfile,
          thresholds: gateDecision.thresholds,
          gateReason: gateDecision.reason,
          gatePolicyLevel: gateDecision.gatePolicyLevel,
          publishAction: gateDecision.publishAction,
          directorPlan: planningContext.directorPlan,
          executionPolicy: planningContext.executionPolicy,
          timelinePolicy: planningContext.timelinePolicy,
          continuityContext,
          shotPlanPresent,
          derivedScores: {
            dramaticAlignmentScore,
            visualStrategyMatchScore,
            continuityScore,
            shotCoherenceScore,
            rhythmScore,
            characterConsistencyScore,
            soundAlignmentScore,
            publishReadinessScore,
          },
          signals,
        } as any,
        evidenceRef: traceId,
      },
    });
  }

  return {
    success: true,
    output: response,
  };
}
