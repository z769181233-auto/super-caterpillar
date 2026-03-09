import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class StructureQALocalAdapter implements EngineAdapter {
    readonly name = "StructureQALocalAdapter";
    readonly mode = "local";
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
