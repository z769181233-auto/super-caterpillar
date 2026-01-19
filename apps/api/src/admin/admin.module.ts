import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ProdGateController } from './prod-gate.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkerModule } from '../worker/worker.module';
import { EngineModule } from '../engines/engine.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [PrismaModule, WorkerModule, EngineModule, OrchestratorModule],
  controllers: [AdminController, ProdGateController],
})
export class AdminModule {}
