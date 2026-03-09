import { JobStatus } from 'database';
export declare const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]>;
export declare function assertTransition(from: JobStatus, to: JobStatus, ctx: {
    jobId: string;
    jobType?: string;
    workerId?: string;
    errorCode?: string;
}): void;
export declare function isTerminalStatus(status: JobStatus): boolean;
export declare function isClaimableStatus(status: JobStatus): boolean;
export declare function transitionJobStatus(from: JobStatus, to: JobStatus, ctx: {
    jobId: string;
    jobType?: string;
    workerId?: string;
}): void;
export declare function transitionJobStatusAdmin(from: JobStatus, to: JobStatus, ctx: {
    jobId: string;
    jobType?: string;
    workerId?: string;
}): void;
