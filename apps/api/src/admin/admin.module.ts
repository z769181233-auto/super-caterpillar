import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ProdGateController } from './prod-gate.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkerModule } from '../worker/worker.module';
import { EngineModule } from '../engines/engine.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { JobModule } from '../job/job.module';

@Module({
  imports: [PrismaModule, WorkerModule, EngineModule, OrchestratorModule, JobModule],
  controllers: [AdminController, ProdGateController],
})
export class AdminModule { }
