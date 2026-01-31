import { PrismaClient } from 'database';
import { WorkerJobBase } from '@scu/shared-types';
import { ApiClient } from '../api-client';

/**
 * Audio Processor - Hub-only Architecture (PLAN-5)
 * - Removes all local FFmpeg/Say logic.
 * - Delegates to EngineHub (audio_tts / audio_bgm).
 * - Maintains Asset registration for audit trail.
 */
export async function processAudioJob(
  prisma: PrismaClient,
  job: WorkerJobBase,
  apiClient: ApiClient
): Promise<any> {
  const payload = job.payload as any;
  const { text, mode, projectId, pipelineRunId, voice } = payload;

  console.log(`[AudioProcessor_HUB] Delegating job ${job.id} to EngineHub`);

  try {
    // 1. Invoke EngineHub for TTS
    const ttsResult = await apiClient.invokeEngine({
      engineKey: 'audio_tts',
      payload: { text, voice },
      context: { ...job.context, jobId: job.id, traceId: payload.traceId },
    });

    if (ttsResult.status !== 'SUCCESS') {
      throw new Error(`TTS_ENGINE_FAIL: ${ttsResult.error?.message}`);
    }

    const { storageKey, duration, sha256, size } = ttsResult.output;

    // 2. Register Asset in DB
    const asset = await prisma.asset.create({
      data: {
        projectId: job.projectId || 'system',
        ownerType: 'SHOT',
        ownerId: payload.shotId || payload.pipelineRunId,
        type: 'AUDIO_TTS',
        status: 'GENERATED',
        storageKey,
        checksum: sha256,
        createdByJobId: job.id,
        metadata: {
          duration,
          size,
          engine: 'audio_tts',
          provider: ttsResult.output.provider,
        },
      },
    });

    // 3. Return output for Orchestrator
    return {
      status: 'SUCCEEDED',
      output: {
        assetId: asset.id,
        storageKey,
        sha256,
        duration,
      },
    };
  } catch (error: any) {
    console.error(`[AudioProcessor_HUB] Failed: ${error.message}`);
    throw error;
  }
}
