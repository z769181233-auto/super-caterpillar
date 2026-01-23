import { Module, forwardRef } from '@nestjs/common';
import { QualityMetricsWriter } from './quality-metrics.writer';
import { QualityScoreService } from './quality-score.service';
import { QualityGateController } from './quality-gate.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JobModule } from '../job/job.module';

import { QualityBackfillSweeper } from './quality-backfill.sweeper';

@Module({
  imports: [PrismaModule, forwardRef(() => JobModule)],
  controllers: [QualityGateController],
  providers: [QualityMetricsWriter, QualityScoreService, QualityBackfillSweeper],
  exports: [QualityMetricsWriter, QualityScoreService, QualityBackfillSweeper],
})
export class QualityModule { }
