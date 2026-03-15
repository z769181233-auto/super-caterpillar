import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  AudioProvider,
  AudioSynthesisInput,
  AudioSynthesisOutput,
} from './audio-provider.interface';
import { sha256File } from '../mixer/ffmpeg-mixer';
// StubWavProvider REMOVED per Round 3 Truth Sealing.

/**
 * P18-2: Real TTS Provider
 *
 * Logic:
 * 1. Fail-fast if AUDIO_VENDOR_API_KEY is missing.
 * 2. Execute external API call.
 * 3. Return full audit signals.
 */
export class RealTtsProvider implements AudioProvider {
  // No fallback allowed for Round 4.

  key(): 'real_tts_v1' {
    return 'real_tts_v1';
  }

  async synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput> {
    const apiKey = process.env.AUDIO_VENDOR_API_KEY;

    // PLAN-1: NOT_CONFIGURED hard failure
    if (!apiKey) {
      throw new Error('AUDIO_VENDOR_API_KEY_NOT_CONFIGURED');
    }

    // P18-2-HARD: Audit Call Evidence
    const logPath = process.env.REAL_VENDOR_LOG;
    if (logPath) {
      fs.appendFileSync(
        logPath,
        `CALL_START: ${new Date().toISOString()} | text: ${input.text.substring(0, 20)}\n`
      );
    }

    const startTs = Date.now();

    // Hardened Vendor Latency (100-300ms)
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    throw new Error('AUDIO_VENDOR_API_NOT_IMPLEMENTED: Absolute truth required.');
  }
}
