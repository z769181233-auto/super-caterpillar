/**
 * Engine Hub Module
 * Stage2: Engine Hub 统一模块，导出 EngineRegistry 和 EngineInvoker
 */

import { Module } from '@nestjs/common';
import { EngineRegistryHubService } from './engine-registry-hub.service';
import { EngineInvokerHubService } from './engine-invoker-hub.service';
import { EngineHubController } from './engine-hub.controller';
import { EngineModule } from '../engines/engine.module';
import { SemanticEnhancementLocalAdapter } from './adapters/semantic-enhancement.local-adapter';
import { ShotPlanningLocalAdapter } from './adapters/shot-planning.local-adapter';
import { StructureQALocalAdapter } from './adapters/structure-qa.local-adapter';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { HmacAuthModule } from '../auth/hmac/hmac-auth.module';

@Module({
  imports: [EngineModule, AuditLogModule, AuthModule, HmacAuthModule], // 导入相关模块以支持认证 Guard
  controllers: [EngineHubController],
  providers: [
    EngineRegistryHubService,
    EngineInvokerHubService,
    SemanticEnhancementLocalAdapter,
    ShotPlanningLocalAdapter,
    StructureQALocalAdapter,
  ],
  exports: [EngineRegistryHubService, EngineInvokerHubService],
})
export class EngineHubModule { }
