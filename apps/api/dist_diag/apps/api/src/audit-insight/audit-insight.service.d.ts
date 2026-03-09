import { PrismaService } from '../prisma/prisma.service';
import { NovelInsightResponse, JobAuditResponse, NovelAuditFullResponse } from './audit-insight.dto';
import { SignedUrlService } from '../storage/signed-url.service';
export declare class AuditInsightService {
    private readonly prisma;
    private readonly signedUrlService;
    private readonly logger;
    constructor(prisma: PrismaService, signedUrlService: SignedUrlService);
    getNovelInsight(novelSourceId: string): Promise<NovelInsightResponse>;
    getNovelAuditFull(novelSourceId: string, userId: string): Promise<NovelAuditFullResponse>;
    getJobAudit(jobId: string): Promise<JobAuditResponse>;
}
