import { EngineRoutingService } from './engine-routing.service';
export interface StrategyContext {
    projectId?: string;
    tenantId?: string;
    experimentId?: string;
    experimentGroup?: 'A' | 'B' | 'control';
    [key: string]: any;
}
export interface StrategyDecision {
    engineKey: string | null;
    resolvedVersion?: string | null;
    strategyLabel?: string;
    experimentId?: string;
    experimentGroup?: 'A' | 'B' | 'control';
}
export declare class EngineStrategyService {
    private readonly engineRoutingService;
    constructor(engineRoutingService: EngineRoutingService);
    decideStrategy(jobType: string | null, payload: any, baseEngineKey?: string | null, context?: StrategyContext): StrategyDecision;
}
