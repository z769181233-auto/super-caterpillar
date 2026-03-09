import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { EngineRegistryHubService } from '../engine-hub/engine-registry-hub.service';
import type { EngineProfileQuery, EngineProfileResponse } from '@scu/shared-types';
export declare class EngineProfileService {
    private readonly prisma;
    private readonly jobService;
    private readonly engineRegistryHub;
    constructor(prisma: PrismaService, jobService: JobService, engineRegistryHub: EngineRegistryHubService);
    getProfileSummary(query: EngineProfileQuery): Promise<EngineProfileResponse>;
}
