import { PrismaService } from '../prisma/prisma.service';
export declare class MonitoringService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
