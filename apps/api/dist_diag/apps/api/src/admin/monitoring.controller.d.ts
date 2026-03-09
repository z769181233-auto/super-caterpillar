import { MonitoringService } from './monitoring.service';
export declare class MonitoringController {
    private readonly monitoringService;
    constructor(monitoringService: MonitoringService);
    getP1Metrics(): Promise<{
        timestamp: number;
        metrics: {
            jobs_total: number;
            jobs_pending: number;
            jobs_succeeded: number;
            jobs_failed: number;
            ledger_dups: number;
            latency_p95_ms: number;
            window: string;
        };
    }>;
}
export declare class PublicMetricsController {
    getPrometheusMetrics(): Promise<string>;
}
