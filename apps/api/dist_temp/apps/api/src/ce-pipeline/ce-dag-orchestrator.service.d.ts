import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { CEDagRunRequest, CEDagRunResult } from './ce-dag.types';
export declare class CEDagOrchestratorService {
    private readonly prisma;
    private readonly jobService;
    private readonly logger;
    constructor(prisma: PrismaService, jobService: JobService);
    runCEDag(req: CEDagRunRequest): Promise<CEDagRunResult>;
    private waitForJobCompletion;
    private waitForJobsCompletion;
}
