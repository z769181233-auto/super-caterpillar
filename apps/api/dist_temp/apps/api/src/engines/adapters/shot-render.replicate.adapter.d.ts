import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class ShotRenderReplicateAdapter implements EngineAdapter {
    readonly name = "shot_render_replicate";
    private readonly logger;
    private replicate;
    private readonly ASSETS_DIR;
    constructor();
    private getReplicate;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    private downloadImage;
    private calculateSHA256;
}
