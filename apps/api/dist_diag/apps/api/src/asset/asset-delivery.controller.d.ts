import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '@scu/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class AssetDeliveryController {
    private readonly prisma;
    private readonly auditLogService;
    private readonly logger;
    constructor(prisma: PrismaService, auditLogService: AuditLogService);
    getSecureUrl(assetId: string, user: AuthenticatedUser, organizationId: string): Promise<{
        success: boolean;
        data: {
            signed_url: string;
            signedUrl: string;
            url: string;
            expiresAt: string;
            expire: number;
        };
    }>;
    getHls(assetId: string, user: AuthenticatedUser, organizationId: string): Promise<{
        success: boolean;
        data: {
            playlistUrl: string;
            watermarkMode: string | null;
            fingerprintId: string | null;
        };
    }>;
}
