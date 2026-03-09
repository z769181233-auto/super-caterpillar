import { AuditLogService } from './audit-log.service';
interface CEAuditLogPayload {
    traceId: string;
    projectId: string;
    jobId: string;
    jobType: string;
    engineKey: string;
    status: 'SUCCESS' | 'FAILED';
    inputHash?: string;
    outputHash?: string;
    latencyMs?: number;
    cost?: number;
    auditTrail?: any;
    errorMessage?: string;
}
export declare class AuditLogController {
    private readonly auditLogService;
    private readonly logger;
    constructor(auditLogService: AuditLogService);
    createAuditLog(payload: CEAuditLogPayload): Promise<{
        success: boolean;
    }>;
}
export {};
