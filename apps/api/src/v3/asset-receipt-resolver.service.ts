import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface V3AssetReceipt {
  asset_id: string | null;
  hls_url: string | null;
  mp4_url: string | null;
  checksum: string | null;
  storage_key: string | null;
  duration_sec: number | null;
  fallback_reason: string | null;
  error_code?: string;
  director_layer?: {
    scene_id: string | null;
    film_ir_id: string | null;
    gate_verdict: string | null;
    gate_reason: string | null;
    threshold_profile: string | null;
    coverage_role: string | null;
    rhythm_class: string | null;
    transition_hint: string | null;
    rhythm_strategy: string | null;
    audio_master_priority: string | null;
    silence_strategy: string | null;
  } | null;
}

@Injectable()
export class AssetReceiptResolverService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolves the production asset for a given job using a 4-level deterministic strategy.
   * 1. Level 1: Match by createdByJobId (Direct link).
   * 2. Level 2: Pipeline Trace (Match by traceId + type/status).
   * 3. Level 3: Temporal Window (Match by projectId + traceId + time +/- 5m).
   * 4. Level 4: Heuristic Fallback (Latest published asset in project).
   */
  async resolveAsset(params: {
    projectId: string;
    traceId: string;
    jobId: string;
    jobCreatedAt: Date;
  }): Promise<V3AssetReceipt> {
    const { projectId, traceId, jobId, jobCreatedAt } = params;

    const fiveMins = 5 * 60 * 1000;

    // Level 1: Match by createdByJobId (Deterministic)
    const level1 = await this.prisma.asset.findMany({
      where: { createdByJobId: jobId },
      include: { publishedVideo: true },
      orderBy: { createdAt: 'desc' },
    });
    if (level1.length > 0) {
      const asset = level1[0];
      return this.mapAssetToReceipt(
        asset,
        level1.length > 1 ? 'MULTI_MATCH_CREATED_BY_JOBID' : null
      );
    }

    // Level 2: Pipeline Trace (Deterministic)
    const level2 = await this.prisma.asset.findFirst({
      where: {
        job: { traceId },
        projectId,
        status: 'PUBLISHED',
        type: 'VIDEO',
      },
      include: { publishedVideo: true },
      orderBy: { createdAt: 'desc' },
    });
    if (level2) {
      return this.mapAssetToReceipt(level2, null);
    }

    // Level 3: Temporal Window (Deterministic)
    const level3 = await this.prisma.asset.findFirst({
      where: {
        projectId,
        job: { traceId },
        createdAt: {
          gte: new Date(jobCreatedAt.getTime() - fiveMins),
          lte: new Date(jobCreatedAt.getTime() + fiveMins),
        },
        status: 'PUBLISHED',
        type: 'VIDEO',
      },
      include: { publishedVideo: true },
      orderBy: { createdAt: 'desc' },
    });
    if (level3) {
      return this.mapAssetToReceipt(level3, null);
    }

    // Level 4: Heuristic Fallback (Auditable)
    const level4 = await this.prisma.asset.findFirst({
      where: {
        projectId,
        status: 'PUBLISHED',
        type: 'VIDEO',
      },
      include: { publishedVideo: true },
      orderBy: { createdAt: 'desc' },
    });
    if (level4) {
      return this.mapAssetToReceipt(level4, 'HEURISTIC_LATEST_PUBLISHED_ASSET');
    }

    // No asset found - Return full null set with error code
    return {
      asset_id: null,
      hls_url: null,
      mp4_url: null,
      checksum: null,
      storage_key: null,
      duration_sec: null,
      fallback_reason: null,
      error_code: 'ERR_ASSET_NOT_FOUND',
    };
  }

  private mapAssetToReceipt(asset: any, fallbackReason: string | null): V3AssetReceipt {
    const metadata = (asset.publishedVideo?.metadata as any) || {};
    const directorLayer =
      metadata.directorLayer &&
      typeof metadata.directorLayer === 'object' &&
      !Array.isArray(metadata.directorLayer)
        ? metadata.directorLayer
        : null;
    return {
      asset_id: asset.id,
      hls_url: asset.hlsPlaylistUrl,
      mp4_url: asset.signedUrl,
      checksum: asset.checksum,
      storage_key: asset.storageKey,
      duration_sec: metadata.duration_sec || 0,
      fallback_reason: fallbackReason,
      director_layer: directorLayer
        ? {
            scene_id: directorLayer.sceneId ?? null,
            film_ir_id: directorLayer.filmIrId ?? null,
            gate_verdict: directorLayer.latestGateVerdict ?? null,
            gate_reason: directorLayer.gateReason ?? null,
            threshold_profile: directorLayer.thresholdProfile ?? null,
            coverage_role: directorLayer.coverageRole ?? null,
            rhythm_class: directorLayer.rhythmClass ?? null,
            transition_hint: directorLayer.transitionHint ?? null,
            rhythm_strategy: directorLayer.editingRhythmStrategy ?? null,
            audio_master_priority: directorLayer.audioMasterPriority ?? null,
            silence_strategy: directorLayer.silenceStrategy ?? null,
          }
        : null,
    };
  }
}
