import { AuditInsightService } from './audit-insight.service';
import { NovelInsightResponse, JobAuditResponse } from './audit-insight.dto';
export declare class AuditInsightController {
    private readonly auditInsightService;
    constructor(auditInsightService: AuditInsightService);
    getNovelInsight(novelSourceId: string): Promise<NovelInsightResponse>;
    getJobAudit(jobId: string): Promise<JobAuditResponse>;
}
