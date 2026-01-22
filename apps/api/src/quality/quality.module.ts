import { Module } from '@nestjs/common';
import { QualityMetricsWriter } from './quality-metrics.writer';
import { QualityScoreService } from './quality-score.service';
import { QualityGateController } from './quality-gate.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [QualityGateController],
  providers: [QualityMetricsWriter, QualityScoreService],
  exports: [QualityMetricsWriter, QualityScoreService],
})
export class QualityModule {}
