import { JobType, AssetOwnerType, AssetType, PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { readFileUnderLimit } from '../../../../packages/shared/fs_safe';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { fileExists, ensureDir } from '../../../../packages/shared/fs_async';
import { spawn } from 'child_process';
import { TimelineData } from './timeline-compose.processor';

export interface TimelinePreviewParams {
  prisma: PrismaClient;
  job: {
    id: string;
    payload: {
      timelineStorageKey: string;
      pipelineRunId: string;
    };
    organizationId: string;
    projectId: string;
    episodeId?: string;
    sceneId?: string;
    traceId?: string;
  };
  apiClient: ApiClient;
}

/**
 * CE11: Timeline Preview Processor
 * 职责：执行时间轴渲染，生成预览资产（绑定至 Scene），并触发 CE09 安全处理。
 * 策略：Asset 物理隔离（OwnerType=SCENE），安全链路统一（CE09）。
 */
export async function processTimelinePreviewJob({ prisma, job, apiClient }: TimelinePreviewParams) {
  const startTime = Date.now();
  const { timelineStorageKey, pipelineRunId } = job.payload;
  const traceId = job.traceId || `trace - ${Date.now()} `;
  const projectId = job.projectId;

  const timelineAbsPath = path.resolve(process.cwd(), '.runtime', timelineStorageKey);
  console.log(`[TimelinePreview][${traceId}] Loading timeline from: ${timelineAbsPath} `);

  // 0. Load Timeline Data
  if (!(await fileExists(timelineAbsPath))) {
    throw new Error(`[TimelinePreview] Timeline file not found: ${timelineAbsPath} `);
  }
  // Safe read timeline JSON (Limit 10MB)
  const timelineJson = await readFileUnderLimit(timelineAbsPath, 10 * 1024 * 1024);
  const timeline: TimelineData = JSON.parse(timelineJson);

  // Validation
  if (timeline.shots.length < 1) {
    throw new Error(`[TimelinePreview] Fail - fast: Timeline must contain at least 1 shot.`);
  }

  const fps = timeline.fps || 24;
  const width = timeline.width || 1280;
  const height = timeline.height || 720;

  // FFmpeg Fail-fast check
  try {
    await new Promise((resolve, reject) => {
      const check = spawn('ffmpeg', ['-version']);
      check.on('error', reject);
      check.on('close', (code) => {
        if (code === 0) resolve(true);
        else reject(new Error(`ffmpeg check exited with code ${code} `));
      });
    });
  } catch (e: any) {
    throw new Error(`[TimelinePreview] FFmpeg binary missing: ${e.message} `);
  }

  const tempMp4Dir = path.resolve(process.cwd(), '.runtime', 'temp_mp4s', pipelineRunId);
  if (!(await fileExists(tempMp4Dir))) await ensureDir(tempMp4Dir);

  const shotMp4Paths: string[] = [];

  // Stage 1: Per-Shot MP4 Generation (Reuse valid Assets or Generate)
  for (const shot of timeline.shots) {
    console.log(`[TimelinePreview] Stage 1: Processing shotId = ${shot.shotId} `);

    const shotOutputPath = path.join(tempMp4Dir, `shot_${shot.shotId}.mp4`);

    // SSOT Check: Check DB for existing valid Asset (Formal Render)
    const existingAsset = await prisma.asset.findUnique({
      where: {
        ownerType_ownerId_type: {
          ownerType: AssetOwnerType.SHOT,
          ownerId: shot.shotId,
          type: AssetType.VIDEO,
        },
      },
    });

    if (existingAsset && existingAsset.status === 'GENERATED') {
      const fullPath = path.resolve(process.cwd(), '.runtime', existingAsset.storageKey);
      if (await fileExists(fullPath)) {
        console.log(`[TimelinePreview] Reusing existing Asset for shotId = ${shot.shotId}`);
        shotMp4Paths.push(fullPath);
        continue;
      }
    }

    // Fallback: Generate if missing
    const framesTxt = path.resolve(process.cwd(), '.runtime', shot.framesTxtStorageKey);
    if (!(await fileExists(framesTxt))) {
      throw new Error(
        `[TimelinePreview] Fail - fast: frames.txt not found for shotId = ${shot.shotId} at ${framesTxt} `
      );
    }

    const args = [
      '-r',
      fps.toString(),
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      framesTxt,
      '-s',
      `${width}x${height} `,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-y',
      shotOutputPath,
    ];

    await runFfmpeg(args, `Stage1_Shot_${shot.shotId} `);
    shotMp4Paths.push(shotOutputPath);
  }

  // Preview Output Path: Isolated from 'renders/' to avoid mixing formal outputs
  const finalOutputRelative = `previews/${projectId}/${timeline.sceneId}/${pipelineRunId}_preview.mp4`;
  const finalOutputPath = path.resolve(process.cwd(), '.runtime', finalOutputRelative);
  const finalOutputDir = path.dirname(finalOutputPath);
  if (!(await fileExists(finalOutputDir))) await ensureDir(finalOutputDir);

  const hasTransitions = timeline.shots.some((s) => s.transition && s.transition !== 'none');
  const tracks = timeline.audio?.tracks || [];
  const hasDucking = tracks.some((t) => t.ducking);
  const forcePathB = hasTransitions || tracks.length > 1 || hasDucking;

  if (!forcePathB) {
    // Path A: Simple Concat
    console.log(`[TimelinePreview][Path A] Simple Concat(Demuxer / Copy)`);
    const concatListPath = path.join(tempMp4Dir, 'scene_concat.txt');

    const concatArgs = ['-f', 'concat', '-safe', '0', '-i', concatListPath];

    if (tracks.length === 1 && tracks[0].storageKey) {
      const audioPath = path.resolve(process.cwd(), '.runtime', tracks[0].storageKey);
      if (await fileExists(audioPath)) {
        concatArgs.push('-i', audioPath);
        concatArgs.push('-map', '0:v', '-map', '1:a');
      }
    }

    concatArgs.push('-c', 'copy', '-y', finalOutputPath);
    await runFfmpeg(concatArgs, `Stage2_SimpleConcat`);
  } else {
    // Path B: Advanced Composition
    console.log(`[TimelinePreview][Path B] Advanced Composition(Mixing & Ducking)`);
    const complexArgs: string[] = [];

    shotMp4Paths.forEach((p) => complexArgs.push('-i', p));

    const audioInputsOffset = shotMp4Paths.length;
    for (const track of tracks) {
      if (track.storageKey) {
        const audioPath = path.resolve(process.cwd(), '.runtime', track.storageKey);
        if (await fileExists(audioPath)) {
          if (track.loop) complexArgs.push('-stream_loop', '-1');
          complexArgs.push('-i', audioPath);
        }
      }
    }

    let filterString = '';
    let lastVideoStream = '[0:v]';
    let currentTimelineDuration = timeline.shots[0].durationFrames / fps;

    for (let i = 1; i < timeline.shots.length; i++) {
      const shot = timeline.shots[i];
      const outStream = `[v_step${i}]`;
      if (shot.transition === 'xfade') {
        const transDur = shot.transitionFrames / fps;
        const offset = currentTimelineDuration - transDur;
        filterString += `${lastVideoStream} [${i}: v]xfade = transition = fade: duration = ${transDur.toFixed(3)}: offset = ${offset.toFixed(3)}${outStream}; `;
        currentTimelineDuration = currentTimelineDuration + shot.durationFrames / fps - transDur;
      } else {
        filterString += `${lastVideoStream} [${i}: v]concat = n = 2: v = 1: a = 0${outStream}; `;
        currentTimelineDuration += shot.durationFrames / fps;
      }
      lastVideoStream = outStream;
    }
    const finalVideoLabel = `[v_final]`;
    filterString += `${lastVideoStream}copy${finalVideoLabel}; `;

    // Audio Chain (Reuse S4-9 Logic)
    const sidechainTargets = new Set<string>();
    tracks.forEach((t) => {
      if (t.ducking?.target) {
        const targetTrack = tracks.find(
          (r) => r.id === t.ducking!.target || r.type === t.ducking!.target
        );
        if (targetTrack) sidechainTargets.add(targetTrack.id);
      }
    });

    const trackLabels: string[] = [];
    tracks.forEach((track, idx) => {
      const inputIdx = audioInputsOffset + idx;
      let label = `[a${idx}_vol]`;
      const volRawLabel = `[a${idx}_vol_raw]`;
      filterString += `[${inputIdx}:a]volume = ${track.gain}${volRawLabel}; `;
      filterString += `${volRawLabel}apad${label}; `;

      if (sidechainTargets.has(track.id)) {
        const mixLabel = `[a${idx}_mix]`;
        const scLabel = `[a${idx}_sc]`;
        filterString += `${label} asplit = 2${mixLabel}${scLabel}; `;
        trackLabels[idx] = mixLabel;
      } else {
        trackLabels[idx] = label;
      }
    });

    tracks.forEach((track, idx) => {
      if (track.ducking) {
        const targetIdx = tracks.findIndex(
          (r) => r.id === track.ducking!.target || r.type === track.ducking!.target
        );
        if (targetIdx !== -1) {
          const currentStream = trackLabels[idx];
          const controlStream = `[a${targetIdx}_sc]`;
          const duckedLabel = `[a${idx}_ducked]`;
          filterString += `${currentStream}${controlStream} sidechaincompress = threshold = 0.08: ratio = 15: attack = 0.1: release = 1.2${duckedLabel}; `;
          trackLabels[idx] = duckedLabel;
        }
      }
    });

    if (trackLabels.length > 0) {
      const amixInputs = trackLabels.join('');
      filterString += `${amixInputs} amix = inputs = ${trackLabels.length}: duration = longest: dropout_transition = 0[a_mixed]; `;
    }

    complexArgs.push('-filter_complex', filterString);
    complexArgs.push('-map', finalVideoLabel);
    if (trackLabels.length > 0) {
      complexArgs.push('-map', '[a_mixed]');
      complexArgs.push('-c:a', 'aac', '-b:a', '128k');
    }

    complexArgs.push(
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-r',
      fps.toString(),
      '-y',
      '-shortest',
      finalOutputPath
    );
    await runFfmpeg(complexArgs, `Stage2_AdvancedCompose`);
  }

  // Stage 3: Persistence (Preview Asset linked to Scene)
  // Isolation: OwnerType=SCENE, OwnerId=SceneId
  const asset = await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type: {
        ownerType: AssetOwnerType.SCENE,
        ownerId: timeline.sceneId,
        type: AssetType.VIDEO,
      },
    },
    update: { storageKey: finalOutputRelative, status: 'GENERATED' },
    create: {
      projectId: projectId,
      ownerId: timeline.sceneId, // Binds to Scene for Isolation
      ownerType: AssetOwnerType.SCENE,
      type: AssetType.VIDEO,
      storageKey: finalOutputRelative,
      status: 'GENERATED',
      createdByJobId: job.id,
    },
  });

  // Stage 4: Trigger CE09_MEDIA_SECURITY with AssetId
  // Unified Entry Point
  await prisma.shotJob.create({
    data: {
      type: JobType.CE09_MEDIA_SECURITY,
      organizationId: job.organizationId || timeline.organizationId,
      projectId: job.projectId || timeline.projectId,
      episodeId: job.episodeId || timeline.episodeId,
      sceneId: job.sceneId || timeline.sceneId,
      shotId: timeline.shots[0].shotId, // Optional, for legacy query compatibility
      payload: {
        assetId: asset.id, // Primary Entry Point
        videoAssetStorageKey: finalOutputRelative, // Legacy/Backup
        pipelineRunId,
        traceId,
        projectId: job.projectId || timeline.projectId,
      },
    },
  });

  // Stage 5: Metrics & Audit (Commercial Grade)
  const latencyMs = Date.now() - startTime;
  const costAmount = 0.05; // Dummy cost for 2 shots

  return {
    success: true,
    output: {
      assetId: asset.id,
      storageKey: finalOutputRelative,
      metrics: { durationMs: latencyMs, cost: costAmount, shots: timeline.shots.length },
    },
    audit: { action: 'ce11.timeline_preview.success', sceneId: timeline.sceneId, traceId },
  };
}

async function runFfmpeg(args: string[], label: string) {
  console.log(`[FFmpeg ${label}]Executing: ffmpeg ${args.join(' ')} `);
  return new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args);
    let output = '';
    child.stderr.on('data', (data) => {
      output += data.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `[FFmpeg ${label}] Exited with code ${code}.Output: ${output.substring(output.length - 500)} `
          )
        );
    });
  });
}
