import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
import { TextSafetyService } from './text-safety.service';
import { QualityMetricsWriter } from '../quality/quality-metrics.writer';
import { VisualDensityDto } from './dto/visual-density.dto';
import { VisualEnrichDto } from './dto/visual-enrich.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class TextService {
    private readonly jobService;
    private readonly prisma;
    private readonly textSafetyService;
    private readonly auditLogService;
    private readonly qualityMetricsWriter;
    private readonly logger;
    constructor(jobService: JobService, prisma: PrismaService, textSafetyService: TextSafetyService, auditLogService: AuditLogService, qualityMetricsWriter: QualityMetricsWriter);
    visualDensity(dto: VisualDensityDto, userId?: string, organizationId?: string, ip?: string, userAgent?: string): Promise<{
        jobId: any;
        traceId: string;
        status: any;
        taskId: string;
    }>;
    visualEnrich(dto: VisualEnrichDto, userId?: string, organizationId?: string, ip?: string, userAgent?: string): Promise<{
        jobId: any;
        traceId: string;
        status: string;
        taskId: string;
        reason: string;
        safetyFlags: string[];
    } | {
        jobId: any;
        traceId: string;
        status: any;
        taskId: string;
        reason?: undefined;
        safetyFlags?: undefined;
    }>;
}
