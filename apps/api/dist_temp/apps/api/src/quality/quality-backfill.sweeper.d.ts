import { PrismaService } from '../prisma/prisma.service';
import { QualityScoreService } from './quality-score.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
export declare class QualityBackfillSweeper {
    private readonly prisma;
    private readonly qualityScoreService;
    private readonly featureFlagService;
    private readonly logger;
    constructor(prisma: PrismaService, qualityScoreService: QualityScoreService, featureFlagService: FeatureFlagService);
    backfillQualityScores(): Promise<void>;
}
