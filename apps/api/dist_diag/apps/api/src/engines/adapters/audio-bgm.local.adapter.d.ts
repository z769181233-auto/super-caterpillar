import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class AudioBGMLocalAdapter implements EngineAdapter {
    readonly name = "audio_bgm";
    private readonly logger;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
