import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AuthModule } from '../auth/auth.module';
import { ObservabilityController } from './observability.controller';
import { MetricsController } from './metrics.controller';
import { ObservabilityService } from './observability.service';

@Module({
  imports: [TerminusModule, AuthModule],
  controllers: [ObservabilityController, MetricsController],
  providers: [ObservabilityService],
})
export class ObservabilityModule {}
