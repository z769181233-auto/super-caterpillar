import { QualityScoreRecord } from '@scu/shared-types';
import { EngineAdapter } from '@scu/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { IdentityConsistencyService } from '../identity/identity-consistency.service';
import { ProjectResolver } from '../common/project-resolver';
export declare class QualityScoreService {
    private readonly prisma;
    private readonly jobService;
    private readonly identityService;
    private readonly projectResolver;
    private readonly logger;
    constructor(prisma: PrismaService, jobService: JobService, identityService: IdentityConsistencyService, projectResolver: ProjectResolver);
    performScoring(shotId: string, traceId: string, attempt?: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        shotId: string;
        visualDensityScore: number | null;
        consistencyScore: number | null;
        motionScore: number | null;
        clarityScore: number | null;
        aestheticScore: number | null;
        overallScore: number;
        attempt: number;
        verdict: string;
        signals: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue | null;
        reworkJobId: string | null;
    }>;
    private handleAutoRework;
    buildQualityScoreFromJob(job: any, adapter: EngineAdapter | null, taskId: string): QualityScoreRecord | null;
    private extractEngineKey;
    private extractMetrics;
    private extractQuality;
    private extractModelInfo;
}
