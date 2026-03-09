import { JobStatus } from 'database';
export declare class ReportJobDto {
    status: JobStatus;
    result?: any;
    errorMessage?: string;
    metrics?: any;
    attempts?: number;
    context?: any;
}
