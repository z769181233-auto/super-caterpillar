import { AssetOwnerType, AssetRole, AssetStatus, AssetType, JobType } from 'database';
import { config } from '@scu/config';
import * as path from 'path';
import { createHash } from 'crypto';
import { promises as fsp } from 'fs';
import { spawn } from 'child_process';
import { ProcessorContext } from '../types/processor-context';

import { ensureDir, fileExists } from '../../../../packages/shared/fs_async';

export interface EpisodeRenderPayload {
  projectId: string;
  episodeId: string;
  pipelineRunId?: string;
  traceId?: string;
}

function requireNonEmptyString(value: unknown, contextTag: string, field: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  throw new Error(`[${contextTag}] Missing ${field}`);
}

export async function processEpisodeRenderJob(ctx: ProcessorContext) {
  const { prisma, job, apiClient } = ctx;
  const payload = job.payload as EpisodeRenderPayload;
  const { episodeId, projectId } = payload;
  const traceId = requireNonEmptyString(job.traceId ?? payload.traceId, 'EpisodeRender', 'traceId');

  if (!episodeId) {
    throw new Error(`[EpisodeRender] Missing episodeId in payload`);
  }
  if (!projectId) {
    throw new Error(`[EpisodeRender] Missing projectId in payload`);
  }

  ctx.logger?.log?.(`[EpisodeRender] Processing episodeId=${episodeId} job=${job.id}`);

  // 1. Fetch Scenes in Order (Sort by sceneIndex)
  const scenes = await prisma.scene.findMany({
    where: { episodeId },
    orderBy: { sceneIndex: 'asc' }, // Fixed: index -> sceneIndex
  });

  if (scenes.length === 0) {
    throw new Error(`[EpisodeRender] No scenes found for episodeId=${episodeId}`);
  }

  // 2. Manual Asset Fetch (Schema lacks Scene.asset relation)
  const sceneIds = scenes.map((s) => s.id);
  const videoAssets = await prisma.asset.findMany({
    where: {
      ownerId: { in: sceneIds },
      ownerType: AssetOwnerType.SCENE,
      role: AssetRole.SCENE_MASTER,
      type: AssetType.VIDEO,
      status: { in: [AssetStatus.GENERATED, AssetStatus.PUBLISHED] },
    },
  });

  // Map SceneID -> Asset
  const assetMap = new Map<string, (typeof videoAssets)[number]>();
  videoAssets.forEach((a) => assetMap.set(a.ownerId, a));

  // 3. Validate Completeness
  const sceneVideoPaths: string[] = [];
  const missingScenes: string[] = [];

  const storageRoot = (config as unknown as { storageRoot: string }).storageRoot;

  for (const scene of scenes) {
    const asset = assetMap.get(scene.id);
    if (!asset || !asset.storageKey) {
      missingScenes.push(`Scene ${scene.sceneIndex} (${scene.id})`);
      continue;
    }

    const absPath = path.resolve(storageRoot, asset.storageKey);
    if (!(await fileExists(absPath))) {
      missingScenes.push(`Scene ${scene.sceneIndex} (${scene.id}) - File Missing`);
      continue;
    }

    sceneVideoPaths.push(absPath);
  }

  if (missingScenes.length > 0) {
    throw new Error(
      `[EpisodeRender] Incomplete scenes. Missing videos for: ${missingScenes.join(', ')}`
    );
  }

  // 4. Concat Scenes
  const tempDir = path.resolve(storageRoot, 'temp_episodes', job.id);
  await ensureDir(tempDir);

  const concatListPath = path.join(tempDir, 'episode_concat.txt');
  // FFmpeg concat expects: file '/path/to/file'
  const concatContent = sceneVideoPaths.map((p) => `file '${p}'`).join('\n');
  await fsp.writeFile(concatListPath, concatContent);

  const outputRelative = `renders/${projectId}/episodes/${episodeId}/full_episode.mp4`;
  const outputPath = path.resolve(storageRoot, outputRelative);
  await ensureDir(path.dirname(outputPath));

  ctx.logger?.log?.(
    `[EpisodeRender] Concatenating ${sceneVideoPaths.length} scenes to ${outputPath}`
  );

  const args = ['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', '-y', outputPath];

  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args);
    let errOutput = '';
    child.stderr.on('data', (d) => (errOutput += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with ${code}: ${errOutput}`));
    });
  });

  // 5. Persistence
  const stat = await fsp.stat(outputPath);
  const outputBuffer = await fsp.readFile(outputPath);
  const checksum = createHash('sha256').update(outputBuffer).digest('hex');

  const asset = await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type_role: {
        role: AssetRole.EPISODE_MASTER,
        ownerType: AssetOwnerType.EPISODE,
        ownerId: episodeId,
        type: AssetType.VIDEO,
      },
    },
    update: {
      storageKey: outputRelative,
      checksum,
      status: 'PUBLISHED',
      createdByJobId: job.id,
    },
    create: {
      projectId,
      ownerType: AssetOwnerType.EPISODE,
      ownerId: episodeId,
      role: AssetRole.EPISODE_MASTER,
      type: AssetType.VIDEO,
      storageKey: outputRelative,
      checksum,
      status: 'PUBLISHED',
      createdByJobId: job.id,
    },
  });

  // Record internal readiness without claiming API-side publish reconciliation already happened.
  await prisma.publishedVideo.upsert({
    where: { assetId: asset.id },
    update: {
      storageKey: outputRelative,
      checksum,
      status: 'INTERNAL_READY',
      metadata: {
        pipelineRunId: payload.pipelineRunId ?? null,
        source: 'episode_render_worker',
      },
    },
    create: {
      projectId,
      episodeId,
      assetId: asset.id,
      storageKey: outputRelative,
      checksum,
      status: 'INTERNAL_READY',
      metadata: {
        pipelineRunId: payload.pipelineRunId ?? null,
        source: 'episode_render_worker',
      },
    },
  });

  // 6. Audit
  await apiClient
    .postAuditLog({
      traceId,
      projectId,
      jobId: job.id,
      jobType: JobType.EPISODE_RENDER,
      engineKey: 'episode_assembler',
      status: 'SUCCESS',
      auditTrail: {
        action: 'episode.render.success',
        episodeId,
        sceneCount: scenes.length,
        output: outputRelative,
        sizeBytes: stat.size,
      },
    })
    .catch(() => {});

  return {
    status: 'SUCCEEDED',
    output: {
      assetId: asset.id,
      storageKey: outputRelative,
      sceneCount: scenes.length,
    },
  };
}
