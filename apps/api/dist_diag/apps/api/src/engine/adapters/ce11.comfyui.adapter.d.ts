import { OnModuleInit } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
export declare class CE11ComfyUIAdapter implements EngineAdapter, OnModuleInit {
    private readonly logger;
    name: string;
    private readonly DEFAULT_TEMPLATE;
    onModuleInit(): void;
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    private validateConfig;
    private loadTemplate;
    private injectNodeValue;
    private executeComfyUI;
    private parseOutputs;
}
