import { ProcessorContext } from '../types/processor-context';

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveGateDecision(params: {
  thresholdProfile: string;
  verdict: string;
  overallScore: number | null;
  identityScore: number | null;
  audioScore: number | null;
  renderScore: number | null;
}) {
  const {
    thresholdProfile,
    verdict,
    overallScore,
    identityScore,
    audioScore,
    renderScore,
  } = params;

  const profile = thresholdProfile.toLowerCase();
  const thresholds =
    profile === 'strict'
      ? { pass: 0.85, warn: 0.72, identity: 0.8 }
      : profile === 'advisory'
        ? { pass: 0.7, warn: 0.55, identity: 0.6 }
        : { pass: 0.78, warn: 0.62, identity: 0.7 };

  if (renderScore === 0 || audioScore === 0) {
    return {
      gateVerdict: profile === 'advisory' ? 'WARN' : 'BLOCK',
      thresholds,
      reason: 'missing_required_media_signals',
    };
  }

  if (verdict === 'PASS' && overallScore !== null && overallScore >= thresholds.pass) {
    return {
      gateVerdict: 'PASS',
      thresholds,
      reason: 'meets_pass_threshold',
    };
  }

  if (
    overallScore !== null &&
    overallScore >= thresholds.warn &&
    (identityScore === null || identityScore >= thresholds.identity)
  ) {
    return {
      gateVerdict: 'WARN',
      thresholds,
      reason: 'below_pass_but_within_warn_band',
    };
  }

  return {
    gateVerdict: profile === 'advisory' ? 'WARN' : 'BLOCK',
    thresholds,
    reason: 'below_quality_threshold',
  };
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

  if (shot?.scene?.projectId) {
    const score = response as Record<string, any>;
    const overallScore = toNumber(score.overallScore) ?? toNumber(score.overall_score);
    const signals =
      score.signals && typeof score.signals === 'object' ? (score.signals as Record<string, any>) : {};
    const identityScore = toNumber(signals.identity_score);
    const audioScore = toNumber(signals.audio_existence);
    const renderScore = toNumber(signals.render_physical);
    const verdict = typeof score.verdict === 'string' ? score.verdict : 'PENDING';
    const gateDecision = resolveGateDecision({
      thresholdProfile,
      verdict,
      overallScore,
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
        dramaticAlignmentScore: overallScore,
        visualStrategyMatchScore: renderScore,
        continuityScore: identityScore,
        shotCoherenceScore: overallScore,
        rhythmScore: overallScore,
        characterConsistencyScore: identityScore,
        soundAlignmentScore: audioScore,
        publishReadinessScore: overallScore,
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
