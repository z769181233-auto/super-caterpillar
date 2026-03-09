import { PrismaService } from '../prisma/prisma.service';
export interface V3AssetReceipt {
    asset_id: string | null;
    hls_url: string | null;
    mp4_url: string | null;
    checksum: string | null;
    storage_key: string | null;
    duration_sec: number | null;
    fallback_reason: string | null;
    error_code?: string;
}
export declare class AssetReceiptResolverService {
    private prisma;
    constructor(prisma: PrismaService);
    resolveAsset(params: {
        projectId: string;
        traceId: string;
        jobId: string;
        jobCreatedAt: Date;
    }): Promise<V3AssetReceipt>;
    private mapAssetToReceipt;
}
