interface EngineRoutingInput {
    jobType?: string | null;
    baseEngineKey?: string | null;
    payload?: any;
}
interface EngineRoutingResult {
    engineKey: string | null;
    resolvedVersion?: string | null;
}
export declare class EngineRoutingService {
    resolve(input: EngineRoutingInput): EngineRoutingResult;
}
export {};
