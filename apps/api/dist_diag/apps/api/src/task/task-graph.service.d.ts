import { PrismaService } from '../prisma/prisma.service';
export interface TaskGraphJobNode {
    jobId: string;
    jobType: string;
    status: string;
    attempts: number;
    retryCount: number;
    maxRetry: number | null;
    createdAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
}
export interface TaskGraph {
    taskId: string;
    projectId: string;
    taskType: string;
    status: string;
    jobs: TaskGraphJobNode[];
}
export declare class TaskGraphService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    findTaskGraph(taskId: string): Promise<TaskGraph | null>;
}
