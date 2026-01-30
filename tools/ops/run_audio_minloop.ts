import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Mock OpsMetricsService to satisfy AudioService constructor
const mockMetrics = {
  incrementAudioPreview: () => {},
  incrementAudioVendorCall: () => {},
  incrementAudioCacheHit: () => {},
  incrementAudioCacheMiss: () => {},
} as any;

// IMPORTANT: Adjust import path if your api module root differs.
// We avoid importing full AppModule to keep this isolated.
// Instead, we directly create the AudioService instance.
// If later you want DI, wire AudioModule into AppModule and use app.get(AudioService).
import { AudioService } from '../../apps/api/src/audio/audio.service';

type RunResult = {
  ts: number;
  killSwitch: boolean;
  projectSettings: any;
  text: string;
  voice: { sha256: string; durationMs: number; provider: string; absPath: string };
  mixed?: { sha256: string; absPath: string };
  signals: Record<string, any>;
};

function sha256File(absPath: string): string {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function copyToEvidence(src: string, dstDir: string): string {
  fs.mkdirSync(dstDir, { recursive: true });
  const base = path.basename(src);
  const dst = path.join(dstDir, base);
  fs.copyFileSync(src, dst);
  return dst;
}

async function main() {
  const text = process.env.AUDIO_TEXT ?? 'p18-audio-minloop';
  const evidDir = process.env.EVID_DIR;
  if (!evidDir) throw new Error('EVID_DIR is required');

  const projectSettings = {
    audioRealEnabled: process.env.AUDIO_REAL_ENABLED === '1',
    audioMixerEnabled: process.env.AUDIO_MIXER_ENABLED !== '0',
    audioBgmEnabled: process.env.AUDIO_BGM_ENABLED === '1',
  };

  // For P18-0 we instantiate directly (0-risk, no DI).
  const svc = new AudioService(mockMetrics);

  const res = await svc.generateAndMix({
    text,
    projectSettings,
    bgmSeed: process.env.AUDIO_BGM_SEED ?? 'bgm-seed-v1',
  });

  const assetsDir = path.join(evidDir, 'assets');
  const voiceCopied = copyToEvidence(res.voice.absPath, assetsDir);
  const voiceSha = sha256File(voiceCopied);

  let mixedCopied: string | undefined;
  let mixedSha: string | undefined;
  if (res.mixed?.absPath) {
    mixedCopied = copyToEvidence(res.mixed.absPath, assetsDir);
    mixedSha = sha256File(mixedCopied);
  }

  const out: RunResult = {
    ts: Date.now(),
    killSwitch: process.env.AUDIO_REAL_FORCE_DISABLE === '1',
    projectSettings,
    text,
    voice: {
      sha256: voiceSha,
      durationMs: res.voice.meta.durationMs,
      provider: res.voice.meta.provider,
      absPath: voiceCopied,
    },
    mixed: mixedCopied && mixedSha ? { sha256: mixedSha, absPath: mixedCopied } : undefined,
    signals: res.signals,
  };

  const outPath = path.join(evidDir, 'run.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
