export type HttpAuthMode = 'none' | 'bearer' | 'apiKey' | 'hmac';
export interface HttpHmacConfig {
    keyId: string;
    secret: string;
    algorithm: 'sha256';
    header?: string;
}
export interface HttpEngineConfig {
    baseUrl: string;
    timeoutMs: number;
    connectTimeoutMs?: number;
    path?: string;
    maxBodyMb?: number;
    authMode: HttpAuthMode;
    apiKey?: string;
    apiKeyHeader?: string;
    hmac?: HttpHmacConfig;
}
export interface EngineConfig {
    engineKey: string;
    adapterName: string;
    adapterType: 'local' | 'http';
    httpConfig?: {
        baseUrl: string;
        path?: string;
        timeoutMs?: number;
        connectTimeoutMs?: number;
        maxBodyMb?: number;
        authMode?: HttpAuthMode;
        apiKeyHeader?: string;
    };
    modelInfo?: {
        modelName?: string;
        version?: string;
    };
    isDefault?: boolean;
    isDefaultForJobTypes?: Record<string, boolean>;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
}
export declare class EngineConfigService {
    private readonly logger;
    private enginesConfigCache;
    getHttpEngineConfig(engineKey: string): HttpEngineConfig;
    private loadEngineConfigsFromJson;
    private findEngineConfigByKey;
    private validateHttpEngineConfig;
    clearCache(): void;
}
