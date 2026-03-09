import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class G5DialogueBindingAdapter implements EngineAdapter {
    name: string;
    private readonly logger;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
