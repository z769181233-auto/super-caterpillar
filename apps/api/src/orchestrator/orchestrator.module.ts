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

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => WorkerModule),
    AuditLogModule,
    TaskModule,
    AuthModule,
    JobModule,
    EngineModule, // S3-C.1: 导入 EngineModule 以使用 EngineRegistry
    ApiSecurityModule, // 提供 ApiSecurityGuard 给 JwtOrHmacGuard
  ],
  controllers: [OrchestratorController, OrchestratorMonitorController],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
