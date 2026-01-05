import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { BillingModule } from './billing/billing.module';
import { CopyrightModule } from './copyright/copyright.module';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ObservabilityModule } from './observability/observability.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ProjectModule } from './project/project.module';
import { JobModule } from './job/job.module';
import { JobWorkerModule } from './job/job-worker.module';
import { WorkerModule } from './worker/worker.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { AutofillModule } from './autofill/autofill.module';
import { NovelImportModule } from './novel-import/novel-import.module';
import { EngineModule } from './engines/engine.module';
import { EngineAdminModule } from './engine-admin/engine-admin.module';
import { EngineProfileModule } from './engine-profile/engine-profile.module';
import { EngineHubModule } from './engine-hub/engine-hub.module';
import { Stage4Module } from './stage4/stage4.module';
import { AuditModule } from './audit/audit.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { InternalModule } from './internal/internal.module';
import { ApiSecurityModule } from './security/api-security/api-security.module';
import { StoryModule } from './story/story.module';
import { TextModule } from './text/text.module';
import { QualityModule } from './quality/quality.module';
import { AssetModule } from './asset/asset.module';
import { MemoryModule } from './memory/memory.module';
import { ShotDirectorModule } from './shot-director/shot-director.module';
import { HealthModule } from './health/health.module';
import { OpsModule } from './ops/ops.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { StorageModule } from './storage/storage.module';
import { SeasonsModule } from './seasons/seasons.module';
import { FeatureFlagModule } from './feature-flag/feature-flag.module';
import { env } from '@scu/config';

// P0-4: 内部 Worker 启动开关已收拢至 packages/config/env.ts
const JOB_WORKER_ENABLED = (env as any).enableInternalJobWorker;

@Module({
  imports: [
    FeatureFlagModule, // Stage 11: Feature Flags（全局模块，优先加载）
    BillingModule, // Scaffolding: Billing System
    CopyrightModule, // Scaffolding: Copyright System
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // 禁止 ConfigModule 读文件，统一使用 packages/config（避免 split-brain）
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    ScheduleModule.forRoot(), // P1 修复：启用定时任务模块（用于 Job Watchdog）
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    PrismaModule, // ✅ 必须出现一次，让 @Global 生效
    ObservabilityModule,
    AuthModule,
    UserModule,
    ProjectModule,
    JobModule,
    ...(JOB_WORKER_ENABLED ? [JobWorkerModule] : []),
    WorkerModule,
    OrchestratorModule,
    AutofillModule,
    NovelImportModule,
    EngineModule,
    EngineAdminModule,
    EngineProfileModule, // S4-A: 引擎画像模块
    EngineHubModule,
    Stage4Module,
    AuditModule,
    AuditLogModule, // Stage13: CE Core Layer 审计日志模块
    PipelineModule,
    InternalModule, // 内部接口模块（仅 HMAC，不需要 JWT）
    ApiSecurityModule, // CE10: API 安全模块（@RequireSignature() 装饰器）
    StoryModule, // CE06: Novel Parsing API
    TextModule, // CE03/CE04: Visual Density/Enrichment API
    AssetModule, // CE09: Media Security API
    MemoryModule, // CE07/CE08: Story Memory API
    ShotDirectorModule, // CE05: Director Control API
    QualityModule, // 质量指标写入模块（QualityMetricsWriter）
    HealthModule, // 健康检查端点（/health, /ping, /metrics）
    StorageModule, // Stage 8: Local Storage Module
    SeasonsModule, // 补齐 Seasons API (Smoke Test Fix)
    ...(process.env.NODE_ENV !== 'production' || process.env.ALLOW_OPS_ENDPOINTS ? [OpsModule] : []), // Stage3-A: 运维诊断接口（仅 dev/管理员）
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule { }
