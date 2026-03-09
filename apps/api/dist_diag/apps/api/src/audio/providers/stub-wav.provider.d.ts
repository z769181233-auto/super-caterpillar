import { AudioProvider, AudioSynthesisInput, AudioSynthesisOutput } from './audio-provider.interface';
export declare class StubWavProvider implements AudioProvider {
    key(): "stub_wav_v1";
    synthesize(input: AudioSynthesisInput): Promise<AudioSynthesisOutput>;
}
