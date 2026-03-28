import { AssetOwnerType, AssetRole, AssetType, PrismaClient } from 'database';
import { WorkerJobBase } from '@scu/shared-types';
import { ApiClient } from '../api-client';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringField(source: JsonRecord, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

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
  const payload = isRecord(job.payload) ? job.payload : {};
  const context = isRecord(job.context) ? job.context : {};
  const rawText = getStringField(payload, 'text') || getStringField(payload, 'audioText');
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  const voice = getStringField(payload, 'voice');
  const projectId = getStringField(payload, 'projectId');
  const sceneId = getStringField(payload, 'sceneId');

  if (!projectId) {
    throw new Error('[AUDIO] Missing projectId');
  }
  if (!sceneId) {
    throw new Error('[AUDIO] Missing sceneId');
  }
  if (!text) {
    throw new Error('[AUDIO] Missing authoritative text');
  }

  try {
    // 1. Invoke EngineHub for TTS
    const ttsResult = await apiClient.invokeEngine({
      engineKey: 'audio_tts',
      payload: { text, voice },
      context: { ...context, jobId: job.id, traceId: getStringField(payload, 'traceId') },
    });

    if (ttsResult.status !== 'SUCCESS') {
      throw new Error(`TTS_ENGINE_FAIL: ${ttsResult.error?.message}`);
    }

    const output = isRecord(ttsResult.output) ? ttsResult.output : {};
    const storageKey = typeof output.storageKey === 'string' ? output.storageKey : '';
    const duration = typeof output.duration === 'number' ? output.duration : 0;
    const sha256 = typeof output.sha256 === 'string' ? output.sha256 : '';
    const size = typeof output.size === 'number' ? output.size : 0;

    // 2. Register Asset in DB
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type_role: {
          ownerType: AssetOwnerType.SCENE,
          ownerId: sceneId,
          role: AssetRole.PRIMARY,
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
        role: AssetRole.PRIMARY,
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
