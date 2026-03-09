import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class MemoryService {
    private readonly prisma;
    private readonly auditLogService;
    private readonly logger;
    constructor(prisma: PrismaService, auditLogService: AuditLogService);
    getShortTermMemory(chapterId: string, userId?: string): Promise<{
        success: boolean;
        data: {
            chapterId: string;
            summary: string | null;
            characterStates: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        };
    }>;
    getLongTermMemory(entityId: string, userId?: string): Promise<{
        success: boolean;
        data: {
            entityId: string;
            entityType: null;
            vectorRef: null;
            metadata: null;
        };
    } | {
        success: boolean;
        data: {
            entityId: string;
            entityType: string;
            vectorRef: string | null;
            metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        };
    }>;
    updateMemory(body: {
        type: 'short-term' | 'long-term';
        chapterId?: string;
        entityId?: string;
        data: any;
    }, userId?: string): Promise<{
        success: boolean;
        data: {
            chapterId: string;
            status: string;
            entityId?: undefined;
        };
    } | {
        success: boolean;
        data: {
            entityId: string;
            status: string;
            chapterId?: undefined;
        };
    }>;
}
