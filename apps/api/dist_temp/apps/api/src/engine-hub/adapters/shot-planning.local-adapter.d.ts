import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class ShotPlanningLocalAdapter implements EngineAdapter {
    readonly name = "ShotPlanningLocalAdapter";
    readonly mode = "local";
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
