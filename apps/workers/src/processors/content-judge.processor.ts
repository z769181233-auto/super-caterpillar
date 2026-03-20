import { ProcessorContext } from '../types/processor-context';

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
    const overallScore =
      typeof score.overallScore === 'number'
        ? score.overallScore
        : typeof score.overall_score === 'number'
          ? score.overall_score
          : null;
    const signals =
      score.signals && typeof score.signals === 'object' ? (score.signals as Record<string, any>) : {};
    const identityScore =
      typeof signals.identity_score === 'number' ? signals.identity_score : null;
    const audioScore =
      typeof signals.audio_existence === 'number' ? signals.audio_existence : null;
    const renderScore =
      typeof signals.render_physical === 'number' ? signals.render_physical : null;
    const verdict = typeof score.verdict === 'string' ? score.verdict : 'PENDING';
    const gateVerdict = verdict === 'PASS' ? 'PASS' : verdict === 'FAIL' ? 'BLOCK' : 'WARN';

    await prisma.contentGateResult.create({
      data: {
        projectId: shot.scene.projectId,
        sceneId: shot.scene.id,
        episodeId: shot.scene.episodeId,
        filmIrId: shot.filmIrId ?? shot.scene.filmIrId ?? null,
        gateVersion: 'content-judge-v1',
        dramaticAlignmentScore: overallScore,
        visualStrategyMatchScore: renderScore,
        continuityScore: identityScore,
        shotCoherenceScore: overallScore,
        rhythmScore: overallScore,
        characterConsistencyScore: identityScore,
        soundAlignmentScore: audioScore,
        publishReadinessScore: overallScore,
        gateVerdict,
        gateDetails: {
          qualityScoreId: score.id ?? null,
          jobId: job.id,
          shotId,
          traceId,
          verdict,
          overallScore,
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
