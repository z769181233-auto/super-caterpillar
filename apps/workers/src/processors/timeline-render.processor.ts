import { JobType, AssetOwnerType, AssetType, PrismaClient } from 'database';
import { EngineHubClient } from '../engine-hub-client';
import { readFileUnderLimit } from '../../../../packages/shared/fs_safe';
import * as path from 'path';
import { promises as fsp } from 'fs';
import { fileExists, ensureDir } from '../../../../packages/shared/fs_async';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { TimelineData } from './timeline-compose.processor';
import { generateWav } from '../lib/audio/mock-wav';
import { AudioService } from '@scu/api/audio/audio.service';

import { ProcessorContext } from '../types/processor-context';

/**
 * S4-7: Timeline Render Processor
 * 职责：执行两段式渲染 (Shot MP4s -> Scene Concat)，锁死编码参数，绑定 Asset 至 firstShotId。
 */
export async function processTimelineRenderJob(ctx: ProcessorContext) {
  const { prisma, job, apiClient } = ctx;
  const { timelineStorageKey, pipelineRunId } = job.payload as {
    timelineStorageKey: string;
    pipelineRunId: string;
  };
  const traceId = job.traceId || `trace-${Date.now()}`;
  const projectId = job.projectId || (job.payload as any)?.projectId;

  let storageRoot: string;
  if (process.env.REPO_ROOT) {
    storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
  } else if (process.env.STORAGE_ROOT) {
    storageRoot = process.env.STORAGE_ROOT;
  } else {
    storageRoot = path.join(path.resolve(process.cwd(), '../../'), '.data/storage');
  }

  if (!projectId) {
    throw new Error(`[TimelineRender] [${traceId}] Missing projectId in job ${job.id}`);
  }

  console.log(`[TimelineRender] [${traceId}] Loading timeline from: ${timelineStorageKey}`);

  // 0. Load Timeline Data
  if (!(await fileExists(timelineStorageKey))) {
    throw new Error(`[TimelineRender] Timeline file not found: ${timelineStorageKey}`);
  }
  // Load Timeline
  const timelineJson = await readFileUnderLimit(timelineStorageKey, 20 * 1024 * 1024); // 20MB limit
  const timeline: TimelineData = JSON.parse(timelineJson);

  if (timeline.shots.length < 1) {
    throw new Error(`[TimelineRender] Fail-fast: Timeline must contain at least 1 shot.`);
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

  const tempMp4Dir = path.resolve(storageRoot, 'temp_mp4s', pipelineRunId);
  if (!(await fileExists(tempMp4Dir))) await ensureDir(tempMp4Dir);

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
      const fullPath = path.resolve(storageRoot, existingAsset.storageKey);
      if (await fileExists(fullPath)) {
        console.log(`[TimelineRender] Reusing existing Asset for shotId=${shot.shotId}`);
        shotMp4Paths.push(fullPath);
        continue;
      }
    }

    // Render if not skipped
    const framesTxt = shot.framesTxtStorageKey;

    // P22-0 Race Condition Fix: Wait for SHOT_RENDER completion (frames.txt availability)
    if (!(await fileExists(framesTxt))) {
      console.log(`[TimelineRender] Waiting for frames.txt: ${framesTxt} (TIMEOUT=60s)`);
      const startWait = Date.now();
      while (Date.now() - startWait < 60000) {
        if (await fileExists(framesTxt)) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!(await fileExists(framesTxt))) {
      throw new Error(
        `[TimelineRender] Fail-fast: frames.txt not found for shotId=${shot.shotId} at ${framesTxt}`
      );
    }

    // Real rendering for Stage 1: Shot Frames to MP4
    if (process.env.AUDIO_MINLOOP_SYNC === '1') {
      console.log(
        `[TimelineRender] Audio Minloop mode: Clipping real Stage 1 rendering, creating dummy MP4`
      );
      await fsp.writeFile(shotOutputPath, 'dummy mp4 content');
    } else {
      const args = [
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        framesTxt,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-r',
        fps.toString(),
        '-y',
        shotOutputPath,
      ];
      await runFfmpeg(args, `Stage1_Shot_${shot.shotId}`);
    }
    shotMp4Paths.push(shotOutputPath);
  }

  // Stage 1.5: Prepare Audio Assets (P18-1: Production Audio Routing)
  console.log(`[TimelineRender] Stage 1.5: Preparing audio assets for sceneId=${timeline.sceneId}`);

  const sceneId = timeline.sceneId;
  if (!sceneId) {
    console.log(`[TimelineRender] [WARN] No sceneId found, skipping audio assets`);
  }

  // P18-1: Instantiate AudioService and Resolve Routing
  const audioService = new AudioService({
    incrementAudioVendorCall: () => {},
    incrementAudioCacheHit: () => {},
    incrementAudioCacheMiss: () => {},
    incrementAudioPreview: () => {},
  } as any);
  const audioSettings = await audioService.resolveProjectSettings(prisma, projectId);
  const killOn = process.env.AUDIO_REAL_FORCE_DISABLE === '1';

  // P22-0 Fix: Extract preview parameters from payload
  const payloadForAudio = job.payload as any;
  const preview = payloadForAudio?.preview === true;
  const previewCapMs = Number(payloadForAudio?.previewCapMs ?? 3000);

  // P13-2: 确定性 storageKey 规则 (We keep these for DB persistence)
  const ttsStorageKey = `audio/tts/${traceId}__${sceneId}.wav`;
  const bgmStorageKey = `audio/bgm/${traceId}__${sceneId}.wav`;

  // Determine if we should generate
  // In P18-1, we ALWAYS attempt routing unless explicitly disabled
  const shouldGenerate =
    sceneId &&
    (process.env.GATE_MODE === '1' ||
      process.env.AUDIO_MINLOOP_SYNC === '1' ||
      audioSettings.audioRealEnabled);

  let ttsAsset: any = null;
  let bgmAsset: any = null;

  if (shouldGenerate && sceneId) {
    console.log(
      `[TimelineRender] Routing to AudioService: projectId=${projectId}, sceneId=${sceneId}, ks=${killOn}, preview=${preview}`
    );

    // P22-0: Force Audio settings for E2E consistency
    const forcedSettings = {
      ...audioSettings,
      audioBgmEnabled: true,
      audioMixerEnabled: true,
    };

    // 1. Generate Voice (TTS)
    const audioRes = await audioService.generateAndMix({
      text: `${traceId}:${sceneId}:AUDIO_TTS`, // Legacy seedKey as text
      bgmSeed: payloadForAudio?.bgmSeed ?? `${traceId}:${sceneId}:AUDIO_BGM`,
      preview,
      previewCapMs,
      projectSettings: forcedSettings,
    });

    const ttsAbsPath = path.join(storageRoot, ttsStorageKey);
    await ensureDir(path.dirname(ttsAbsPath));
    await fsp.copyFile(audioRes.voice.absPath, ttsAbsPath);

    // Persist TTS Asset
    ttsAsset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerId: sceneId,
          ownerType: AssetOwnerType.SCENE,
          type: 'AUDIO_TTS' as any,
        },
      },
      update: {
        checksum: audioRes.voice.meta.audioFileSha256,
        status: 'GENERATED',
        storageKey: ttsStorageKey,
      },
      create: {
        projectId,
        ownerId: sceneId,
        ownerType: AssetOwnerType.SCENE,
        type: 'AUDIO_TTS' as any,
        storageKey: ttsStorageKey,
        checksum: audioRes.voice.meta.audioFileSha256,
        status: 'GENERATED',
      },
    });

    // 2. Handle BGM
    // AudioService for P18-0 uses a separate internal synthesis for BGM.
    // To get BGM as a separate asset key, we call it again with mixer disabled to isolation.
    const bgmRes = await audioService.generateAndMix({
      text: `BGM|${traceId}:${sceneId}:AUDIO_BGM`,
      projectSettings: { ...audioSettings, audioMixerEnabled: false },
    });

    const bgmAbsPath = path.join(storageRoot, bgmStorageKey);
    await ensureDir(path.dirname(bgmAbsPath));
    await fsp.copyFile(bgmRes.voice.absPath, bgmAbsPath);

    bgmAsset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerId: sceneId,
          ownerType: AssetOwnerType.SCENE,
          type: 'AUDIO_BGM' as any,
        },
      },
      update: {
        checksum: bgmRes.voice.meta.audioFileSha256,
        status: 'GENERATED',
        storageKey: bgmStorageKey,
      },
      create: {
        projectId,
        ownerId: sceneId,
        ownerType: AssetOwnerType.SCENE,
        type: 'AUDIO_BGM' as any,
        storageKey: bgmStorageKey,
        checksum: bgmRes.voice.meta.audioFileSha256,
        status: 'GENERATED',
      },
    });

    console.log(
      `[TimelineRender] Audio prepared via AudioService. Mode=${audioRes.signals.audio_mode}, KS=${audioRes.signals.audio_kill_switch}`
    );
  }

  // Stage 2: Scene Composition
  console.log(`[TimelineRender] Stage 2: Composing ${shotMp4Paths.length} shots`);
  const finalOutputRelative = `renders/${projectId}/scenes/${timeline.sceneId}/output.mp4`;
  const finalOutputPath = path.resolve(storageRoot, finalOutputRelative);
  const finalOutputDir = path.dirname(finalOutputPath);
  if (!(await fileExists(finalOutputDir))) await ensureDir(finalOutputDir);

  // P13-2: 构建 audio tracks（如果音频资产存在）
  let tracks = timeline.audio?.tracks || [];
  if (ttsAsset && bgmAsset) {
    console.log(`[TimelineRender] Adding audio tracks: TTS + BGM`);
    tracks = [
      {
        id: 'tts_main',
        type: 'dialogue',
        storageKey: ttsAsset.storageKey,
        gain: 1.0,
      },
      {
        id: 'bgm_main',
        type: 'music', // 使用 'music' 而非 'bgm'
        storageKey: bgmAsset.storageKey,
        gain: 0.3, // 降低 BGM 音量
        loop: false, // 已经计算足够时长,不需要 loop
        ducking: { target: 'dialogue', gain: 0.3 }, // ducking gain (降低到30%)
      },
    ];
  }

  const hasTransitions = timeline.shots.some((s) => s.transition && s.transition !== 'none');
  const hasDucking = tracks.some((t) => t.ducking);
  const forcePathB = hasTransitions || tracks.length > 1 || hasDucking;

  if (!forcePathB) {
    // Path A: Simple Concat (Fast, no re-encoding)
    // Rule: audio.tracks.length <= 1 && no ducking && no transitions
    console.log(
      `[TimelineRender] [Path A] Simple Concat (Demuxer/Copy) - Performance Conservation Mode`
    );
    const concatListPath = path.join(tempMp4Dir, 'scene_concat.txt');
    const concatContent = shotMp4Paths.map((p) => `file '${p}'`).join('\n');
    await fsp.writeFile(concatListPath, concatContent);

    const concatArgs = ['-f', 'concat', '-safe', '0', '-i', concatListPath];

    // If there is exactly 1 audio track, we try to include it.
    if (tracks.length === 1 && tracks[0].storageKey) {
      const audioPath = path.resolve(storageRoot, tracks[0].storageKey);
      if (await fileExists(audioPath)) {
        concatArgs.push('-i', audioPath);
        concatArgs.push('-map', '0:v', '-map', '1:a');
        // Note: -c copy might fail if audio format is incompatible, but we aim for copy here as per user rule.
      }
    }

    // Real rendering for Path A: Simple Concat
    if (process.env.AUDIO_MINLOOP_SYNC === '1') {
      console.log(`[TimelineRender] Audio Minloop mode: Skipping Path A concat`);
      await fsp.writeFile(finalOutputPath, 'dummy final mp4');
    } else {
      concatArgs.push('-y', finalOutputPath);
      await runFfmpeg(concatArgs, `Stage2_SimpleConcat`);
    }
  } else {
    // Path B: Advanced Composition (FilterComplex, Re-encoding required)
    console.log(`[TimelineRender] [Path B] Advanced Composition (Mixing & Ducking)`);
    const complexArgs: string[] = [];

    // Inputs: All shot MP4s
    shotMp4Paths.forEach((p) => {
      complexArgs.push('-i', p);
    });

    // Inputs: All Audio Tracks
    const audioInputsOffset = shotMp4Paths.length;
    for (const [idx, track] of tracks.entries()) {
      if (track.storageKey) {
        const audioPath = path.resolve(storageRoot, track.storageKey);
        if (await fileExists(audioPath)) {
          if (track.loop) complexArgs.push('-stream_loop', '-1');
          complexArgs.push('-i', audioPath);
        }
      }
    }

    // Building Filter Complex
    let filterString = '';

    // 1. Video Chain (Existing Transition Logic)
    let lastVideoStream = '[0:v]';
    let currentTimelineDuration = timeline.shots[0].durationFrames / fps;

    for (let i = 1; i < timeline.shots.length; i++) {
      const shot = timeline.shots[i];
      const outStream = `[v_step${i}]`;
      if (shot.transition === 'xfade') {
        const transDur = shot.transitionFrames / fps;
        const offset = currentTimelineDuration - transDur;
        filterString += `${lastVideoStream}[${i}:v]xfade=transition=fade:duration=${transDur.toFixed(3)}:offset=${offset.toFixed(3)}${outStream};`;
        currentTimelineDuration = currentTimelineDuration + shot.durationFrames / fps - transDur;
      } else {
        filterString += `${lastVideoStream}[${i}:v]concat=n=2:v=1:a=0${outStream};`;
        currentTimelineDuration += shot.durationFrames / fps;
      }
      lastVideoStream = outStream;
    }
    const finalVideoLabel = `[v_final]`;
    filterString += `${lastVideoStream}copy${finalVideoLabel};`;

    // 2. Audio Chain (Mixing & Ducking)
    // 2.0 Identify targets needed for sidechain
    const sidechainTargets = new Set<string>();
    tracks.forEach((t) => {
      if (t.ducking?.target) {
        // Resolve target ID or Type to a track index/id
        const targetTrack = tracks.find(
          (r) => r.id === t.ducking!.target || r.type === t.ducking!.target
        );
        if (targetTrack) sidechainTargets.add(targetTrack.id);
      }
    });

    // Label map to track the current available stream for each track
    const trackLabels: string[] = [];

    // 2.1 Apply Volume & Split Targets
    tracks.forEach((track, idx) => {
      const inputIdx = audioInputsOffset + idx;
      let label = `[a${idx}_vol]`;
      const volRawLabel = `[a${idx}_vol_raw]`;
      filterString += `[${inputIdx}:a]volume=${track.gain}${volRawLabel};`;
      filterString += `${volRawLabel}apad${label};`;

      if (sidechainTargets.has(track.id)) {
        // This track is a control signal for someone else, split it
        const mixLabel = `[a${idx}_mix]`;
        const scLabel = `[a${idx}_sc]`;
        filterString += `${label}asplit=2${mixLabel}${scLabel};`;
        // Store mix label for final mix, sc label for lookups
        trackLabels[idx] = mixLabel;
        // Hack: Store sc label in a way we can retrieve it?
        // We'll rename local map just for this scope or use predictable naming
      } else {
        trackLabels[idx] = label;
      }
    });

    // 2.2 Apply Ducking
    tracks.forEach((track, idx) => {
      if (track.ducking) {
        const targetIdx = tracks.findIndex(
          (r) => r.id === track.ducking!.target || r.type === track.ducking!.target
        );
        if (targetIdx !== -1) {
          const currentStream = trackLabels[idx];
          const controlStream = `[a${targetIdx}_sc]`;
          const duckedLabel = `[a${idx}_ducked]`;

          // Note: sidechaincompress usage: [main][control]sidechaincompress...
          filterString += `${currentStream}${controlStream}sidechaincompress=threshold=0.08:ratio=15:attack=0.1:release=1.2${duckedLabel};`;

          trackLabels[idx] = duckedLabel;
        }
      }
    });

    // 2.3 Mix
    if (trackLabels.length > 0) {
      const amixInputs = trackLabels.join('');
      // Use duration=longest (since inputs are padded) and dropout_transition=0 to avoid fade-out issues
      filterString += `${amixInputs}amix=inputs=${trackLabels.length}:duration=longest:dropout_transition=0[a_mixed];`;
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

    // Real rendering for Path B: Advanced Compose
    if (process.env.AUDIO_MINLOOP_SYNC === '1') {
      console.log(`[TimelineRender] Audio Minloop mode: Generating valid mock MP4 for CE09`);
      const mockArgs = [
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=1280x720:d=1',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=44100:cl=stereo',
        '-c:v',
        'libx264',
        '-t',
        '1',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-shortest',
        '-y',
        finalOutputPath,
      ];
      await runFfmpeg(mockArgs, `Stage2_MockCompose`);
    } else {
      await runFfmpeg(complexArgs, `Stage2_AdvancedCompose`);
    }
  }

  // Add-on: Generate HLS (m3u8 + ts) along with MP4 for Production Readiness
  if (process.env.AUDIO_MINLOOP_SYNC === '1') {
    console.log(`[TimelineRender] Audio Minloop mode: Skipping HLS generation`);
  } else {
    const hlsOutputDir = path.join(finalOutputDir, 'hls');
    if (!(await fileExists(hlsOutputDir))) await ensureDir(hlsOutputDir);
    const hlsMasterPath = path.join(hlsOutputDir, 'master.m3u8');

    console.log(`[TimelineRender] Generating HLS package at: ${hlsMasterPath}`);
    const hlsArgs = [
      '-i',
      finalOutputPath,
      '-codec:',
      'copy',
      '-start_number',
      '0',
      '-hls_time',
      '10',
      '-hls_list_size',
      '0',
      '-f',
      'hls',
      hlsMasterPath,
    ];
    await runFfmpeg(hlsArgs, 'Stage3_HLS_Package');
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

  // Stage 4: Trigger CE09_MEDIA_SECURITY (Orchestration moved to JobService)
  /*
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
        assetId: asset.id,
        videoAssetStorageKey: finalOutputRelative,
        pipelineRunId,
        traceId,
        shotId: firstShotId,
        projectId: timeline.projectId,
      },
    },
  });
  */

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
