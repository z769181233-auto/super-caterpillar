import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { EngineConfigStoreService } from './engine-config-store.service';
import { EngineRoutingService } from './engine-routing.service';
import { EngineStrategyService } from './engine-strategy.service';
export declare class EngineRegistry {
    private readonly engineConfigStore;
    private readonly engineRoutingService;
    private readonly engineStrategyService?;
    private readonly logger;
    private adapters;
    private aliasedKeys;
    private defaultEngineKey;
    private jsonConfigMap;
    private ensureAdapters;
    private safeLog;
    constructor(engineConfigStore: EngineConfigStoreService, engineRoutingService: EngineRoutingService, engineStrategyService?: EngineStrategyService | undefined);
    private getJsonConfig;
    resolveEngineConfig(engineKey: string): Promise<any | null>;
    resolveEngineConfigWithVersion(engineKey: string, engineVersion?: string): Promise<any | null>;
    register(adapter: EngineAdapter): void;
    registerAlias(alias: string, adapter: EngineAdapter): void;
    getAdapter(engineKey: string): EngineAdapter | null;
    getDefaultAdapter(): EngineAdapter | null;
    findAdapter(engineKey?: string, jobType?: string, payload?: any): EngineAdapter;
    getDefaultEngineKeyForJobType(jobType: string): string | null;
    resolveEngineForJobType(jobType: string): Promise<{
        id: string;
        code: string;
        name: string;
        type: string;
        isActive: boolean;
    } | null>;
    getAllEngineNames(): string[];
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
