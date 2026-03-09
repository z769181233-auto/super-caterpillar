import { TextService } from './text.service';
import { VisualDensityDto } from './dto/visual-density.dto';
import { VisualEnrichDto } from './dto/visual-enrich.dto';
import { Request } from 'express';
export declare class TextController {
    private readonly textService;
    constructor(textService: TextService);
    visualDensity(dto: VisualDensityDto, user: any, org: any, req: Request): Promise<{
        jobId: any;
        traceId: string;
        status: any;
        taskId: string;
    }>;
    visualEnrich(dto: VisualEnrichDto, user: any, org: any, req: Request): Promise<{
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
}
