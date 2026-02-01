/**
 * EngineModule
 * 引擎模块，负责注册和管理所有 EngineAdapter
 *
 * 参考《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3 章
 * 参考《毛毛虫宇宙_模型宇宙说明书_ModelUniverseSpec_V1.0》中与引擎注册相关的部分
 */

import { Module, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EngineRegistry } from '../engine/engine-registry.service';
import { NovelAnalysisLocalAdapter } from './adapters/novel-analysis.local.adapter.NEW';
import { CE06LocalAdapter } from './adapters/ce06.local.adapter';
import { CE03LocalAdapter } from './adapters/ce03.local.adapter';
import { CE04LocalAdapter } from './adapters/ce04.local.adapter';
import { VideoMergeLocalAdapter } from './adapters/video-merge.local.adapter';
import { ShotRenderLocalAdapter } from './adapters/shot-render.local.adapter';
import { ShotRenderReplicateAdapter } from './adapters/shot-render.replicate.adapter';
import { ShotRenderComfyuiAdapter } from './adapters/shot-render.comfyui.adapter';
import { ShotRenderRouterAdapter } from './adapters/shot-render.router.adapter';
import { HttpEngineAdapter } from '../engine/adapters/http-engine.adapter';
import { CE11MockAdapter } from './adapters/ce11.mock.adapter';
import { MockEngineAdapter } from '../engine/adapters/mock-engine.adapter';
import { CE11ComfyUIAdapter } from '../engine/adapters/ce11.comfyui.adapter';
import { TranslationCloudAdapter } from './adapters/translation.cloud.adapter';
import { StyleTransferReplicateAdapter } from './adapters/style-transfer.replicate.adapter';
import { EngineConfigService } from '../config/engine.config';
import { PrismaModule } from '../prisma/prisma.module';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { EngineRoutingService } from '../engine/engine-routing.service';
import { EngineStrategyService } from '../engine/engine-strategy.service';
import { EngineInvokerService } from './engine-invoker.service';
import { EngineController } from '../engine/engine.controller';
import { EngineAdminModule } from '../engine-admin/engine-admin.module';
import { G5DialogueBindingAdapter } from './adapters/g5-dialogue-binding.adapter';
import { G5SemanticMotionMapperAdapter } from './adapters/g5-semantic-motion-mapper.adapter';
import { G5AssetLayeringResolverAdapter } from './adapters/g5-asset-layering-resolver.adapter';
import { G5SubengineHubService } from './g5-subengine-hub.service';
import { EngineHubModule } from '../engine-hub/engine-hub.module';

