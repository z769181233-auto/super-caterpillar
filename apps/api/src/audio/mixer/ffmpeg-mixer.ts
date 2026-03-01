import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';

export type MixInput = {
  voiceWavPath: string;
  bgmWavPath: string;
  outWavPath: string;
  // ducking strength: lower => more ducking
  duckingRatio?: number; // default 6
  fadeMs?: number; // default 300
  durationMs?: number; // explicit limit
};

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

export function sha256File(absPath: string): string {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Mix voice + bgm with ducking (sidechaincompress) and fade.
// Assumes both are WAV. Outputs WAV.
export async function mixWithDucking(input: MixInput): Promise<{ outSha256: string }> {
  const fadeMs = input.fadeMs ?? 500;
  const durSec = input.durationMs ? input.durationMs / 1000 : 0;

  // P18-3.2 Hardened Parameters
  // 1. Loop BGM infinitely
  // 2. Sidechain compress [1:a] (BGM) by [0:a] (Voice)
  // 3. Mix
  // 4. Fade In/Out

  // We use sidechaincompress for higher quality ducking.
  const filter = [
    `[1:a][0:a]sidechaincompress=threshold=0.08:ratio=15:attack=0.1:release=1.2[bgm_ducked]`,
    `[0:a][bgm_ducked]amix=inputs=2:duration=first:normalize=0[mixed]`,
    `[mixed]afade=t=in:d=${fadeMs / 1000}${durSec > 1 ? `,afade=t=out:d=${fadeMs / 1000}:st=${(durSec - fadeMs / 1000).toFixed(3)}` : ''}[outa]`,
  ].join(';');

  const args = [
    '-y',
    '-i',
    input.voiceWavPath,
    '-stream_loop',
    '-1',
    '-i',
    input.bgmWavPath,
    '-filter_complex',
    filter,
    '-map',
    '[outa]',
    '-c:a',
    'pcm_s16le',
    '-ar',
    '48000',
    '-threads',
    '1',
    '-fflags',
    '+bitexact',
    '-flags',
    '+bitexact',
    '-map_metadata',
    '-1',
  ];

  if (durSec > 0) {
    args.push('-t', durSec.toFixed(3));
  }

  args.push(input.outWavPath);

  await run('ffmpeg', args);
  return { outSha256: sha256File(input.outWavPath) };
}
