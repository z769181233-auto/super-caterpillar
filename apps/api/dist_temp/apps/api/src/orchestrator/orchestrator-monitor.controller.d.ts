import { OrchestratorService } from './orchestrator.service';
export declare class OrchestratorMonitorController {
    private readonly orchestratorService;
    constructor(orchestratorService: OrchestratorService);
    getStats(): Promise<{
        success: boolean;
        data: {
            timestamp: string;
            jobs: {
                pending: number;
                running: number;
                retrying: number;
                failed: number;
                succeeded: number;
                total: number;
            };
            workers: {
                total: number;
                online: number;
                offline: number;
                idle: number;
                busy: number;
            };
            retries: {
                recent24h: {
                    total: number;
                    byType: Record<string, {
                        count: number;
                        totalRetryCount: number;
                    }>;
                };
            };
            queue: {
                avgWaitTimeMs: number;
                avgWaitTimeSeconds: number;
            };
            recovery: {
                recent1h: {
                    recoveredJobs: number;
                };
            };
            engines: Record<string, {
                pending: number;
                running: number;
                failed: number;
            }>;
        };
        requestId: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: string;
    }>;
}
