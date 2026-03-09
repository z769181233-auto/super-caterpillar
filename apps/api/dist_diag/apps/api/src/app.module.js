"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const user_module_1 = require("./user/user.module");
const project_module_1 = require("./project/project.module");
const worker_module_1 = require("./worker/worker.module");
const orchestrator_module_1 = require("./orchestrator/orchestrator.module");
const autofill_module_1 = require("./autofill/autofill.module");
const engine_module_1 = require("./engines/engine.module");
const engine_admin_module_1 = require("./engine-admin/engine-admin.module");
const engine_profile_module_1 = require("./engine-profile/engine-profile.module");
const engine_hub_module_1 = require("./engine-hub/engine-hub.module");
const stage4_module_1 = require("./stage4/stage4.module");
const audit_module_1 = require("./audit/audit.module");
const audit_log_module_1 = require("./audit-log/audit-log.module");
const audit_insight_module_1 = require("./audit-insight/audit-insight.module");
const pipeline_module_1 = require("./pipeline/pipeline.module");
const api_security_module_1 = require("./security/api-security/api-security.module");
const timeline_module_1 = require("./timeline/timeline.module");
const story_module_1 = require("./story/story.module");
const text_module_1 = require("./text/text.module");
const quality_module_1 = require("./quality/quality.module");
const asset_module_1 = require("./asset/asset.module");
const memory_module_1 = require("./memory/memory.module");
const shot_director_module_1 = require("./shot-director/shot-director.module");
const ce_pipeline_module_1 = require("./ce-pipeline/ce-pipeline.module");
const health_module_1 = require("./health/health.module");
const ops_module_1 = require("./ops/ops.module");
const admin_module_1 = require("./admin/admin.module");
const audit_interceptor_1 = require("./audit/audit.interceptor");
const throttler_1 = require("@nestjs/throttler");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const storage_module_1 = require("./storage/storage.module");
const cost_module_1 = require("./cost/cost.module");
const v3_module_1 = require("./v3/v3.module");
const identity_module_1 = require("./identity/identity.module");
const character_module_1 = require("./character/character.module");
const script_build_module_1 = require("./script-build/script-build.module");
const config_1 = require("@scu/config");
const api_security_guard_1 = require("./security/api-security/api-security.guard");
const trace_middleware_1 = require("./observability/trace.middleware");
const operational_gate_guard_1 = require("./common/guards/operational-gate.guard");
const bible_alias_controller_1 = require("./bible/bible-alias.controller");
const JOB_WORKER_ENABLED = config_1.env.enableInternalJobWorker;
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(trace_middleware_1.TraceMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: parseInt(process.env.THROTTLER_LIMIT || '1000', 10),
                },
            ]),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            project_module_1.ProjectModule,
            worker_module_1.WorkerModule,
            orchestrator_module_1.OrchestratorModule,
            autofill_module_1.AutofillModule,
            engine_module_1.EngineModule,
            engine_admin_module_1.EngineAdminModule,
            engine_profile_module_1.EngineProfileModule,
            engine_hub_module_1.EngineHubModule,
            stage4_module_1.Stage4Module,
            audit_module_1.AuditModule,
            audit_log_module_1.AuditLogModule,
            audit_insight_module_1.AuditInsightModule,
            pipeline_module_1.PipelineModule,
            api_security_module_1.ApiSecurityModule,
            story_module_1.StoryModule,
            text_module_1.TextModule,
            asset_module_1.AssetModule,
            memory_module_1.MemoryModule,
            shot_director_module_1.ShotDirectorModule,
            ce_pipeline_module_1.CEPipelineModule,
            timeline_module_1.TimelineModule,
            quality_module_1.QualityModule,
            health_module_1.HealthModule,
            storage_module_1.StorageModule,
            cost_module_1.CostModule,
            admin_module_1.AdminModule,
            v3_module_1.V3Module,
            identity_module_1.IdentityModule,
            character_module_1.CharacterModule,
            script_build_module_1.ScriptBuildModule,
            ...(process.env.NODE_ENV !== 'production' || process.env.ALLOW_OPS_ENDPOINTS
                ? [ops_module_1.OpsModule]
                : []),
        ],
        controllers: [
            app_controller_1.AppController,
            bible_alias_controller_1.BibleAliasController,
        ],
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: audit_interceptor_1.AuditInterceptor,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: api_security_guard_1.ApiSecurityGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: operational_gate_guard_1.OperationalGateGuard,
            },
            {
                provide: core_1.APP_FILTER,
                useClass: all_exceptions_filter_1.AllExceptionsFilter,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map