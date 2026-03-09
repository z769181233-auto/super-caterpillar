import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from './job.service';
export declare class JobWorkerService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly jobService;
    private readonly logger;
    private intervalId;
    private isProcessing;
    constructor(prisma: PrismaService, jobService: JobService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    private start;
    private stop;
    private processJobs;
}
