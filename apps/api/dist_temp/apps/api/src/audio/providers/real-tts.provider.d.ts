import { AudioProvider, AudioSynthesisInput, AudioSynthesisOutput } from './audio-provider.interface';
export declare class RealTtsProvider implements AudioProvider {
    private readonly stubFallback;
    key(): 'real_tts_v1';
    synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput>;
}
