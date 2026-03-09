export declare class RetryJobDto {
    resetAttempts?: boolean;
}
export declare class ForceFailJobDto {
    message?: string;
}
export declare class BatchRetryJobsDto {
    jobIds: string[];
}
export declare class BatchCancelJobsDto {
    jobIds: string[];
}
export declare class BatchForceFailJobsDto {
    jobIds: string[];
    note?: string;
}
export declare class BatchJobOperationDto {
    jobIds: string[];
    note?: string;
}
