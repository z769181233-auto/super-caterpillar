import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import {
  AudioProvider,
  AudioSynthesisInput,
  AudioSynthesisOutput,
} from './providers/audio-provider.interface';
import { StubWavProvider } from './providers/stub-wav.provider';
import { RealTtsProvider } from './providers/real-tts.provider';
import { BgmLibraryProvider } from './providers/bgm-library.provider';
import { mixWithDucking, sha256File } from './mixer/ffmpeg-mixer';
import { OpsMetricsService } from '../ops/ops-metrics.service';

export type AudioProjectSettings = {
  audioRealEnabled?: boolean; // default false
  audioBgmEnabled?: boolean; // default false
  audioMixerEnabled?: boolean; // default true for P18 minloop
  audioBgmLibraryId?: string; // default bgm_lib_v1
};

export interface PrismaLike {
  project: {
    findUnique(args: any): Promise<any>;
  };
}

export type AudioGenerateRequest = {
  text: string;
  projectSettings?: AudioProjectSettings;
  bgmSeed?: string; // deterministic bgm generator seed
  preview?: boolean; // P18-6.1: Fast partial synthesis
  previewCapMs?: number; // P19-0.1: Hardened capping (default 3000 stub/real)
};

export type AudioGenerateResult = {
  voice: AudioSynthesisOutput;
  mixed?: { absPath: string; sha256: string };
  signals: Record<string, any>; // audit payload for later DB persistence
};

@Injectable()
export class AudioService {
  private readonly stubProvider: AudioProvider;
  private readonly realProvider: AudioProvider;
  private readonly bgmProvider: AudioProvider;

  constructor(private readonly metrics: OpsMetricsService) {
    this.stubProvider = new StubWavProvider();
    this.realProvider = new RealTtsProvider();
    this.bgmProvider = new BgmLibraryProvider();
  }

