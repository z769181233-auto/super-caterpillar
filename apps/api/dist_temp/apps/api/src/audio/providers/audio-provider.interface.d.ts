export type AudioSynthesisInput = {
    text: string;
    voice?: string;
    seed?: string;
    sampleRate?: number;
    channels?: number;
    libraryId?: string;
    preview?: boolean;
    maxDurationMs?: number;
};
export type AudioSynthesisMeta = {
    provider: 'stub_wav_v1' | 'real_tts_v1' | 'byo_audio' | 'deterministic_bgm_v1';
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
};
export type AudioSynthesisOutput = {
    absPath: string;
    container: 'wav';
    meta: AudioSynthesisMeta;
};
export interface AudioProvider {
    key(): AudioSynthesisMeta['provider'];
    synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput>;
}
