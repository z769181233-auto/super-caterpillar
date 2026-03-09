import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class BillingSettlementService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly logger;
    constructor(prisma: PrismaService, auditLogService: AuditLogService);
    settleProject(projectId: string, runId?: string): Promise<{
        processedCount: number;
        failedCount: number;
        durationMs?: undefined;
    } | {
        processedCount: number;
        failedCount: number;
        durationMs: number;
    }>;
    private recordAudit;
}
