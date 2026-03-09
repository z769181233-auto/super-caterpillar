import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { LocalStorageService } from '../../storage/local-storage.service';
export declare class CE06LocalAdapter implements EngineAdapter {
    private readonly localStorage;
    readonly name = "ce06_novel_parsing";
    private readonly logger;
    constructor(localStorage: LocalStorageService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
