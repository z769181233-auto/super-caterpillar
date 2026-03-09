import { AudioProvider, AudioSynthesisInput, AudioSynthesisOutput } from './audio-provider.interface';
export declare class DeterministicBgmProvider implements AudioProvider {
    key(): 'deterministic_bgm_v1';
    private run;
    synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput>;
}
