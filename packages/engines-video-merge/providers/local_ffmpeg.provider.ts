import { execAsync } from '@scu/shared';
import { sha256File } from '@scu/shared';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';

export interface VideoResult {
  path: string;
  mime: 'video/mp4';
  size: number;
  sha256: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  cpuSeconds: number;
}

export const localFfmpegProvider = {
  key: 'local_ffmpeg' as const,

  async merge(
    input: {
      framePattern?: string;
      framePaths?: string[];
      fps: number;
      width: number;
      height: number;
    },
    ctx: { jobId?: string; traceId?: string } = {}
  ): Promise<VideoResult> {
    const outDir =
      process.env.ASSET_STORAGE_DIR || path.join(process.cwd(), '.runtime/assets_gate_p0r1');
    if (!fs.existsSync(outDir)) {
      await fsp.mkdir(outDir, { recursive: true });
    }

    const jobId = ctx.jobId || `vm-${Date.now()}`;
    const outPath = path.join(outDir, `video_merge_${jobId}.mp4`);

    // 1. Check Availability (Async)
    const check = await execAsync('ffmpeg', ['-version']);
    if (check.code !== 0) throw new Error(`FFmpeg unavailable: ${check.stderr}`);

    const t0 = Date.now();

    // 2. Build command
    const args: string[] = ['-y'];
    let tmpSeqDir: string | undefined;

    if (input.framePattern) {
      args.push('-framerate', String(input.fps), '-i', input.framePattern);
    } else if (input.framePaths && input.framePaths.length > 0) {
      tmpSeqDir = path.join(outDir, `temp_seq_${jobId}`);
      if (fs.existsSync(tmpSeqDir)) await fsp.rm(tmpSeqDir, { recursive: true });
      await fsp.mkdir(tmpSeqDir);

      // Async copy frames
      await Promise.all(
        input.framePaths.map((p, idx) => {
          const ext = path.extname(p);
          const seqName = `frame_${String(idx).padStart(4, '0')}${ext}`;
          return fsp.copyFile(p, path.join(tmpSeqDir!, seqName));
        })
      );

      args.push('-framerate', String(input.fps), '-i', path.join(tmpSeqDir, 'frame_%04d.png'));
    } else {
      throw new Error('No input frames provided');
    }

    args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
    const threads = process.env.FFMPEG_THREADS || '1';
    args.push('-threads', threads);

    const w = input.width + (input.width % 2);
    const h = input.height + (input.height % 2);
    args.push('-vf', `scale=${w}:${h}`, outPath);

    const timeoutMs = Number(process.env.VIDEO_MERGE_TIMEOUT_MS) || 300000;

    console.log(`[local_ffmpeg] video_merge_spawn jobId=${jobId} timeoutMs=${timeoutMs} ffmpeg_threads=${threads}`);

    // 3. Execution (Async)
    const res = await execAsync('ffmpeg', args, { timeoutMs });
    if (res.code !== 0) throw new Error(`FFmpeg merge failed: ${res.stderr}`);

    const t1 = Date.now();
    const cpuSeconds = (t1 - t0) / 1000;

    // Cleanup
    if (tmpSeqDir && fs.existsSync(tmpSeqDir)) await fsp.rm(tmpSeqDir, { recursive: true });

    // 4. Precision Probing (Async)
    let duration = 0;
    let width = w;
    let height = h;
    let fps = input.fps;

    const probe = await execAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=width,height,avg_frame_rate',
      '-of',
      'json',
      outPath,
    ]);
    if (probe.code === 0) {
      const metadata = JSON.parse(probe.stdout);
      duration = parseFloat(metadata.format.duration);
      const videoStream = metadata.streams.find((s: any) => s.width);
      if (videoStream) {
        width = videoStream.width;
        height = videoStream.height;
        const [num, den] = videoStream.avg_frame_rate.split('/');
        fps = Math.round(parseFloat(num) / parseFloat(den));
      }
    }

    return {
      path: outPath,
      mime: 'video/mp4',
      size: (await fsp.stat(outPath)).size,
      sha256: await sha256File(outPath),
      duration,
      width,
      height,
      fps,
      cpuSeconds,
    };
  },

  async concat(
    input: { videoPaths: string[] },
    ctx: { jobId?: string; traceId?: string } = {}
  ): Promise<VideoResult> {
    const outDir =
      process.env.ASSET_STORAGE_DIR || path.join(process.cwd(), '.runtime/assets_gate_p2v3');
    if (!fs.existsSync(outDir)) await fsp.mkdir(outDir, { recursive: true });

    const jobId = ctx.jobId || `vc-${Date.now()}`;
    const outPath = path.join(outDir, `video_concat_${jobId}.mp4`);
    const concatListPath = path.join(outDir, `concat_${jobId}.txt`);

    const concatContent = input.videoPaths.map((p) => `file '${path.resolve(p)}'`).join('\n');
    await fsp.writeFile(concatListPath, concatContent);

    const t0 = Date.now();
    const timeoutMs = Number(process.env.VIDEO_MERGE_TIMEOUT_MS) || 300000;

    // Fast Concat (Async)
    const fastArgs = [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-c',
      'copy',
      outPath,
    ];
    let res = await execAsync('ffmpeg', fastArgs, { timeoutMs });

    if (res.code !== 0) {
      // Slow Fallback (Async)
      const slowArgs = [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatListPath,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outPath,
      ];
      res = await execAsync('ffmpeg', slowArgs, { timeoutMs });
    }

    const t1 = Date.now();
    const cpuSeconds = (t1 - t0) / 1000;
    if (fs.existsSync(concatListPath)) await fsp.unlink(concatListPath);
    if (res.code !== 0) throw new Error(`FFmpeg concat failed: ${res.stderr}`);

    // Probing
    let duration = 0,
      width = 0,
      height = 0,
      fps = 0;
    const probe = await execAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=width,height,avg_frame_rate',
      '-of',
      'json',
      outPath,
    ]);
    if (probe.code === 0) {
      const meta = JSON.parse(probe.stdout);
      duration = parseFloat(meta.format.duration);
      const stream = meta.streams.find((s: any) => s.width);
      if (stream) {
        width = stream.width;
        height = stream.height;
        const [num, den] = stream.avg_frame_rate.split('/');
        fps = Math.round(parseFloat(num) / parseFloat(den));
      }
    }

    return {
      path: outPath,
      mime: 'video/mp4',
      size: (await fsp.stat(outPath)).size,
      sha256: await sha256File(outPath),
      duration,
      width,
      height,
      fps,
      cpuSeconds,
    };
  },
};
