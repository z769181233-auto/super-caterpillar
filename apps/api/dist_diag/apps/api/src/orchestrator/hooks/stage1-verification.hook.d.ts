import { JobService } from '../../job/job.service';
import { PrismaService } from '../../prisma/prisma.service';
export declare class Stage1VerificationHook {
    private readonly jobService;
    private readonly prisma;
    private readonly logger;
    constructor(jobService: JobService, prisma: PrismaService);
    handleJobSucceeded(evt: any): Promise<void>;
}
