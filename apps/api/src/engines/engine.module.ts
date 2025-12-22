/**
 * EngineModule
 * 引擎模块，负责注册和管理所有 EngineAdapter
 * 
 * 参考《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3 章
 * 参考《毛毛虫宇宙_模型宇宙说明书_ModelUniverseSpec_V1.0》中与引擎注册相关的部分
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { EngineRegistry } from '../engine/engine-registry.service';
import { NovelAnalysisLocalAdapter } from './adapters/novel-analysis.local.adapter';
import { HttpEngineAdapter } from '../engine/adapters/http-engine.adapter';
import { EngineConfigService } from '../config/engine.config';
import { PrismaModule } from '../prisma/prisma.module';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { EngineRoutingService } from '../engine/engine-routing.service';
import { EngineStrategyService } from '../engine/engine-strategy.service';
import { EngineInvokerService } from './engine-invoker.service';
import { EngineController } from '../engine/engine.controller';
import { EngineAdminModule } from '../engine-admin/engine-admin.module';

@Module({
  imports: [PrismaModule, EngineAdminModule], // S3-C.1: 导入 EngineAdminModule 以使用 EngineAdminService
  controllers: [EngineController], // S3-C.1: 注册公开的引擎控制器
  providers: [
    EngineRegistry,
    EngineConfigService,
    EngineConfigStoreService,
    EngineRoutingService,
    EngineStrategyService, // S4-B: 策略路由层
    EngineInvokerService,
    NovelAnalysisLocalAdapter,
    HttpEngineAdapter,
  ],
  exports: [
    EngineRegistry,
    EngineConfigStoreService,
    EngineStrategyService,
    EngineConfigService,
    HttpEngineAdapter,
  ], // S4-B: 导出策略服务 + HTTP 适配器与配置服务
})
export class EngineModule implements OnModuleInit {
  constructor(
    private readonly registry: EngineRegistry,
    private readonly novelAdapter: NovelAnalysisLocalAdapter,
    private readonly httpAdapter: HttpEngineAdapter,
  ) { }

  onModuleInit() {
    if (!this.registry) {
      console.warn('[EngineModule] EngineRegistry is undefined during onModuleInit, skipping early registration. Dependants will need to register manually or via ModuleRef.');
      return;
    }
    // 注册默认的 NovelAnalysisLocalAdapter
    this.registry.register(this.novelAdapter);

    // 注册 HttpEngineAdapter（支持 mock_http_engine 和通用 http 引擎）
    this.registry.register(this.httpAdapter);
  }
}

