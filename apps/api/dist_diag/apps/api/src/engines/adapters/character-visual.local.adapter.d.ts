import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class CharacterVisualLocalAdapter implements EngineAdapter {
    readonly name = "character_visual";
    private readonly logger;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
