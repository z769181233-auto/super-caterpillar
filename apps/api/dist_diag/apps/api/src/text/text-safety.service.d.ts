import { AuditLogService } from '../audit-log/audit-log.service';
export declare class TextSafetyService {
    private readonly auditLogService;
    private readonly logger;
    private readonly BLACKLIST_KEYWORDS;
    constructor(auditLogService: AuditLogService);
    sanitize(text: string, userId?: string, ip?: string, userAgent?: string): Promise<{
        passed: boolean;
        sanitizedText: string;
        flags: string[];
    }>;
}
