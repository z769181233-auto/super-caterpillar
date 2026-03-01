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
 * Audio TTS Adapter - Industrial Grade (macOS say)
 * - 0 Sync IO (Async Only - No spawnSync)
 * - Path Traversal Protection (safeJoin)
 * - Correct Say Args topology
 */
@Injectable()
export class AudioTTSLocalAdapter implements EngineAdapter {
  public readonly name = 'audio_tts';
  private readonly logger = new Logger(AudioTTSLocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'audio_tts';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const { text, voice } = input.payload as any;
    const traceId = input.context?.traceId || `tts_${Date.now()}`;
    const t0 = performance.now();

    try {
      const storageRoot = process.env.STORAGE_ROOT || '.runtime';
      const outRelative = `audio/tts_${traceId}.wav`;
      const outPath = safeJoin(storageRoot, outRelative);
      const tmpAiff = outPath + '.aiff';

      await fsp.mkdir(path.dirname(outPath), { recursive: true });

      // 1. Backend Detect
      if (process.platform !== 'darwin') {
        throw new Error('TTS_BACKEND_UNAVAILABLE: "say" command only available on macOS.');
      }

      // 2. Say Command (Correct Topology: say -v voice -o output -- text)
      const sayArgs: string[] = [];
      if (voice) sayArgs.push('-v', voice);
      sayArgs.push('-o', tmpAiff, '--', text);

      this.logger.log(`[TTS_ASYNC] Executing: say ${sayArgs.join(' ')}`);
      const sayRes = await execAsync('say', sayArgs);

      if (sayRes.code !== 0) {
        throw new Error(`TTS_EXEC_FAIL: say failed (code ${sayRes.code}): ${sayRes.stderr}`);
      }

      // 3. Convert to WAV (Async)
      const ffmpegArgs = ['-y', '-i', tmpAiff, '-ar', '44100', '-ac', '1', outPath];
      const ffmpegRes = await execAsync('ffmpeg', ffmpegArgs);

      // Cleanup cleanup
      if (
        await fsp
          .access(tmpAiff)
          .then(() => true)
          .catch(() => false)
      ) {
        await fsp.unlink(tmpAiff);
      }

      if (ffmpegRes.code !== 0) {
        throw new Error(
          `TTS_CONVERT_FAIL: ffmpeg failed (code ${ffmpegRes.code}): ${ffmpegRes.stderr}`
        );
      }

      // 4. Physical Assertions (Realization)
      const stat = await fsp.stat(outPath);
      if (stat.size < 100) throw new Error('TTS_OUTPUT_EMPTY: Result file too small');

      const probeRes = await execAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        outPath,
      ]);
      const duration = parseFloat(probeRes.stdout.trim());
      if (isNaN(duration) || duration < 0.1) throw new Error(`TTS_DURATION_INVALID: ${duration}s`);

      const hash = await sha256File(outPath);

      return {
        status: EngineInvokeStatus.SUCCESS,
        output: {
          storageKey: outRelative,
          duration,
          sha256: hash,
          size: stat.size,
          provider: 'macos-say-v1-async',
        },
        metrics: {
          durationMs: Math.round(performance.now() - t0),
        },
      };
    } catch (error: any) {
      this.logger.error(`[AUDIO_TTS_FAIL] ${error.message}`);
      return {
        status: EngineInvokeStatus.FAILED,
        error: {
          code: 'AUDIO_TTS_FAIL',
          message: error.message,
        },
      };
    }
  }
}
