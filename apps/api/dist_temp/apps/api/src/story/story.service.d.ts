import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParseStoryDto } from './dto/parse-story.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NovelImportService } from '../novel-import/novel-import.service';
export declare class StoryService {
    private readonly jobService;
    private readonly prisma;
    private readonly auditLogService;
    private readonly novelImportService;
    private readonly logger;
    constructor(jobService: JobService, prisma: PrismaService, auditLogService: AuditLogService, novelImportService: NovelImportService);
    parseStory(dto: ParseStoryDto, userId?: string, organizationId?: string, ip?: string, userAgent?: string, targetTraceId?: string, isVerification?: boolean): Promise<{
        jobId: any;
        traceId: string;
        status: string;
        taskId: any;
    } | {
        jobId: any;
        traceId: string;
        status: any;
        taskId: string;
    }>;
}
