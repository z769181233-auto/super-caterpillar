import { QualityScoreService } from './quality-score.service';
import { QualityBackfillSweeper } from './quality-backfill.sweeper';
export declare class QualityGateController {
    private readonly qualityScoreService;
    private readonly qualitySweeper;
    private readonly logger;
    constructor(qualityScoreService: QualityScoreService, qualitySweeper: QualityBackfillSweeper);
    triggerScoring(body: {
        shotId: string;
        traceId: string;
        attempt?: number;
    }): Promise<{
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
    triggerSweep(): Promise<{
        status: string;
    }>;
}
