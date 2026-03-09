import { PrismaService } from '../prisma/prisma.service';
export declare class JobWatchdogService {
    private readonly prisma;
    private readonly logger;
    private readonly jobTimeoutMs;
    private readonly workerHeartbeatTimeoutMs;
    constructor(prisma: PrismaService);
    recoverStuckJobs(): Promise<void>;
}
