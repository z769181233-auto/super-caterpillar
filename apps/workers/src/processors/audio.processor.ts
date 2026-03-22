import { AssetOwnerType, AssetType, PrismaClient } from 'database';
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
  const sceneId = payload.sceneId || payload.shotId;

  if (!projectId) {
    throw new Error('[AUDIO] Missing projectId');
  }
  if (!sceneId) {
    throw new Error('[AUDIO] Missing sceneId');
  }

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
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerType: AssetOwnerType.SCENE,
          ownerId: sceneId,
          type: AssetType.AUDIO_TTS,
        },
      },
      update: {
        storageKey,
        checksum: sha256,
        status: 'GENERATED',
        createdByJobId: job.id,
      },
      create: {
        projectId,
        ownerType: AssetOwnerType.SCENE,
        ownerId: sceneId,
        type: AssetType.AUDIO_TTS,
        status: 'GENERATED',
        storageKey,
        checksum: sha256,
        createdByJobId: job.id,
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
    throw error;
  }
}
