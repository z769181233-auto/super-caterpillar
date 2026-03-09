import { JobService } from '../../job/job.service';
import { PrismaService } from '../../prisma/prisma.service';
export declare class ProductionFlowHook {
    private readonly jobService;
    private readonly prisma;
    private readonly logger;
    constructor(jobService: JobService, prisma: PrismaService);
    handleJobSucceeded(evt: any): Promise<void>;
    private handleShotRenderSuccess;
    private handleTimelineComposeSuccess;
    private handleTimelineRenderSuccess;
}
