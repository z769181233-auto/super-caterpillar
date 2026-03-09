import { StoryService } from './story.service';
import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class StoryController {
    private readonly storyService;
    private readonly prisma;
    private readonly jobService;
    constructor(storyService: StoryService, prisma: PrismaService, jobService: JobService);
    parseStory(body: any, req: any): Promise<{
        success: boolean;
        data: {
            jobId: any;
            status: any;
            taskId: any;
            traceId: string;
        };
    }>;
}
