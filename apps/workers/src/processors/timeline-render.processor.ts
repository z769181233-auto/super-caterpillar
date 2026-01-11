import { JobType, AssetOwnerType, AssetType, PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { TimelineData } from './timeline-compose.processor';

export interface TimelineRenderParams {
  prisma: PrismaClient;
  job: {
    id: string;
    payload: {
      timelineStorageKey: string;
      pipelineRunId: string;
    };
    organizationId: string;
    projectId: string;
    traceId?: string;
  };
  apiClient: ApiClient;
}

/**
 * S4-7: Timeline Render Processor
 * 职责：执行两段式渲染 (Shot MP4s -> Scene Concat)，锁死编码参数，绑定 Asset 至 firstShotId。
 */
export async function processTimelineRenderJob({ prisma, job, apiClient }: TimelineRenderParams) {
  const { timelineStorageKey, pipelineRunId } = job.payload;
  const traceId = job.traceId || `trace-${Date.now()}`;
  const projectId = job.projectId;

  console.log(`[TimelineRender] [${traceId}] Loading timeline from: ${timelineStorageKey}`);

  // 0. Load Timeline Data
  if (!fs.existsSync(timelineStorageKey)) {
    throw new Error(`[TimelineRender] Timeline file not found: ${timelineStorageKey}`);
  }
  const timeline: TimelineData = JSON.parse(fs.readFileSync(timelineStorageKey, 'utf-8'));

  // Validation
  if (timeline.shots.length < 2) {
    throw new Error(`[TimelineRender] Fail-fast: Timeline must contain at least 2 shots.`);
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
        else reject(new Error(`ffmpeg check exited with code ${code}`));
      });
    });
  } catch (e: any) {
    throw new Error(`[TimelineRender] FFmpeg binary missing: ${e.message}`);
  }

  const tempMp4Dir = path.resolve(process.cwd(), '.runtime', 'temp_mp4s', pipelineRunId);
  if (!fs.existsSync(tempMp4Dir)) fs.mkdirSync(tempMp4Dir, { recursive: true });

  const shotMp4Paths: string[] = [];

  // Stage 1: Per-Shot MP4 Generation (Locked Params)
  for (const shot of timeline.shots) {
    console.log(`[TimelineRender] Stage 1: Processing shotId=${shot.shotId}`);

    const shotOutputPath = path.join(tempMp4Dir, `shot_${shot.shotId}.mp4`);

    // SSOT Check: Check DB for existing valid Asset
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
      // Note: In real life, we should also verify if the existing asset matches our locked params (fps/res).
      // For S4-7, we assume the previous VIDEO_RENDER or our re-render handles this.
      const fullPath = path.resolve(process.cwd(), '.runtime', existingAsset.storageKey);
      if (fs.existsSync(fullPath)) {
        console.log(`[TimelineRender] Reusing existing Asset for shotId=${shot.shotId}`);
        shotMp4Paths.push(fullPath);
        continue;
      }
    }

    // Render if not skipped
    const framesTxt = shot.framesTxtStorageKey;
    if (!fs.existsSync(framesTxt)) {
      throw new Error(
        `[TimelineRender] Fail-fast: frames.txt not found for shotId=${shot.shotId} at ${framesTxt}`
      );
    }

    // FFmpeg Command Stage 1
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
      `${width}x${height}`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-y',
      shotOutputPath,
    ];

    await runFfmpeg(args, `Stage1_Shot_${shot.shotId}`);
    shotMp4Paths.push(shotOutputPath);
  }

  // Stage 2: Scene Composition
  console.log(`[TimelineRender] Stage 2: Composing ${shotMp4Paths.length} shots`);
  const finalOutputRelative = `renders/${projectId}/scenes/${timeline.sceneId}/output.mp4`;
  const finalOutputPath = path.resolve(process.cwd(), '.runtime', finalOutputRelative);
  const finalOutputDir = path.dirname(finalOutputPath);
  if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });

  const hasTransitions = timeline.shots.some((s) => s.transition && s.transition !== 'none');
  const hasAudio = timeline.audio && timeline.audio.mode !== 'none' && timeline.audio.bgmStorageKey;

  if (!hasTransitions && !hasAudio) {
    // Path A: Simple Concat (Fast, no re-encoding)
    console.log(`[TimelineRender] [Path A] Simple Concat (Demuxer/Copy)`);
    const concatListPath = path.join(tempMp4Dir, 'scene_concat.txt');
    const concatContent = shotMp4Paths.map((p) => `file '${p}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    const concatArgs = [
      '-f', 'concat', '-safe', '0', '-i', concatListPath,
      '-c', 'copy', '-y', finalOutputPath,
    ];
    await runFfmpeg(concatArgs, `Stage2_SimpleConcat`);
  } else {
    // Path B: Advanced Composition (FilterComplex, Re-encoding required)
    console.log(`[TimelineRender] [Path B] Advanced Composition (FilterComplex)`);
    const complexArgs: string[] = [];

    // Inputs: All shot MP4s
    shotMp4Paths.forEach((p) => {
      complexArgs.push('-i', p);
    });

    // Input: BGM (if exists)
    let bgmIndex = -1;
    if (hasAudio) {
      const bgmPath = path.resolve(process.cwd(), '.runtime', timeline.audio!.bgmStorageKey!);
      if (fs.existsSync(bgmPath)) {
        bgmIndex = shotMp4Paths.length;
        if (timeline.audio!.mode === 'loop') {
          complexArgs.push('-stream_loop', '-1');
        }
        complexArgs.push('-i', bgmPath);
      }
    }

    // Filter Complex: Building Video Chain
    let filterString = '';
    let lastStream = '[0:v]';
    let currentTimelineDuration = timeline.shots[0].durationFrames / fps;

    for (let i = 1; i < timeline.shots.length; i++) {
      const shot = timeline.shots[i];
      if (shot.transition === 'xfade') {
        const transDur = shot.transitionFrames / fps;
        const offset = currentTimelineDuration - transDur;
        const outStream = `[v${i}]`;
        filterString += `${lastStream}[${i}:v]xfade=transition=fade:duration=${transDur.toFixed(3)}:offset=${offset.toFixed(3)}${outStream};`;
        lastStream = outStream;
        currentTimelineDuration = currentTimelineDuration + (shot.durationFrames / fps) - transDur;
      } else {
        // No transition: use concat filter for this segment
        const outStream = `[v${i}]`;
        filterString += `${lastStream}[${i}:v]concat=n=2:v=1:a=0${outStream};`;
        lastStream = outStream;
        currentTimelineDuration += (shot.durationFrames / fps);
      }
    }

    complexArgs.push('-filter_complex', filterString || `[0:v]copy[vfinal]`);
    // Note: If no transitions but has audio, we still need complex for audio mapping or just simple map.
    // If filterString is empty, it means only 1 shot or all none-transitions (but we checked hasTransitions).

    const finalVideoStream = filterString ? lastStream.replace(/\[/g, '').replace(/\]/g, '') : '0:v';
    complexArgs.push('-map', `[${finalVideoStream}]`);

    if (bgmIndex !== -1) {
      complexArgs.push('-map', `${bgmIndex}:a`);
      complexArgs.push('-c:a', 'aac', '-b:a', '128k');
    }

    complexArgs.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', fps.toString(), '-y', '-shortest', finalOutputPath);

    // Adjust command if filterString was set
    if (filterString) {
      // Replace the last stream label in complexArgs to a standard [vfinal] if needed? 
      // Or just use the lastStream label as is.
    }

    await runFfmpeg(complexArgs, `Stage2_AdvancedCompose`);
  }

  // Stage 3: Persistence (Asset linked to firstShotId)
  const firstShotId = timeline.shots[0].shotId;
  const asset = await prisma.asset.upsert({
    where: {
      ownerType_ownerId_type: {
        ownerType: AssetOwnerType.SHOT,
        ownerId: firstShotId,
        type: AssetType.VIDEO,
      },
    },
    update: { storageKey: finalOutputRelative, status: 'GENERATED' },
    create: {
      projectId: projectId,
      ownerId: firstShotId,
      ownerType: AssetOwnerType.SHOT,
      type: AssetType.VIDEO,
      storageKey: finalOutputRelative,
      status: 'GENERATED',
      createdByJobId: job.id,
    },
  });

  // Stage 4: Trigger CE09_MEDIA_SECURITY
  // ROBUST CONTEXT FETCH
  const shotData = await prisma.shot.findUnique({
    where: { id: firstShotId },
    include: { scene: { include: { episode: true } } },
  });
  if (!shotData?.scene?.episode)
    throw new Error('[TimelineRender] Missing DB context (Episode) for CE09 trigger');

  await prisma.shotJob.create({
    data: {
      type: JobType.CE09_MEDIA_SECURITY,
      organizationId: timeline.organizationId,
      projectId: timeline.projectId,
      episodeId: shotData.scene.episode.id,
      sceneId: timeline.sceneId,
      shotId: firstShotId,
      payload: {
        videoAssetStorageKey: finalOutputRelative,
        pipelineRunId,
        traceId,
        shotId: firstShotId,
        projectId: timeline.projectId,
      },
    },
  });

  return {
    success: true,
    assetId: asset.id,
    storageKey: finalOutputRelative,
    audit: { action: 'ce10.timeline_render.success', sceneId: timeline.sceneId, traceId },
  };
}

async function runFfmpeg(args: string[], label: string) {
  console.log(`[FFmpeg ${label}] Executing: ffmpeg ${args.join(' ')}`);
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
            `[FFmpeg ${label}] Exited with code ${code}. Output: ${output.substring(output.length - 500)}`
          )
        );
    });
  });
}
