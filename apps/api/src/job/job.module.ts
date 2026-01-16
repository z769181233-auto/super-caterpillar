import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JobController } from './job.controller';
import { JobGenericController } from './job-generic.controller';
import { JobService } from './job.service';
import { JobWorkerService } from './job-worker.service';
import { JobReportFacade } from './job-report.facade';
import { JobEngineBindingService } from './job-engine-binding.service';
import { PrismaModule } from '../prisma/prisma.module';

import { ProjectModule } from '../project/project.module';
import { PublishModule } from '../publish/publish.module';
import { PermissionModule } from '../permission/permission.module';
import { TaskModule } from '../task/task.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EngineHubModule } from '../engine-hub/engine-hub.module';
import { EngineModule } from '../engines/engine.module';
import { QualityModule } from '../quality/quality.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { BillingModule } from '../billing/billing.module';
import { CopyrightModule } from '../copyright/copyright.module';
import { CapacityGateModule } from '../capacity/capacity-gate.module';
import { JobWatchdogService } from './job-watchdog.service';
import { TextSafetyModule } from '../text-safety/text-safety.module';
import { ShotDirectorModule } from '../shot-director/shot-director.module';
import { CostModule } from '../cost/cost.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { env } from '@scu/config';

// P1 修复：统一使用 packages/config，避免 split-brain
const JOB_WORKER_ENABLED = (env as any).enableInternalJobWorker;

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => ProjectModule), // ProjectModule 包含 SceneGraphService
    PermissionModule,
    TaskModule, // 导入 TaskModule 以使用 QualityScoreService
    AuthModule,
    AuditLogModule,
    EngineHubModule, // 导入 EngineHubModule，使用统一的枢纽化引擎注册
    EngineModule, // 导入 EngineModule 以使用 EngineRegistry
    QualityModule, // 质量指标写入模块
    ApiSecurityModule, // 提供 ApiSecurityGuard 给 JwtOrHmacGuard
    BillingModule, // Full Implementation: 计费集成
    CopyrightModule, // Full Implementation: 版权集成
    CapacityGateModule, // 容量门禁模块
    TextSafetyModule,
    ShotDirectorModule, // P0-3: 提供 DirectorConstraintSolverService
    CostModule,
    PublishModule,
    forwardRef(() => OrchestratorModule), // Stage 3: Event-Driven DAG
  ],
  controllers: [JobController],
  providers: [
    JobService,
    // JobWorkerService removed to avoid dual instantiation (handled by JobWorkerModule)

    JobReportFacade, // Facade 层
    JobEngineBindingService, // Stage3-A: Job-Engine 绑定服务
    JobWatchdogService, // P1 修复：僵尸任务自愈服务
  ],
  exports: [JobService, JobReportFacade],
})
export class JobModule { }

// 注意：JobController 中需要注入 AuditLogService，但 AuditLogModule 已经导入，应该可以正常工作
