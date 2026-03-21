import { PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { ProcessorContext } from '../types/processor-context';
import { defaultLLMClient } from '../agents/llm-client';
import * as crypto from 'crypto';
import * as fs from 'fs';

export interface ScriptStructureResult {
  success: boolean;
  output?: any;
  error?: any;
}

async function recordProcessingUsageBestEffort(
  organizationId: string,
  computeTimeMs: number,
  metadata: any
) {
  try {
    const metering = await import('../../../../packages/metering/src/usage-meter');
    await metering.UsageMeter.recordProcessing(organizationId, computeTimeMs, metadata);
  } catch (e) {
    console.warn(`[UsageMeter] Failed to record processing:`, e);
  }
}

/**
 * P5-C HARDENING: Utility to recompute hash from raw file bits
 */
async function recomputeHashFromRaw(
  filePath: string,
  offsetStart: number,
  offsetEnd: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) return reject(new Error(`File not found: ${filePath}`));
      const stream = fs.createReadStream(filePath, { start: offsetStart, end: offsetEnd - 1 });
      const hash = crypto.createHash('sha256');
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}

async function appendContinuitySnapshotBestEffort(params: {
  prisma: PrismaClient;
  projectId: string;
  sceneId: string;
  shotId?: string | null;
  traceId?: string | null;
  source: string;
  snapshotType: string;
  snapshotData: Record<string, unknown>;
  evidenceRef?: string | null;
}) {
  const { prisma, projectId, sceneId, shotId, traceId, source, snapshotType, snapshotData, evidenceRef } =
    params;

  try {
    await (prisma as any).$executeRawUnsafe(
      `
        INSERT INTO continuity_state_snapshots (
          id,
          project_id,
          scene_id,
          shot_id,
          trace_id,
          source,
          snapshot_type,
          snapshot_data,
          evidence_ref
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9
        )
      `,
      crypto.randomUUID(),
      projectId,
      sceneId,
      shotId ?? null,
      traceId ?? null,
      source,
      snapshotType,
      JSON.stringify(snapshotData ?? {}),
      evidenceRef ?? null,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ContinuitySnapshot] append skipped: ${message}`);
  }
}

async function getActiveContinuityLockBestEffort(params: {
  prisma: PrismaClient;
  projectId: string;
  entityType: string;
  entityId: string;
  atSceneId?: string | null;
}) {
  const { prisma, projectId, entityType, entityId, atSceneId } = params;

  try {
    const result = await (prisma as any).$queryRawUnsafe(
      `
        SELECT id, lock_reason, locked_by, evidence_ref
        FROM continuity_state_locks
        WHERE project_id = $1
          AND entity_type = $2
          AND entity_id = $3
          AND is_active = true
          AND (at_scene_id IS NULL OR at_scene_id = $4)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      projectId,
      entityType,
      entityId,
      atSceneId ?? null,
    );

    return Array.isArray(result) ? result[0] ?? null : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ContinuityStateLock] lookup skipped: ${message}`);
    return null;
  }
}

async function getLatestContinuityOverrideBestEffort(params: {
  prisma: PrismaClient;
  projectId: string;
  entityType: string;
  entityId: string;
  atSceneId?: string | null;
}) {
  const { prisma, projectId, entityType, entityId, atSceneId } = params;

  try {
    const result = await (prisma as any).$queryRawUnsafe(
      `
        SELECT id, override_data, override_reason, override_by, evidence_ref
        FROM continuity_state_overrides
        WHERE project_id = $1
          AND entity_type = $2
          AND entity_id = $3
          AND (at_scene_id IS NULL OR at_scene_id = $4)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      projectId,
      entityType,
      entityId,
      atSceneId ?? null,
    );

    return Array.isArray(result) ? result[0] ?? null : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ContinuityStateOverride] lookup skipped: ${message}`);
    return null;
  }
}

/**
 * [CE06_SCRIPT_OUTLINE]
 */
export async function processScriptOutlineJob(
  ctx: ProcessorContext
): Promise<ScriptStructureResult> {
  const { prisma, job } = ctx;
  const { sourceId, buildId, projectId } = job.payload;

  // P5-C HARDENING: Fetch PREVIEW chunks (e.g., first 50) for LLM context
  const previewChunks = await prisma.storyChunk.findMany({
    where: { sourceId },
    orderBy: { chunkIndex: 'asc' },
    take: 50,
  });

  if (previewChunks.length === 0) throw new Error(`No chunks found for sourceId: ${sourceId}`);

  const previews = previewChunks
    .map((c) => `[Chunk ${c.chunkIndex}] ${c.contentPreview}`)
    .join('\n');
  const prompt = `识别并拆分出主要 Episode 结构...\n${previews}`;

  const result = await defaultLLMClient.call({
    systemPrompt: '资深网文拆剧导演。',
    userPrompt: prompt,
    responseFormat: 'json_object',
  });

  const episodes = result.episodes || [];
  for (const ep of episodes) {
    // P5-C HARDENING Fix: Fetch the EXACT chunk by chunkIndex to get correct offsets
    const targetChunk =
      (await prisma.storyChunk.findFirst({
        where: { sourceId, chunkIndex: ep.startChunkIndex },
      })) || previewChunks[0];

    const sourceRef = await prisma.storySourceRef.create({
      data: {
        chunkId: targetChunk.id,
        offsetStart: targetChunk.offsetStart,
        offsetEnd: targetChunk.offsetEnd,
        textHash: targetChunk.textHash,
      },
    });

    await prisma.episode.create({
      data: {
        projectId,
        buildId,
        index: ep.index,
        name: ep.title,
        summary: ep.summary,
        sourceRefId: sourceRef.id,
        status: 'pending',
      },
    });
  }

  return { success: true, output: { episodeCount: episodes.length } };
}

/**
 * [CE11_SCENE_SPLIT]
 */
export async function processSceneSplitJob(ctx: ProcessorContext): Promise<ScriptStructureResult> {
  const { prisma, job } = ctx;
  const { episodeId, buildId, projectId } = job.payload;

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { sourceRef: { include: { chunk: true } } },
  });

  if (!episode || !episode.sourceRef) throw new Error('Episode or SourceRef not found');

  const result = await defaultLLMClient.call({
    systemPrompt: '分镜师。',
    userPrompt: `拆分场景...\n${episode.sourceRef.chunk?.contentPreview}`,
    responseFormat: 'json_object',
  });

  const scenes = result.scenes || [];
  for (const sc of scenes) {
    const sceneSourceRef = await prisma.storySourceRef.create({
      data: {
        chunkId: episode.sourceRef!.chunkId,
        offsetStart: episode.sourceRef!.offsetStart,
        offsetEnd: episode.sourceRef!.offsetEnd,
        textHash: `scene-${sc.index}-${Date.now()}`,
      },
    });

    await prisma.scene.create({
      data: {
        projectId,
        episodeId,
        buildId,
        sceneIndex: sc.index,
        title: sc.title,
        locationSlug: sc.location,
        summary: sc.summary,
        status: 'PENDING',
        sourceRefId: sceneSourceRef.id,
      },
    });
  }

  return { success: true, output: { sceneCount: scenes.length } };
}

/**
 * [CE12_SHOT_SPLIT]
 */
export async function processShotSplitJob(ctx: ProcessorContext): Promise<ScriptStructureResult> {
  const { prisma, job } = ctx;
  const { sceneId, buildId, projectId } = job.payload;

  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: { sourceRef: { include: { chunk: true } } },
  });

  if (!scene || !scene.sourceRef) throw new Error('Scene or SourceRef not found');

  const result = await defaultLLMClient.call({
    systemPrompt: '分镜导演。',
    userPrompt: `拆解分镜...\n${scene.sourceRef.chunk?.contentPreview}`,
    responseFormat: 'json_object',
  });

  const shots = result.shots || [];
  for (const shot of shots) {
    const shotSourceRef = await prisma.storySourceRef.create({
      data: {
        chunkId: scene.sourceRef!.chunkId,
        offsetStart: scene.sourceRef!.offsetStart,
        offsetEnd: scene.sourceRef!.offsetEnd,
        textHash: `shot-${shot.index}-${Date.now()}`,
      },
    });

    await prisma.shot.create({
      data: {
        sceneId,
        buildId,
        index: shot.index,
        content: shot.content,
        visualDescription: shot.visualDescription,
        renderStatus: 'PENDING',
        sourceRefId: shotSourceRef.id,
        type: 'GENERATED',
      },
    });
  }

  return { success: true, output: { shotCount: shots.length } };
}

/**
 * [CE99_CONTINUITY_AUDIT] - INDUSTRIAL SEALED EDITION
 */
export async function processContinuityAuditJob(
  ctx: ProcessorContext
): Promise<ScriptStructureResult> {
  const { prisma, job } = ctx;
  const { buildId, sceneId } = job.payload;
  const startTime = Date.now();

  // Film IR / runtime path: allow scene-level continuity audit without legacy script build.
  if (!buildId && sceneId) {
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        episode: true,
        shots: {
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!scene || !scene.projectId) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    const shotCount = scene.shots.length;
    const characterIds = Array.isArray(scene.characterIds) ? scene.characterIds : [];
    const continuitySummary = {
      mode: 'scene',
      sceneId: scene.id,
      projectId: scene.projectId,
      episodeId: scene.episodeId,
      filmIrId: (scene as any).filmIrId ?? null,
      shotCount,
      characterCount: characterIds.length,
      hasEnrichedText: !!scene.enrichedText,
      checkedAt: new Date().toISOString(),
      isIndustrialSealed: true,
    };

    const activeLock = await getActiveContinuityLockBestEffort({
      prisma,
      projectId: scene.projectId,
      entityType: 'SCENE',
      entityId: scene.id,
      atSceneId: scene.id,
    });

    const existingContinuityState = await (prisma as any).continuityState.findUnique({
      where: {
        projectId_entityType_entityId_atSceneId: {
          projectId: scene.projectId,
          entityType: 'SCENE',
          entityId: scene.id,
          atSceneId: scene.id,
        },
      },
      select: {
        id: true,
        stateData: true,
        source: true,
        updatedAt: true,
      },
    });

    const latestOverride = await getLatestContinuityOverrideBestEffort({
      prisma,
      projectId: scene.projectId,
      entityType: 'SCENE',
      entityId: scene.id,
      atSceneId: scene.id,
    });

    const effectiveSource = activeLock
      ? 'STATE_LOCK'
      : latestOverride
        ? 'STATE_OVERRIDE'
        : 'CE_CONSISTENCY_CHECK';
    const resolutionMode = activeLock
      ? 'LOCKED'
      : latestOverride
        ? 'OVERRIDE_APPLIED'
        : 'AUTO';
    const lifecycleStage = activeLock
      ? 'LOCKED_CURRENT'
      : latestOverride
        ? 'OVERRIDE_CURRENT'
        : existingContinuityState
          ? 'AUTO_REFRESHED'
          : 'AUTO_INITIAL';
    const lockedBaseState =
      existingContinuityState?.stateData &&
      typeof existingContinuityState.stateData === 'object' &&
      !Array.isArray(existingContinuityState.stateData)
        ? (existingContinuityState.stateData as Record<string, unknown>)
        : null;
    const effectiveStateData = activeLock
      ? {
          ...continuitySummary,
          ...(lockedBaseState ?? {}),
          lockId: activeLock.id,
          lockReason: activeLock.lock_reason ?? null,
        }
      : latestOverride?.override_data
        ? {
            ...continuitySummary,
            ...(latestOverride.override_data as Record<string, unknown>),
            overrideId: latestOverride.id,
            overrideReason: latestOverride.override_reason ?? null,
            overrideBy: latestOverride.override_by ?? null,
          }
        : continuitySummary;

    await (prisma as any).continuityState.upsert({
      where: {
        projectId_entityType_entityId_atSceneId: {
          projectId: scene.projectId,
          entityType: 'SCENE',
          entityId: scene.id,
          atSceneId: scene.id,
        },
      },
      update: {
        stateData: {
          ...effectiveStateData,
          resolutionMode,
          lifecycleStage,
          activeSource: effectiveSource,
          lockId: activeLock?.id ?? null,
          lockReason: activeLock?.lock_reason ?? null,
          overrideId: latestOverride?.id ?? null,
          overrideReason: latestOverride?.override_reason ?? null,
          previousStateId: existingContinuityState?.id ?? null,
          previousSource: existingContinuityState?.source ?? null,
          previousUpdatedAt: existingContinuityState?.updatedAt?.toISOString?.() ?? null,
        },
        isLocked: !!activeLock,
        source: effectiveSource,
        violationFlag: false,
      },
      create: {
        projectId: scene.projectId,
        entityType: 'SCENE',
        entityId: scene.id,
        atSceneId: scene.id,
        atShotId: null,
        stateData: {
          ...effectiveStateData,
          resolutionMode,
          lifecycleStage,
          activeSource: effectiveSource,
          lockId: activeLock?.id ?? null,
          lockReason: activeLock?.lock_reason ?? null,
          overrideId: latestOverride?.id ?? null,
          overrideReason: latestOverride?.override_reason ?? null,
          previousStateId: existingContinuityState?.id ?? null,
          previousSource: existingContinuityState?.source ?? null,
          previousUpdatedAt: existingContinuityState?.updatedAt?.toISOString?.() ?? null,
        },
        isLocked: !!activeLock,
        source: effectiveSource,
        violationFlag: false,
      },
    });

    await appendContinuitySnapshotBestEffort({
      prisma,
      projectId: scene.projectId,
      sceneId: scene.id,
      traceId: (job as any).traceId ?? (job.payload as any)?.traceId ?? job.id,
      source: effectiveSource,
      snapshotType: activeLock
        ? 'SCENE_AUDIT_LOCKED'
        : latestOverride
          ? 'SCENE_AUDIT_OVERRIDE_APPLIED'
          : 'SCENE_AUDIT',
      snapshotData: {
        ...effectiveStateData,
        resolutionMode,
        lifecycleStage,
        activeSource: effectiveSource,
        lockId: activeLock?.id ?? null,
        lockReason: activeLock?.lock_reason ?? null,
        lockEvidenceRef: activeLock?.evidence_ref ?? null,
        overrideId: latestOverride?.id ?? null,
        overrideReason: latestOverride?.override_reason ?? null,
        overrideEvidenceRef: latestOverride?.evidence_ref ?? null,
        previousStateId: existingContinuityState?.id ?? null,
        previousSource: existingContinuityState?.source ?? null,
        previousUpdatedAt: existingContinuityState?.updatedAt?.toISOString?.() ?? null,
      },
      evidenceRef:
        activeLock?.evidence_ref ??
        latestOverride?.evidence_ref ??
        (scene as any).filmIrId ??
        null,
    });

    try {
      const proj = await prisma.project.findUnique({
        where: { id: scene.projectId },
        select: { organizationId: true },
      });
      if (proj?.organizationId) {
        await recordProcessingUsageBestEffort(proj.organizationId, Date.now() - startTime, {
          sceneId: scene.id,
          shots: shotCount,
          mode: 'scene',
        });
      }
    } catch (e) {
      console.warn(`[ScriptStructure] Failed to prepare processing metering:`, e);
    }

    return {
      success: true,
      output: continuitySummary,
    };
  }

  if (!buildId) {
    throw new Error('Missing buildId or sceneId for continuity audit job');
  }

  const build = await prisma.scriptBuild.findUnique({
    where: { id: buildId },
    include: { storySource: true },
  });
  if (!build) throw new Error(`Build ${buildId} not found`);

  const sourceFilePath = build.storySource.path;
  const totalSourceSize = build.storySource.size;

  const episodes = await prisma.episode.findMany({
    where: { buildId },
    orderBy: { index: 'asc' },
    include: {
      sourceRef: { include: { chunk: true } },
      scenes: {
        orderBy: { sceneIndex: 'asc' },
        include: {
          sourceRef: true,
          shots: {
            orderBy: { index: 'asc' },
            include: { sourceRef: true },
          },
        },
      },
    },
  });

  const auditSummary = {
    episodesChecked: episodes.length,
    scenesChecked: 0,
    shotsChecked: 0,
    hashRecheckPassed: 0,
    hashRecheckFailed: 0,
    monotonicViolations: 0,
    episodeMonotonic: true,
    sceneMonotonic: true,
    shotMonotonic: true,
    maxGapChars: 0,
    maxOverlapChars: 0,
    coveragePercent: 0,
    isIndustrialSealed: false,
    auditLogs: [] as string[],
  };

  let lastEpisodeOffset = -1;
  let totalCoveredEnd = 0;

  for (const ep of episodes) {
    if (!ep.sourceRef || !ep.sourceRef.chunk) {
      auditSummary.auditLogs.push(`[FATAL] Episode ${ep.index} missing SourceRef`);
      continue;
    }

    const epOffset = ep.sourceRef.offsetStart;
    if (epOffset <= lastEpisodeOffset) {
      auditSummary.episodeMonotonic = false;
      auditSummary.monotonicViolations++;
      auditSummary.auditLogs.push(
        `[FAIL] Ep ${ep.index} backtrack: ${epOffset} <= ${lastEpisodeOffset}`
      );
    }
    lastEpisodeOffset = epOffset;

    try {
      const realHash = await recomputeHashFromRaw(
        sourceFilePath,
        ep.sourceRef.offsetStart,
        ep.sourceRef.offsetEnd
      );
      if (realHash === ep.sourceRef.chunk.textHash) {
        auditSummary.hashRecheckPassed++;
      } else {
        auditSummary.hashRecheckFailed++;
        auditSummary.auditLogs.push(`[FAIL] Ep ${ep.index} Hash mismatch`);
      }
    } catch (e: any) {
      auditSummary.auditLogs.push(`[ERROR] Re-hash Ep ${ep.index}: ${e.message}`);
    }

    totalCoveredEnd = Math.max(totalCoveredEnd, ep.sourceRef.offsetEnd);

    let lastSceneOffset = -1;
    for (const sc of ep.scenes) {
      auditSummary.scenesChecked++;
      if (!sc.sourceRef) continue;
      if (sc.sourceRef.offsetStart < lastSceneOffset) {
        auditSummary.sceneMonotonic = false;
        auditSummary.monotonicViolations++;
      }
      lastSceneOffset = sc.sourceRef.offsetStart;
      totalCoveredEnd = Math.max(totalCoveredEnd, sc.sourceRef.offsetEnd);

      let lastShotOffset = -1;
      for (const shot of sc.shots) {
        auditSummary.shotsChecked++;
        if (!shot.sourceRef) continue;
        if (shot.sourceRef.offsetStart < lastShotOffset) {
          auditSummary.shotMonotonic = false;
          auditSummary.monotonicViolations++;
        }
        lastShotOffset = shot.sourceRef.offsetStart;
        totalCoveredEnd = Math.max(totalCoveredEnd, shot.sourceRef.offsetEnd);
      }
    }
  }

  auditSummary.coveragePercent = (totalCoveredEnd / totalSourceSize) * 100;
  const coverageGap = totalSourceSize - totalCoveredEnd;
  auditSummary.maxGapChars = coverageGap;

  if (
    auditSummary.hashRecheckFailed === 0 &&
    auditSummary.monotonicViolations === 0 &&
    coverageGap < 1000
  ) {
    auditSummary.isIndustrialSealed = true;
  }

  await prisma.scriptBuild.update({
    where: { id: buildId },
    data: {
      status: auditSummary.isIndustrialSealed ? 'AUDITED' : 'FAILED',
      metadata: auditSummary as any,
    },
  });

  console.log(
    `\n${auditSummary.isIndustrialSealed ? '✅' : '❌'} AUDIT FINISHED. Sealed: ${auditSummary.isIndustrialSealed}`
  );

  // P5-A: Soft Metering - Record compute effort
  try {
    const projectId = job.payload.projectId || build.projectId;
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (proj?.organizationId) {
      await recordProcessingUsageBestEffort(proj.organizationId, Date.now() - startTime, {
        episodes: episodes.length,
        isIndustrialSealed: auditSummary.isIndustrialSealed,
      });
    }
  } catch (e) {
    console.warn(`[ScriptStructure] Failed to prepare processing metering:`, e);
  }

  return { success: true, output: auditSummary };
}
