import { ProcessorContext } from '../types/processor-context';

export async function processContentJudgeJob(
  context: ProcessorContext
): Promise<{ success: boolean; output?: any; error?: string }> {
  const { job, apiClient } = context;
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

  return {
    success: true,
    output: response,
  };
}
