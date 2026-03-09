import { CEEngineService } from './ce-engine.service';
import { ParseStoryDto } from './dto/parse-story.dto';
import { VisualDensityDto } from './dto/visual-density.dto';
import { EnrichTextDto } from './dto/enrich-text.dto';
import { Request } from 'express';
export declare class CEEngineController {
    private readonly ceEngineService;
    private readonly logger;
    constructor(ceEngineService: CEEngineService);
    parseStory(dto: ParseStoryDto, userId: string, organizationId: string, req: Request): Promise<{
        jobId: string;
        traceId: string;
        status: string;
    }>;
    analyzeVisualDensity(dto: VisualDensityDto, userId: string, organizationId: string, req: Request): Promise<{
        jobId: string;
        traceId: string;
        status: string;
    }>;
    enrichText(dto: EnrichTextDto, userId: string, organizationId: string, req: Request): Promise<{
        jobId: string;
        traceId: string;
        status: string;
    }>;
}
