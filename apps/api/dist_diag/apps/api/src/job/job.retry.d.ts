import { Prisma, JobStatus } from 'database';
export interface RetryComputation {
    nextRetryCount: number;
    nextRetryAt: Date | null;
    shouldFail: boolean;
    backoffMs: number;
}
export declare function computeNextRetry(job: {
    retryCount: number;
    maxRetry: number;
}): RetryComputation;
export declare function markRetryOrFail(tx: Prisma.TransactionClient, job: {
    id: string;
    projectId: string;
    retryCount: number;
    maxRetry: number;
    payload: any;
}, failPayload?: {
    errorMessage?: string;
}): Promise<{
    status: JobStatus;
    retryCount: number;
    nextRetryAt: Date | null;
}>;
