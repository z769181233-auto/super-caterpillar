export type AudioSynthesisInput = {
  text: string;
  voice?: string; // reserved
  seed?: string; // deterministic override
  sampleRate?: number; // default 48000
  channels?: number; // default 2
  libraryId?: string; // P18-6.0: Hardened library routing
  preview?: boolean; // P18-6.1: Fast partial synthesis
  maxDurationMs?: number; // P19-0.1: Hardened capping
};

export type AudioSynthesisMeta = {
  provider: 'truth_wav_v1' | 'real_tts_v1' | 'byo_audio' | 'deterministic_bgm_v1';
  algoVersion: string;
  durationMs: number;
  audioFileSha256: string;
  killSwitch: boolean;
  killSwitchSource: 'env' | 'none';
  vendor?: string;
  vendorRequestId?: string;
  vendorLatencyMs?: number;
  model?: string;
  bgmTrackId?: string;
  bgmLibraryVersion?: string;
  bgmSelectionSeed?: string;
  libraryId?: string;
  libraryIdSource?: 'env' | 'project' | 'default' | 'fallback';
  fallbackUsed?: boolean;
};

export type AudioSynthesisOutput = {
  absPath: string; // physical file path
  container: 'wav';
  meta: AudioSynthesisMeta;
};

export interface AudioProvider {
  key(): AudioSynthesisMeta['provider'];
  synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput>;
}
