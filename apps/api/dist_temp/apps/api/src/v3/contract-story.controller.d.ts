import { StoryService } from '../story/story.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetReceiptResolverService } from './asset-receipt-resolver.service';
export declare class ContractStoryController {
    private readonly storyService;
    private readonly prisma;
    private readonly assetResolver;
    private readonly logger;
    constructor(storyService: StoryService, prisma: PrismaService, assetResolver: AssetReceiptResolverService);
    parseStory(body: {
        project_id: string;
        raw_text?: string;
        title?: string;
        author?: string;
        organization_id?: string;
        trace_id?: string;
        traceId?: string;
        is_verification?: boolean;
    }): Promise<{
        job_id: any;
        status: string;
        note: string;
        trace_id: string;
    }>;
    getJob(jobId: string): Promise<{
        id: string;
        status: string;
        progress: number;
        current_step: string;
        result_preview: {
            scenes_count: number;
            shots_count: number;
            cost_ledger_count: number;
            asset_id: string | null;
            hls_url: string | null;
            mp4_url: string | null;
            checksum: string | null;
            storage_key: string | null;
            duration_sec: number | null;
            fallback_reason: string | null;
            error_code?: string;
        };
        error: {
            code: string;
            message: string | null;
        } | null;
        created_at: Date;
        updated_at: Date;
    }>;
}
