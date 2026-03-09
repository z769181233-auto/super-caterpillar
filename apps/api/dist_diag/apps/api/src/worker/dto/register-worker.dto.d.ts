export declare class RegisterWorkerDto {
    workerId: string;
    name: string;
    capabilities?: {
        supportedJobTypes?: string[];
        supportedModels?: string[];
        maxBatchSize?: number;
    };
    gpuCount?: number;
    gpuMemory?: number;
    gpuType?: string;
}