  async resolveProjectSettings(
    prisma: PrismaLike,
    projectId: string
  ): Promise<AudioProjectSettings> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { settingsJson: true },
    });
    if (!project || !project.settingsJson) return {};
    const s = project.settingsJson as any;
    return {
      audioRealEnabled: s.audioRealEnabled === true || s.audioRealEnabled === 'true',
      audioBgmEnabled: s.audioBgmEnabled === true || s.audioBgmEnabled === 'true',
      audioMixerEnabled: s.audioMixerEnabled !== false && s.audioMixerEnabled !== 'false',
      audioBgmLibraryId: s.audioBgmLibraryId || undefined,
    };
  }

  private isKillSwitchOn(): boolean {
    return process.env.AUDIO_REAL_FORCE_DISABLE === '1';
  }

  async generateAndMix(req: AudioGenerateRequest): Promise<AudioGenerateResult> {
    const project = req.projectSettings ?? {};
    const killOn = this.isKillSwitchOn();

    // P20-0: Metrics Instrumentation
    if (req.preview) this.metrics.incrementAudioPreview();

    // Strict silence: when kill switch ON -> force legacy/stub, do not attempt real/shadow, do not emit real signals
    if (killOn) {
      const voice = await this.stubProvider.synthesize({ text: req.text });
      const signals = {
        audio_kill_switch: true,
        audio_kill_switch_source: 'env',
        audio_mode: 'legacy',
        provider: voice.meta.provider,
        algo_version: voice.meta.algoVersion,
        duration_ms: voice.meta.durationMs,
        audio_file_sha256: voice.meta.audioFileSha256,
        // P19-0.1 Audit Signals
        audio_preview: !!req.preview,
        preview_cap_ms: req.preview ? req.previewCapMs || 3000 : 0,
        voice_meta: voice.meta,
        audio_real_enabled: project.audioRealEnabled,
      };
      return { voice, signals };
    }

    // P18-2 Logic: Selection based on Whitelist
    const provider = project.audioRealEnabled ? this.realProvider : this.stubProvider;
    if (project.audioRealEnabled && !killOn) {
      this.metrics.incrementAudioVendorCall();
    }
    const voice = await provider.synthesize({
      text: req.text,
      preview: req.preview,
    });

    const signals: Record<string, any> = {
      audio_kill_switch: false,
      audio_kill_switch_source: 'none',
      audio_mode: project.audioRealEnabled ? 'real' : 'stub',
      provider: voice.meta.provider,
      algo_version: voice.meta.algoVersion,
      duration_ms: voice.meta.durationMs,
      audio_file_sha256: voice.meta.audioFileSha256,
      // P18-2 Audit Signals
      // P19-0.1 Audit Signals
      audio_preview: !!req.preview,
      preview_cap_ms: req.preview ? req.previewCapMs || 3000 : 0,
      voice_meta: voice.meta,
      audio_real_enabled: project.audioRealEnabled,
    };

    // Mixer (REAL meaning for P18-0): run ffmpeg mixing deterministically
    // We generate deterministic BGM from seed using same stub provider (different seed).
    const mixerEnabled = project.audioMixerEnabled ?? true;
    if (!mixerEnabled) {
      return { voice, signals };
    }

    if (!project.audioBgmEnabled) {
      return { voice, signals };
    }

    // P18-3.1 Deterministic BGM + P18-5.2 Routing
    const bgmSeed = req.bgmSeed ?? req.text;

    // P18-5.2 Routing Logic
    const libOverride = process.env.AUDIO_BGM_LIBRARY_ID_OVERRIDE;
    const libRequested = libOverride || project.audioBgmLibraryId || 'bgm_lib_v1';

    const bgm = await this.bgmProvider.synthesize({
      text: bgmSeed,
      seed: bgmSeed,
      libraryId: libRequested,
      preview: req.preview,
    });
    signals.bgm_library_requested = libRequested;

    const outDir = path.join(process.cwd(), 'tmp', 'audio_mix');
    fs.mkdirSync(outDir, { recursive: true });

    // P19-0.1: Multi-factor Mix Cache Key
    const mixCacheObj = {
      voiceSha: voice.meta.audioFileSha256,
      bgmSha: bgm.meta.audioFileSha256,
      voiceDur: voice.meta.durationMs,
      mixer: 'ffmpeg_mix_v1',
      preview: !!req.preview,
      previewCapMs: req.preview ? req.previewCapMs || 3000 : 0,
    };
    const mixKey = crypto
      .createHash('sha256')
      .update(JSON.stringify(mixCacheObj))
      .digest('hex')
      .slice(0, 16);

    const outPath = path.join(outDir, `mix_${mixKey}.wav`);

    // P18-3.2 + P18-6.2: Use hardened mixer with caching
    if (fs.existsSync(outPath)) {
      console.log(`[CACHE] Mix Hit: ${outPath}`);
      this.metrics.incrementAudioCacheHit();
    } else {
      this.metrics.incrementAudioCacheMiss();
      await mixWithDucking({
        voiceWavPath: voice.absPath,
        bgmWavPath: bgm.absPath,
        outWavPath: outPath,
        durationMs: voice.meta.durationMs, // Final duration follows voice (short in preview)
      });
    }

    const mixedSha = sha256File(outPath);

    // P18-3.0 Unified Mixed Signals
    signals.mixer = 'ffmpeg_mix_v1';
    signals.mixed_audio_sha256 = mixedSha;
    signals.bgm_provider = bgm.meta.provider;
    signals.bgm_sha256 = bgm.meta.audioFileSha256;

    // P18-4.2: Hardened Audit Signals
    signals.bgm_track_id = bgm.meta.bgmTrackId;
    signals.bgm_library_version = bgm.meta.bgmLibraryVersion;
    signals.bgm_selection_seed = bgm.meta.bgmSelectionSeed;

    // P18-6.0: Library Routing Audit
    signals.bgm_library_id = bgm.meta.libraryId;
    signals.bgm_library_id_source = bgm.meta.libraryIdSource;
    signals.bgm_library_id_requested = libRequested;

    signals.mixer_params = {
      gain: 1.0,
      ducking: {
        algo: 'sidechaincompress_v1',
        threshold: 0.08,
        ratio: 15,
        attack: 0.1,
        release: 1.2,
      },
      fade: {
        algo: 'afade_v1',
        duration_ms: 500,
      },
    };

    return {
      voice,
      mixed: { absPath: outPath, sha256: mixedSha },
      signals,
      // P18-3: Also return BGM if needed for separate persistence
      // @ts-expect-error
      bgm,
    };
  }
}
