import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { execAsync } from '../../../../../packages/shared/os_exec';
import { safeJoin } from '../../../../../packages/shared/fs_safe';
import { sha256File } from '../../../../../packages/shared/hash';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

/**
 * CE09 Media Security Adapter - Industrial Grade
 * - Watermark + MD5 + Screenshot + HLS
 * - 0 Sync IO
 */
@Injectable()
export class CE09SecurityLocalAdapter implements EngineAdapter {
  public readonly name = 'ce09_security';
  private readonly logger = new Logger(CE09SecurityLocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'ce09_security' || engineKey === 'ce09_security_real';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const { videoPath, watermarkText, projectId, pipelineRunId } = input.payload as any;
    const t0 = performance.now();

    try {
      const storageRoot = process.env.STORAGE_ROOT || '.runtime';
      const absInput = safeJoin(storageRoot, videoPath);

      const secureRelativeDir = `secure/${projectId}/${pipelineRunId}`;
      const secureAbsDir = safeJoin(storageRoot, secureRelativeDir);
      await fsp.mkdir(secureAbsDir, { recursive: true });

      const outRelative = path.join(secureRelativeDir, `secure_${path.basename(videoPath)}`);
      const outPath = safeJoin(storageRoot, outRelative);
      const hlsPlaylistRelative = path.join(secureRelativeDir, 'hls/master.m3u8');
      const hlsPlaylistAbs = safeJoin(storageRoot, hlsPlaylistRelative);
      const screenshotRelative = outRelative + '.thumb.jpg';
      const md5Relative = outRelative + '.framemd5.txt';

      await fsp.mkdir(path.dirname(hlsPlaylistAbs), { recursive: true });

      if (
        !(await fsp
          .access(absInput)
          .then(() => true)
          .catch(() => false))
      ) {
        throw new Error(`SECURITY_INPUT_MISSING: ${videoPath}`);
      }

      // 1. Watermark MP4 (Async)
      const wmArgs = [
        '-y',
        '-i',
        absInput,
        '-vf',
        `drawtext=text='${watermarkText || 'SUPER_CATERPILLAR'}':x=10:y=H-th-10:fontsize=24:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'copy',
        outPath,
      ];
      const wmRes = await execAsync('ffmpeg', wmArgs);
      if (wmRes.code !== 0) throw new Error(`WATERMARK_FAIL: ${wmRes.stderr}`);

      // 2. HLS + Screenshot + MD5 (Parallel Async)
      await Promise.all([
        // HLS
        execAsync('ffmpeg', [
          '-y',
          '-i',
          outPath,
          '-c',
          'copy',
          '-start_number',
          '0',
          '-hls_time',
          '10',
          '-hls_list_size',
          '0',
          '-f',
          'hls',
          hlsPlaylistAbs,
        ]),
        // Screenshot
        execAsync('ffmpeg', [
          '-y',
          '-i',
          outPath,
          '-ss',
          '00:00:01',
          '-vframes',
          '1',
          safeJoin(storageRoot, screenshotRelative),
        ]),
        // MD5
        execAsync('ffmpeg', [
          '-y',
          '-i',
          outPath,
          '-f',
          'framemd5',
          safeJoin(storageRoot, md5Relative),
        ]),
      ]);

      const [outStat, hash] = await Promise.all([fsp.stat(outPath), sha256File(outPath)]);

      return {
        status: 'SUCCESS' as any,
        output: {
          storageKey: outRelative,
          hlsPlaylistKey: hlsPlaylistRelative,
          screenshotKey: screenshotRelative,
          framemd5Key: md5Relative,
          sha256: hash,
          watermarkMode: 'SCU_VISIBLE_V1_ASYNC',
          provider: 'ffmpeg-secure-v2-hls',
        },
        metrics: {
          durationMs: Math.round(performance.now() - t0),
        },
      };
    } catch (error: any) {
      this.logger.error(`[SECURITY_FAIL] ${error.message}`);
      return {
        status: 'FAILED' as any,
        error: { code: 'CE09_SECURITY_FAIL', message: error.message },
      };
    }
  }
}
