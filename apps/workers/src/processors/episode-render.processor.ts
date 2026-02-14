import { AssetOwnerType, AssetType } from 'database';
import { config } from 'config';
import * as path from 'path';
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

export async function processEpisodeRenderJob(ctx: ProcessorContext) {
  const { prisma, job, apiClient } = ctx;
  const payload = job.payload as EpisodeRenderPayload;
  const { episodeId, projectId } = payload;
  const traceId = job.traceId || payload.traceId || `trace-${job.id}`;

  if (!episodeId) {
    throw new Error(`[EpisodeRender] Missing episodeId in payload`);
  }

  const logger = ctx.logger || console;
  logger.log(`[EpisodeRender] Processing episodeId=${episodeId} job=${job.id}`);

  // 1. Fetch Scenes in Order (Sort by sceneIndex)
  const scenes = await prisma.scene.findMany({
    where: { episodeId },
    orderBy: { sceneIndex: 'asc' }, // Fixed: index -> sceneIndex
  });

  if (scenes.length === 0) {
    throw new Error(`[EpisodeRender] No scenes found for episodeId=${episodeId}`);
  }

  // 2. Manual Asset Fetch (Schema lacks Scene.assets relation)
  const sceneIds = scenes.map((s) => s.id);
  const videoAssets = await prisma.asset.findMany({
    where: {
      ownerId: { in: sceneIds },
      ownerType: AssetOwnerType.SCENE, // Matches enum
      type: AssetType.VIDEO,
      status: 'GENERATED',
    },
  });

  // Map SceneID -> Asset
  const assetMap = new Map<String, any>();
  videoAssets.forEach((a) => assetMap.set(a.ownerId, a));

  // 3. Validate Completeness
  const sceneVideoPaths: string[] = [];
  const missingScenes: string[] = [];

  const storageRoot = config.storageRoot;

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

  logger.log(`[EpisodeRender] Concatenating ${sceneVideoPaths.length} scenes to ${outputPath}`);

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
  // WORKAROUND: Use AssetOwnerType.SCENE for Episode Asset until schema migration

  const stat = await fsp.stat(outputPath);

  const asset = await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type: {
        ownerType: AssetOwnerType.SCENE, // Hack: Should be EPISODE
        ownerId: episodeId,
        type: AssetType.VIDEO,
      },
    },
    update: {
      storageKey: outputRelative,
      status: 'GENERATED',
      createdByJobId: job.id,
    },
    create: {
      projectId,
      ownerType: AssetOwnerType.SCENE, // Hack
      ownerId: episodeId,
      type: AssetType.VIDEO,
      storageKey: outputRelative,
      status: 'GENERATED',
      createdByJobId: job.id,
    },
  });

  // Also Create PublishedVideo if needed
  await prisma.publishedVideo.upsert({
    where: { assetId: asset.id },
    update: {
      storageKey: outputRelative,
      checksum: 'SKIP', // TODO
      status: 'PUBLISHED',
    },
    create: {
      projectId,
      episodeId,
      assetId: asset.id,
      storageKey: outputRelative,
      checksum: 'SKIP',
      status: 'PUBLISHED',
    },
  });

  // 6. Audit
  await apiClient
    .postAuditLog({
      traceId,
      projectId,
      jobId: job.id,
      jobType: 'EPISODE_RENDER' as any,
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
    .catch((e) => console.error('Audit failed', e));

  return {
    status: 'SUCCEEDED',
    output: {
      assetId: asset.id,
      storageKey: outputRelative,
      sceneCount: scenes.length,
    },
  };
}
