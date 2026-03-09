import { AuditInsightService } from './audit-insight.service';
import { NovelAuditFullResponse } from './audit-insight.dto';
import { AuthenticatedUser } from '@scu/shared-types';
export declare class AuditNovelController {
    private readonly auditInsightService;
    constructor(auditInsightService: AuditInsightService);
    getNovelAuditFull(novelSourceId: string, user?: AuthenticatedUser): Promise<NovelAuditFullResponse>;
}
