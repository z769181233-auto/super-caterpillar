import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class SemanticEnhancementLocalAdapter implements EngineAdapter {
    readonly name = "SemanticEnhancementLocalAdapter";
    readonly mode = "local";
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
