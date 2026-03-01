import { Module, forwardRef } from '@nestjs/common';
import { WorkerController } from './worker.controller';
import { WorkerMonitorController } from './worker-monitor.controller';
import { WorkerService } from './worker.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { JobModule } from '../job/job.module'; // S3-C.3: 导入 JobModule 以使用 JobService
import { ApiSecurityModule } from '../security/api-security/api-security.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    AuthModule,
    JobModule,
    ApiSecurityModule, // 提供 ApiSecurityGuard 给 JwtOrHmacGuard
  ],
  controllers: [WorkerController, WorkerMonitorController],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
