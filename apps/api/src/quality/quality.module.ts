import { Module, forwardRef } from '@nestjs/common';
import { QualityMetricsWriter } from './quality-metrics.writer';
import { QualityScoreService } from './quality-score.service';
import { QualityGateController } from './quality-gate.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JobModule } from '../job/job.module';

import { QualityBackfillSweeper } from './quality-backfill.sweeper';

import { ProjectModule } from '../project/project.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [PrismaModule, forwardRef(() => JobModule), forwardRef(() => IdentityModule), forwardRef(() => ProjectModule)],
  controllers: [QualityGateController],
  providers: [QualityMetricsWriter, QualityScoreService, QualityBackfillSweeper],
  exports: [QualityMetricsWriter, QualityScoreService, QualityBackfillSweeper],
})
export class QualityModule { }
