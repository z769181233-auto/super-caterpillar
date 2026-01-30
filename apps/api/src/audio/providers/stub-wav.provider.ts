import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  AudioProvider,
  AudioSynthesisInput,
  AudioSynthesisOutput,
} from './audio-provider.interface';

function run(cmd: string, args: string[]): Promise<void> {
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

function sha256File(absPath: string): string {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Deterministic mapping: text -> (freq, duration)
function deriveParams(text: string) {
  const h = crypto.createHash('sha256').update(text, 'utf8').digest();
  const u16 = (h[0] << 8) | h[1];
  const u16b = (h[2] << 8) | h[3];

  // freq: 220~880Hz
  const freq = 220 + (u16 % 661);
  // duration: 0.8s ~ 10.0s
  const durMs = 800 + (u16b % 9201);
  return { freq, durMs };
}

export class StubWavProvider implements AudioProvider {
  key() {
    return 'stub_wav_v1' as const;
  }

  async synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput> {
    const text = input.text ?? '';
    const sampleRate = input.sampleRate ?? 48000;
    const channels = input.channels ?? 2;

    const { freq, durMs } = deriveParams(input.seed ?? text);
    let durationSec = durMs / 1000;
    if (input.preview) {
      durationSec = Math.min(durationSec, 3.0);
    }
    const durationSecStr = durationSec.toFixed(3);

    const outDir = path.join(process.cwd(), 'tmp', 'audio_stub');
    fs.mkdirSync(outDir, { recursive: true });

    // P19-0.1: Multi-factor Cache Key
    const cacheObj = {
      seed: input.seed || text,
      freq,
      durationSec: parseFloat(durationSecStr),
      sampleRate,
      channels,
      preview: !!input.preview,
    };
    const cacheKey = crypto
      .createHash('sha256')
      .update(JSON.stringify(cacheObj))
      .digest('hex')
      .slice(0, 16);
    const outPath = path.join(outDir, `stub_${cacheKey}.wav`);

    // Deterministic WAV via sine generator
    // -f lavfi -i "sine=frequency=F:duration=D" ... pcm_s16le
    const args = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${freq}:duration=${durationSecStr}`,
      '-ac',
      String(channels),
      '-ar',
      String(sampleRate),
      '-c:a',
      'pcm_s16le',
      '-flags',
      '+bitexact',
      '-map_metadata',
      '-1',
      outPath,
    ];

    if (fs.existsSync(outPath)) {
      // P18-6.2: 0-cost cache hit
    } else {
      await run('ffmpeg', args);
    }

    const fileSha = sha256File(outPath);

    return {
      absPath: outPath,
      container: 'wav',
      meta: {
        provider: 'stub_wav_v1',
        algoVersion: 'stub_wav_v1',
        durationMs: Math.round(durationSec * 1000),
        audioFileSha256: fileSha,
        killSwitch: false,
        killSwitchSource: 'none',
      },
    };
  }
}
