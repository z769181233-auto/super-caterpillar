import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class ShotRenderMpsAdapter implements EngineAdapter {
    readonly name = "shot_render_mps";
    private readonly logger;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
