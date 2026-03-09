import { JobService } from '../job/job.service';
export declare class TimelineController {
    private readonly jobService;
    constructor(jobService: JobService);
    createPreview(body: any, req: any): Promise<{
        success: boolean;
        jobId: string;
    }>;
}
