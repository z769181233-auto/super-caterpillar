import { MemoryService } from './memory.service';
export declare class MemoryController {
    private readonly memoryService;
    constructor(memoryService: MemoryService);
    getShortTermMemory(chapterId: string, user: any): Promise<{
        success: boolean;
        data: {
            chapterId: string;
            summary: string | null;
            characterStates: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        };
    }>;
    getLongTermMemory(entityId: string, user: any): Promise<{
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
    }, user: any): Promise<{
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
