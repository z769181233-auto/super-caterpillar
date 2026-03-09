import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class ShotRenderComfyuiAdapter implements EngineAdapter {
    readonly name = "shot_render_comfyui";
    private readonly logger;
    private readonly ASSETS_DIR;
    constructor();
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
