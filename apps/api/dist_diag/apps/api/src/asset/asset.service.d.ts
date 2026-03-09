import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class AssetService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly logger;
    constructor(prisma: PrismaService, auditLogService: AuditLogService);
    getSecureUrl(assetId: string, userId?: string): Promise<{
        success: boolean;
        data: {
            assetId: string;
            secureUrl: string;
            expiresAt: string;
        };
    }>;
    getHls(assetId: string, userId?: string): Promise<{
        success: boolean;
        data: {
            assetId: string;
            secureUrl: string;
            expiresAt: string;
        };
    }>;
    assertAssetAccessible(userId: string, assetId: string): Promise<boolean>;
    addWatermark(assetId: string, userId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
