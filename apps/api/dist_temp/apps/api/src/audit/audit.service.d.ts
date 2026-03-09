import { PrismaService } from '../prisma/prisma.service';
interface AuditLogInput {
    userId?: string | null;
    organizationId?: string | null;
    apiKeyId?: string | null;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    traceId?: string;
    ip?: string | null;
    userAgent?: string | null;
    ua?: string | null;
    details?: any;
}
export declare class AuditService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    log(input: AuditLogInput): Promise<void>;
}
export {};
