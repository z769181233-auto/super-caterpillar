import { PrismaService } from '../prisma/prisma.service';
export declare class AuditLogService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    record(options: {
        userId?: string;
        orgId?: string;
        apiKeyId?: string;
        action: string;
        resourceType: string;
        resourceId?: string;
        ip?: string;
        userAgent?: string;
        details?: any;
        traceId?: string;
        nonce?: string;
        signature?: string;
        timestamp?: Date;
        req?: any;
    }): Promise<void>;
    static extractRequestInfo(request: any): {
        ip?: string;
        userAgent?: string;
    };
}
