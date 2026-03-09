interface ResolveParams {
    jobType: string;
    payload?: any;
    defaultEngineKey?: string | null;
    httpDefaultEngineKey?: string | null;
}
interface ResolveResult {
    engineKey: string;
    resolvedVersion?: string | null;
}
export declare class EngineRoutingService {
    resolve(params: ResolveParams): ResolveResult;
}
export {};
