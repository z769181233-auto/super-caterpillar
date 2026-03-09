import { StoryService } from '../story/story.service';
import { TextService } from '../text/text.service';
type TextEnrichDto = {
    text: string;
    projectId: string;
};
export declare class BibleAliasController {
    private readonly storyService;
    private readonly textService;
    constructor(storyService: StoryService, textService: TextService);
    internalStoryParse(body: any, req: any): Promise<{
        success: boolean;
        data: {
            jobId: any;
            status: any;
            taskId: any;
            traceId: string;
        };
    }>;
    storyParse(body: any, req: any): Promise<{
        success: boolean;
        data: {
            jobId: any;
            status: any;
            taskId: any;
            traceId: string;
        };
    }>;
    private handleStoryParse;
    internalTextEnrich(body: TextEnrichDto, req: any): Promise<{
        jobId: any;
        traceId: string;
        status: string;
        taskId: string;
        reason: string;
        safetyFlags: string[];
    } | {
        jobId: any;
        traceId: string;
        status: any;
        taskId: string;
        reason?: undefined;
        safetyFlags?: undefined;
    }>;
    textEnrich(body: TextEnrichDto, req: any): Promise<{
        jobId: any;
        traceId: string;
        status: string;
        taskId: string;
        reason: string;
        safetyFlags: string[];
    } | {
        jobId: any;
        traceId: string;
        status: any;
        taskId: string;
        reason?: undefined;
        safetyFlags?: undefined;
    }>;
    private handleTextEnrich;
}
export {};
