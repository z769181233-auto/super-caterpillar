import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class G5SemanticMotionMapperAdapter implements EngineAdapter {
    name: string;
    private readonly logger;
    private readonly TEMPLATE_LIB;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
