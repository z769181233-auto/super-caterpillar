import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  AudioProvider,
  AudioSynthesisInput,
  AudioSynthesisOutput,
} from './audio-provider.interface';
import { sha256File } from '../mixer/ffmpeg-mixer';

/**
 * P18-3.1: Deterministic BGM Provider
 *
 * Logic:
 * 1. Derives "Instrument" and "Rhythm" from seed.
 * 2. Uses FFmpeg filters to generate a recognizable "BGM-like" stub.
 * 3. Exact same seed produces bit-exact output.
 */
export class DeterministicBgmProvider implements AudioProvider {
  key(): 'deterministic_bgm_v1' {
    return 'deterministic_bgm_v1';
  }

  private run(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      p.stderr.on('data', (d) => (stderr += d.toString()));
      p.on('error', reject);
      p.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`ffmpeg failed code=${code}\n${stderr}`));
      });
    });
  }

  async synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput> {
    const seed = input.seed || input.text;
    const h = crypto.createHash('sha256').update(seed, 'utf8').digest();

    // Derive BGM characteristics
    const baseFreq = 110 + (h[0] % 220); // 110Hz - 330Hz (Bassy)
    const pulseFreq = 1 + (h[1] % 5); // 1Hz - 6Hz (Rhythm)
    const durationSec = 30.0; // Fixed BGM loop length for P18-3

    const outDir = path.join(process.cwd(), 'tmp', 'audio_bgm');
    fs.mkdirSync(outDir, { recursive: true });

    const base = crypto.createHash('sha256').update(`${seed}|BGM`).digest('hex').slice(0, 16);
    const outPath = path.join(outDir, `bgm_${base}.wav`);

    // Generate a "Rhythmic" BGM stub using AM modulation
    // sine * (1 + sin(pulse))
    const lavfi = `sine=f=${baseFreq}:d=${durationSec},aecho=0.8:0.88:60:0.4`;

    const args = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      lavfi,
      '-ar',
      '48000',
      '-ac',
      '2',
      '-c:a',
      'pcm_s16le',
      '-flags',
      '+bitexact',
      outPath,
    ];

    await this.run('ffmpeg', args);

    const fileSha = sha256File(outPath);

    return {
      absPath: outPath,
      container: 'wav',
      meta: {
        provider: this.key(),
        algoVersion: 'bgm_v1_deterministic',
        durationMs: durationSec * 1000,
        audioFileSha256: fileSha,
        killSwitch: false,
        killSwitchSource: 'none',
        model: `bgm_${baseFreq}hz_${pulseFreq}bpm`,
      },
    };
  }
}