@Module({
  imports: [PrismaModule, EngineAdminModule, forwardRef(() => EngineHubModule)], // 修复 DI 缺失
  controllers: [EngineController], // S3-C.1: 注册公开的引擎控制器
  providers: [
    EngineRegistry,
    EngineConfigService,
    EngineConfigStoreService,
    EngineRoutingService,
    EngineStrategyService, // S4-B: 策略路由层
    EngineInvokerService,
    NovelAnalysisLocalAdapter,
    CE06LocalAdapter,
    CE03LocalAdapter,
    CE04LocalAdapter,
    VideoMergeLocalAdapter,
    ShotRenderLocalAdapter,
    ShotRenderReplicateAdapter,
    ShotRenderComfyuiAdapter, // Registered
    ShotRenderRouterAdapter,
    HttpEngineAdapter,
    CE11MockAdapter,
    MockEngineAdapter,
    CE11ComfyUIAdapter,
    G5DialogueBindingAdapter, // G5-P0-1: Dialogue Binding Engine
    G5SemanticMotionMapperAdapter, // G5-P0-2: Semantic Motion Mapper
    G5AssetLayeringResolverAdapter, // G5-P0-3: Asset Layering Resolver
    G5SubengineHubService, // G5 Orchestrator
    TranslationCloudAdapter,
    StyleTransferReplicateAdapter,
  ],
  exports: [
    EngineRegistry,
    EngineConfigStoreService,
    EngineStrategyService,
    EngineConfigService,
    HttpEngineAdapter,
    ShotRenderRouterAdapter,
    G5SubengineHubService,
  ], // S4-B: 导出策略服务 + HTTP 适配器与配置服务
})
export class EngineModule implements OnModuleInit {
  private readonly logger = new Logger(EngineModule.name);
  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(EngineRegistry)
    private registry: EngineRegistry,
    @Inject(NovelAnalysisLocalAdapter)
    private readonly novelAdapter: NovelAnalysisLocalAdapter,
    @Inject(CE06LocalAdapter)
    private readonly ce06Adapter: CE06LocalAdapter,
    @Inject(CE03LocalAdapter)
    private readonly ce03Adapter: CE03LocalAdapter,
    @Inject(CE04LocalAdapter)
    private readonly ce04Adapter: CE04LocalAdapter,
    @Inject(VideoMergeLocalAdapter)
    private readonly videoMergeAdapter: VideoMergeLocalAdapter,
    @Inject(ShotRenderLocalAdapter)
    private readonly shotRenderAdapter: ShotRenderLocalAdapter,
    @Inject(ShotRenderReplicateAdapter)
    private readonly shotRenderReplicateAdapter: ShotRenderReplicateAdapter,
    @Inject(ShotRenderComfyuiAdapter)
    private readonly shotRenderComfyuiAdapter: ShotRenderComfyuiAdapter, // Injected
    @Inject(ShotRenderRouterAdapter)
    private readonly shotRenderRouterAdapter: ShotRenderRouterAdapter,
    @Inject(HttpEngineAdapter)
    private readonly httpAdapter: HttpEngineAdapter,
    @Inject(CE11MockAdapter)
    private readonly ce11MockAdapter: CE11MockAdapter,
    @Inject(MockEngineAdapter)
    private readonly mockEngineAdapter: MockEngineAdapter,
    @Inject(CE11ComfyUIAdapter)
    private readonly ce11ComfyUIAdapter: CE11ComfyUIAdapter,
    @Inject(G5DialogueBindingAdapter)
    private readonly g5DialogueBindingAdapter: G5DialogueBindingAdapter,
    @Inject(G5SemanticMotionMapperAdapter)
    private readonly g5SemanticMotionMapperAdapter: G5SemanticMotionMapperAdapter,
    @Inject(G5AssetLayeringResolverAdapter)
    private readonly g5AssetLayeringResolverAdapter: G5AssetLayeringResolverAdapter,
    @Inject(TranslationCloudAdapter)
    private readonly translationCloudAdapter: TranslationCloudAdapter,
    @Inject(StyleTransferReplicateAdapter)
    private readonly styleTransferReplicateAdapter: StyleTransferReplicateAdapter
  ) { }

  onModuleInit() {
    if (!this.registry) {
      this.logger.warn(
        '[EngineModule] EngineRegistry is undefined during onModuleInit, attempting to resolve via ModuleRef...'
      );
      try {
        this.registry = this.moduleRef.get(EngineRegistry, { strict: false });
      } catch (e) {
        this.logger.error(
          '[EngineModule] Failed to resolve EngineRegistry via ModuleRef. Adapters will NOT be registered!'
        );
        return;
      }
    }
    // 注册默认的 NovelAnalysisLocalAdapter
    this.registry.register(this.novelAdapter);

    // 注册 HttpEngineAdapter
    this.registry.register(this.httpAdapter);

    // [P1-B Fix] Register Aliases for CE components
    this.registry.register(this.ce06Adapter);
    this.registry.register(this.ce03Adapter);
    this.registry.register(this.ce04Adapter);

    this.registry.registerAlias('ce06_novel_parsing', this.ce06Adapter);
    this.registry.registerAlias('ce03_visual_density', this.ce03Adapter);
    this.registry.registerAlias('ce04_visual_enrichment', this.ce04Adapter);

    // Shot Render Registration
    // Phase 0-R: Use Router as primary entry for shot_render
    this.registry.register(this.shotRenderRouterAdapter);
    this.registry.registerAlias('shot_render', this.shotRenderRouterAdapter);
    this.registry.registerAlias('real_shot_render', this.shotRenderRouterAdapter);
    this.registry.registerAlias('default_shot_render', this.shotRenderRouterAdapter);

    // Keep individual adapters registered but not as primary alias
    this.registry.register(this.shotRenderReplicateAdapter);
    this.registry.register(this.shotRenderComfyuiAdapter); // Registered
    this.registry.register(this.shotRenderAdapter);

    // P0-R2: Register Video Merge Adapter
    this.registry.register(this.videoMergeAdapter);

    this.registry.register(this.ce11MockAdapter);
    this.registry.registerAlias('ce11_shot_generator_mock', this.ce11MockAdapter);

    // CE11 Real Registration
    this.registry.register(this.ce11ComfyUIAdapter);

    // G5-P0-1: Dialogue Binding Engine
    this.registry.register(this.g5DialogueBindingAdapter);

    // G5-P0-2: Semantic Motion Mapper
    this.registry.register(this.g5SemanticMotionMapperAdapter);

    // G5-P0-3: Asset Layering Resolver
    this.registry.register(this.g5AssetLayeringResolverAdapter);

    // P1: Translation Engine
    this.registry.register(this.translationCloudAdapter);

    // P1: Style Transfer Engine
    this.registry.register(this.styleTransferReplicateAdapter);
  }
}
