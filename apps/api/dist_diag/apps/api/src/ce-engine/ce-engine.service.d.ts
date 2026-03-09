import { JobService } from '../job/job.service';
import { TaskService } from '../task/task.service';
import { TextSafetyService } from '../text-safety/text-safety.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class CEEngineService {
    private readonly jobService;
    private readonly taskService;
    private readonly textSafetyService;
    private readonly prisma;
    private readonly logger;
    constructor(jobService: JobService, taskService: TaskService, textSafetyService: TextSafetyService, prisma: PrismaService);
    parseStory(dto: {
        projectId: string;
        rawText: string;
        options?: {
            engineKey?: string;
            engineVersion?: string;
        };
    }, userId: string, organizationId: string, apiKeyId?: string): Promise<{
        jobId: string;
        traceId: string;
        status: string;
    }>;
    analyzeVisualDensity(dto: {
        projectId: string;
        text: string;
        options?: {
            engineKey?: string;
            engineVersion?: string;
        };
    }, userId: string, organizationId: string, apiKeyId?: string): Promise<{
        jobId: string;
        traceId: string;
        status: string;
    }>;
    enrichText(dto: {
        projectId: string;
        text: string;
        options?: {
            engineKey?: string;
            engineVersion?: string;
        };
    }, userId: string, organizationId: string, apiKeyId?: string, ip?: string, userAgent?: string): Promise<{
        jobId: string;
        traceId: string;
        status: string;
    }>;
}
