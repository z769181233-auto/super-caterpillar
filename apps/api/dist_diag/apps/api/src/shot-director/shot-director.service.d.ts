import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class ShotDirectorService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly logger;
    constructor(prisma: PrismaService, auditLogService: AuditLogService);
    inpaint(shotId: string, userId?: string): Promise<{
        success: boolean;
        data: {
            shotId: string;
            jobId: string;
            status: string;
        };
    }>;
    pose(shotId: string, userId?: string): Promise<{
        success: boolean;
        data: {
            shotId: string;
            jobId: string;
            status: string;
        };
    }>;
    composeVideo(sceneId: string, userId?: string, organizationId?: string): Promise<{
        success: boolean;
        data: {
            jobId: string;
            status: string;
            assetsCount: number;
        };
    }>;
}
