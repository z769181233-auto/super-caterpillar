export interface EngineDescriptor {
    engineKey: string;
    version: string;
    mode: 'local' | 'http' | 'gpu';
    notes?: string;
    adapterToken?: any;
    httpConfig?: {
        baseUrl: string;
        path: string;
        timeoutMs?: number;
        [key: string]: unknown;
    };
}
