import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetReceiptResolverService } from './asset-receipt-resolver.service';
export declare class ContractShotController {
    private readonly jobService;
    private readonly prisma;
    private readonly assetResolver;
    private readonly logger;
    constructor(jobService: JobService, prisma: PrismaService, assetResolver: AssetReceiptResolverService);
    batchGenerate(body: {
        scene_id: string;
        organization_id?: string;
        project_id?: string;
    }): Promise<{
        job_id: any;
        status: string;
        trace_id: any;
    }>;
    renderShot(id: string): Promise<{
        id: string;
        render_status: string;
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
