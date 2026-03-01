/**
 * Engine Hub Module
 * Stage2: Engine Hub 统一模块，导出 EngineRegistry 和 EngineInvoker
 */

import { Module, forwardRef } from '@nestjs/common';
import { EngineRegistryHubService } from './engine-registry-hub.service';
import { EngineInvokerHubService } from './engine-invoker-hub.service';
import { EngineHubController } from './engine-hub.controller';
import { EngineModule } from '../engines/engine.module'; // 注意路径可能需要校准，根据 view_file 结果
import { HttpEngineAdapter } from '../engine/adapters/http-engine.adapter';
import { EngineRegistry } from '../engine/engine-registry.service';
import { SemanticEnhancementLocalAdapter } from './adapters/semantic-enhancement.local-adapter';
import { ShotPlanningLocalAdapter } from './adapters/shot-planning.local-adapter';
import { StructureQALocalAdapter } from './adapters/structure-qa.local-adapter';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { HmacAuthModule } from '../auth/hmac/hmac-auth.module';

import { CostModule } from '../cost/cost.module';

@Module({
  imports: [forwardRef(() => EngineModule), AuditLogModule, AuthModule, HmacAuthModule, CostModule], // 修复双向 DI 循环
  controllers: [EngineHubController],
  providers: [
    EngineRegistryHubService,
    EngineInvokerHubService,
    SemanticEnhancementLocalAdapter,
    ShotPlanningLocalAdapter,
    StructureQALocalAdapter,
    HttpEngineAdapter,
  ],
  exports: [EngineRegistryHubService, EngineInvokerHubService],
})
export class EngineHubModule {}
