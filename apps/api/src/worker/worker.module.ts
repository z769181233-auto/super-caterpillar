import { Module, forwardRef } from '@nestjs/common';
import { WorkerController } from './worker.controller';
import { WorkerMonitorController } from './worker-monitor.controller';
import { WorkerAliasController } from './worker-alias.controller';
import { WorkerService } from './worker.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { JobModule } from '../job/job.module'; // S3-C.3: 导入 JobModule 以使用 JobService
import { ApiSecurityModule } from '../security/api-security/api-security.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    AuthModule,
    forwardRef(() => OrchestratorModule),
    forwardRef(() => JobModule), // S3-C.3: Circular dependency
    ApiSecurityModule, // 提供 ApiSecurityGuard 给 JwtOrHmacGuard
  ],
  controllers: [WorkerController, WorkerMonitorController, WorkerAliasController],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule { }
