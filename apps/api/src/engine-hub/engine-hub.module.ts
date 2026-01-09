/**
 * Engine Hub Module
 * Stage2: Engine Hub 统一模块，导出 EngineRegistry 和 EngineInvoker
 */

import { Module } from '@nestjs/common';
import { EngineRegistryHubService } from './engine-registry-hub.service';
import { EngineInvokerHubService } from './engine-invoker-hub.service';
import { EngineModule } from '../engines/engine.module';
import { SemanticEnhancementLocalAdapter } from './adapters/semantic-enhancement.local-adapter';
import { ShotPlanningLocalAdapter } from './adapters/shot-planning.local-adapter';
import { StructureQALocalAdapter } from './adapters/structure-qa.local-adapter';

@Module({
  imports: [EngineModule], // 导入 EngineModule 以使用 HttpEngineAdapter / EngineConfigService
  providers: [
    EngineRegistryHubService,
    EngineInvokerHubService,
    SemanticEnhancementLocalAdapter,
    ShotPlanningLocalAdapter,
    StructureQALocalAdapter,
  ],
  exports: [EngineRegistryHubService, EngineInvokerHubService],
})
export class EngineHubModule {}
