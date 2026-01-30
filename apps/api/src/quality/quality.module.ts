import { Module, forwardRef } from '@nestjs/common';
import { QualityMetricsWriter } from './quality-metrics.writer';
import { QualityScoreService } from './quality-score.service';
import { QualityGateController } from './quality-gate.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JobModule } from '../job/job.module';

import { QualityBackfillSweeper } from './quality-backfill.sweeper';

import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [PrismaModule, forwardRef(() => JobModule), IdentityModule],
  controllers: [QualityGateController],
  providers: [QualityMetricsWriter, QualityScoreService, QualityBackfillSweeper],
  exports: [QualityMetricsWriter, QualityScoreService, QualityBackfillSweeper],
})
export class QualityModule {}
