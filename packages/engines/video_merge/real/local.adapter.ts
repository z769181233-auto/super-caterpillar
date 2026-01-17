import { VideoMergeInput, VideoMergeOutput } from '../types';
import { localFfmpegProvider } from '../providers/local_ffmpeg.provider';
import * as crypto from 'crypto';

export async function runVideoMergeLocal(
  input: VideoMergeInput,
  ctx: any = {}
): Promise<VideoMergeOutput> {
  // Default params
  const fps = input.fps || 24;
  const width = input.width || 512;
  const height = input.height || 512;

  if (input.videoPaths && input.videoPaths.length > 0) {
    const result = await localFfmpegProvider.concat(
      {
        videoPaths: input.videoPaths,
      },
      ctx
    );

    // Calculate params hash
    const paramsStr = JSON.stringify({
      jobId: input.jobId,
      videoPaths: input.videoPaths,
    });
    const paramsHash = crypto.createHash('sha256').update(paramsStr).digest('hex');

    return {
      asset: {
        uri: result.path,
        mimeType: 'video/mp4',
        sizeBytes: result.size,
        sha256: result.sha256,
        width: result.width,
        height: result.height,
        durationSeconds: result.duration,
      },
      render_meta: {
        model: 'ffmpeg-local-concat',
        fps: result.fps,
        codec: 'h264',
      },
      audit_trail: {
        engineKey: 'video_merge',
        engineVersion: '1.0.0-local-concat',
        timestamp: new Date().toISOString(),
        paramsHash,
        traceId: input.traceId || ctx.traceId,
      },
      billing_usage: {
        cpuSeconds: result.cpuSeconds,
        gpuSeconds: 0,
        model: 'ffmpeg-local-concat',
      },
    };
  }

  const result = await localFfmpegProvider.merge(
    {
      framePattern: input.framePattern,
      framePaths: input.framePaths,
      fps,
      width,
      height,
    },
    ctx
  );

  // Calculate params hash
  const paramsStr = JSON.stringify({
    jobId: input.jobId,
    paths: input.framePaths,
    fps,
    width,
    height,
  });
  const paramsHash = crypto.createHash('sha256').update(paramsStr).digest('hex');

  return {
    asset: {
      uri: result.path,
      mimeType: 'video/mp4',
      sizeBytes: result.size,
      sha256: result.sha256,
      width: result.width,
      height: result.height,
      durationSeconds: result.duration,
    },
    render_meta: {
      model: 'ffmpeg-local',
      fps: result.fps,
      codec: 'h264',
    },
    audit_trail: {
      engineKey: 'video_merge',
      engineVersion: '1.0.0-local',
      timestamp: new Date().toISOString(),
      paramsHash,
      traceId: input.traceId || ctx.traceId,
    },
    billing_usage: {
      cpuSeconds: result.cpuSeconds,
      gpuSeconds: 0,
      model: 'ffmpeg-local',
    },
  };
}
