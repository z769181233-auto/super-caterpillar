import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class NovelAnalysisLocalAdapter implements EngineAdapter {
    readonly name = "default_novel_analysis";
    private readonly logger;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
