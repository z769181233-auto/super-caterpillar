import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { execAsync } from '../../../../../packages/shared/os_exec';
import { safeJoin } from '../../../../../packages/shared/fs_safe';
import { sha256File } from '../../../../../packages/shared/hash';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

/**
 * Audio BGM Adapter - Industrial Grade (FFmpeg Loop)
 * - 0 Sync IO (Async Only)
 * - Path Traversal Protection
 * - Duration Assertion (< 0.1s drift)
 */
@Injectable()
export class AudioBGMLocalAdapter implements EngineAdapter {
  public readonly name = 'audio_bgm';
  private readonly logger = new Logger(AudioBGMLocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'audio_bgm';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const { sourceKey, targetDuration } = input.payload as any;
    const traceId = input.context?.traceId || `bgm_${Date.now()}`;
    const t0 = performance.now();

    try {
      const storageRoot = process.env.STORAGE_ROOT || '.runtime';
      const sourcePath = safeJoin(storageRoot, sourceKey);
      const outRelative = `audio/bgm_mix_${traceId}.wav`;
      const outPath = safeJoin(storageRoot, outRelative);

      await fsp.mkdir(path.dirname(outPath), { recursive: true });

      if (
        !(await fsp
          .access(sourcePath)
          .then(() => true)
          .catch(() => false))
      ) {
        throw new Error(`BGM_SOURCE_NOT_FOUND: ${sourceKey}`);
      }

      // 1. FFmpeg Loop (Async)
      const args = [
        '-y',
        '-stream_loop',
        '-1',
        '-i',
        sourcePath,
        '-t',
        String(targetDuration),
        '-ar',
        '44100',
        '-ac',
        '2',
        outPath,
      ];

      this.logger.log(`[BGM_ASYNC] Executing: ffmpeg ${args.join(' ')}`);
      const res = await execAsync('ffmpeg', args);

      if (res.code !== 0) {
        throw new Error(`BGM_EXEC_FAIL: ffmpeg failed (code ${res.code}): ${res.stderr}`);
      }

      // 2. Precision Assert (ffprobe async)
      const probeRes = await execAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        outPath,
      ]);
      const actualDuration = parseFloat(probeRes.stdout.trim());

      if (Math.abs(actualDuration - targetDuration) > 0.1) {
        throw new Error(`BGM_DURATION_DRIFT: Target ${targetDuration}s, Got ${actualDuration}s`);
      }

      const hash = await sha256File(outPath);

      return {
        status: EngineInvokeStatus.SUCCESS,
        output: {
          storageKey: outRelative,
          duration: actualDuration,
          sha256: hash,
          provider: 'ffmpeg-loop-v1-async',
        },
        metrics: {
          durationMs: Math.round(performance.now() - t0),
        },
      };
    } catch (error: any) {
      this.logger.error(`[AUDIO_BGM_FAIL] ${error.message}`);
      return {
        status: EngineInvokeStatus.FAILED,
        error: { code: 'AUDIO_BGM_FAIL', message: error.message },
      };
    }
  }
}
