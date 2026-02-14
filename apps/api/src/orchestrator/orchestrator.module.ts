import { Module, forwardRef } from '@nestjs/common';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorMonitorController } from './orchestrator-monitor.controller';
import { OrchestratorService } from './orchestrator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkerModule } from '../worker/worker.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { TaskModule } from '../task/task.module';
import { AuthModule } from '../auth/auth.module';
import { JobModule } from '../job/job.module';
import { EngineModule } from '../engines/engine.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { ProjectModule } from '../project/project.module';
import { NovelImportModule } from '../novel-import/novel-import.module';
import { PublishModule } from '../publish/publish.module';

import { Stage1VerificationHook } from './hooks/stage1-verification.hook';
import { ProductionFlowHook } from './hooks/production-flow.hook';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    TaskModule,
    AuthModule,
    forwardRef(() => JobModule),
    EngineModule,
    ApiSecurityModule,
    forwardRef(() => ProjectModule),
    NovelImportModule,
    PublishModule,
  ],
  controllers: [OrchestratorController, OrchestratorMonitorController],
  providers: [OrchestratorService, Stage1VerificationHook, ProductionFlowHook],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
