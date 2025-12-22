import { Module } from '@nestjs/common';
import { QualityMetricsWriter } from './quality-metrics.writer';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [QualityMetricsWriter],
  exports: [QualityMetricsWriter],
})
export class QualityModule {}

