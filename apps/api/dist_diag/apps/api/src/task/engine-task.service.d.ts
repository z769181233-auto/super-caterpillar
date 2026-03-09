import { PrismaService } from '../prisma/prisma.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineTaskSummary } from '@scu/shared-types';
export declare class EngineTaskService {
    private readonly prisma;
    private readonly engineRegistry;
    private readonly logger;
    constructor(prisma: PrismaService, engineRegistry: EngineRegistry);
    findEngineTaskByTaskId(taskId: string): Promise<EngineTaskSummary | null>;
    findEngineTasksByProject(projectId: string, taskType?: string): Promise<EngineTaskSummary[]>;
    private extractEngineKey;
    private getDefaultEngineKeyForTaskType;
    private extractAdapterName;
    private mapJobToSummary;
}
