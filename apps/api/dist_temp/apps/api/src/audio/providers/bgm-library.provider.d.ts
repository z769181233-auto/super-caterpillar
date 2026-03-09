import { AudioProvider, AudioSynthesisInput, AudioSynthesisOutput } from './audio-provider.interface';
export declare class BgmLibraryProvider implements AudioProvider {
    key(): 'deterministic_bgm_v1';
    private run;
    private weightedPick;
    synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput>;
}
