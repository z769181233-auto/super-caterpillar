import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { AuthenticatedUser } from '@scu/shared-types';
export declare class JobGenericController {
    private readonly jobService;
    constructor(jobService: JobService);
    createGenericJob(createJobDto: CreateJobDto, user: AuthenticatedUser, organizationId: string, req: any): Promise<any>;
}
