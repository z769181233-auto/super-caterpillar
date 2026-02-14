import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ProdGateController } from './prod-gate.controller';
import { MonitoringController, PublicMetricsController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkerModule } from '../worker/worker.module';
import { EngineModule } from '../engines/engine.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { JobModule } from '../job/job.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, WorkerModule, EngineModule, OrchestratorModule, JobModule, AuthModule],
  controllers: [AdminController, ProdGateController, MonitoringController, PublicMetricsController],
  providers: [MonitoringService],
})
export class AdminModule {}
