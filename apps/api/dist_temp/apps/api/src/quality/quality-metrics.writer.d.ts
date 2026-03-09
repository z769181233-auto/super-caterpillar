import { PrismaService } from '../prisma/prisma.service';
export declare class QualityMetricsWriter {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    writeQualityMetrics(params: {
        jobId: string;
        jobType: string;
        projectId: string;
        traceId?: string;
        result?: any;
    }): Promise<boolean>;
}
