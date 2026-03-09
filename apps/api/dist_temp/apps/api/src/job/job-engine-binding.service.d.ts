import { PrismaService } from '../prisma/prisma.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { JobType } from 'database';
export declare class JobEngineBindingService {
    private readonly prisma;
    private readonly engineConfigStore;
    private readonly engineRegistry;
    private readonly logger;
    constructor(prisma: PrismaService, engineConfigStore: EngineConfigStoreService, engineRegistry: EngineRegistry);
    selectEngineForJob(jobType: JobType): Promise<{
        engineId: string;
        engineKey: string;
        engineVersionId?: string;
    } | null>;
    bindEngineToJob(jobId: string, engineId: string, engineKey: string, engineVersionId?: string, metadata?: any): Promise<{
        id: string;
        createdAt: Date;
        errorMessage: string | null;
        status: import("database").$Enums.JobEngineBindingStatus;
        updatedAt: Date;
        jobId: string;
        metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        engineKey: string;
        engineId: string;
        engineVersionId: string | null;
        boundAt: Date;
        executedAt: Date | null;
        completedAt: Date | null;
    }>;
    getBindingForJob(jobId: string): Promise<{
        engine: {
            id: string;
            createdAt: Date;
            name: string;
            type: string;
            enabled: boolean;
            version: string | null;
            mode: string;
            updatedAt: Date;
            engineKey: string;
            code: string;
            isActive: boolean;
            adapterName: string;
            adapterType: string;
            config: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
            defaultVersion: string | null;
        };
        engineVersion: {
            id: string;
            createdAt: Date;
            enabled: boolean;
            updatedAt: Date;
            config: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
            engineId: string;
            versionName: string;
            rolloutWeight: number | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        errorMessage: string | null;
        status: import("database").$Enums.JobEngineBindingStatus;
        updatedAt: Date;
        jobId: string;
        metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        engineKey: string;
        engineId: string;
        engineVersionId: string | null;
        boundAt: Date;
        executedAt: Date | null;
        completedAt: Date | null;
    }>;
    markBindingExecuting(jobId: string): Promise<{
        id: string;
        createdAt: Date;
        errorMessage: string | null;
        status: import("database").$Enums.JobEngineBindingStatus;
        updatedAt: Date;
        jobId: string;
        metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        engineKey: string;
        engineId: string;
        engineVersionId: string | null;
        boundAt: Date;
        executedAt: Date | null;
        completedAt: Date | null;
    }>;
    markBindingCompleted(jobId: string): Promise<{
        id: string;
        createdAt: Date;
        errorMessage: string | null;
        status: import("database").$Enums.JobEngineBindingStatus;
        updatedAt: Date;
        jobId: string;
        metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        engineKey: string;
        engineId: string;
        engineVersionId: string | null;
        boundAt: Date;
        executedAt: Date | null;
        completedAt: Date | null;
    }>;
    markBindingFailed(jobId: string, errorMessage: string): Promise<{
        id: string;
        createdAt: Date;
        errorMessage: string | null;
        status: import("database").$Enums.JobEngineBindingStatus;
        updatedAt: Date;
        jobId: string;
        metadata: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        engineKey: string;
        engineId: string;
        engineVersionId: string | null;
        boundAt: Date;
        executedAt: Date | null;
        completedAt: Date | null;
    }>;
}
