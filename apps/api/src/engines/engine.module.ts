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
import { ShotRenderMpsAdapter } from './adapters/shot-render.mps.adapter';
import { ShotRenderRouterAdapter } from './adapters/shot-render.router.adapter';
import { HttpEngineAdapter } from '../engine/adapters/http-engine.adapter';
import { MockEngineAdapter } from '../engine/adapters/mock-engine.adapter';
import { CE11ComfyUIAdapter } from '../engine/adapters/ce11.comfyui.adapter';
import { TranslationCloudAdapter } from './adapters/translation.cloud.adapter';
import { StyleTransferReplicateAdapter } from './adapters/style-transfer.replicate.adapter';
import { CharacterGenAdapter } from './adapters/character_gen.adapter';
import { SceneCompositionAdapter } from './adapters/scene_composition.adapter';
import { EmotionAnalysisAdapter } from './adapters/emotion_analysis.adapter';
import { DialogueOptimizationAdapter } from './adapters/dialogue_optimization.adapter';
import { CE07MemoryUpdateAdapter } from './adapters/ce07_memory_update.local.adapter';
import { CE01NarrativeStructureAdapter } from './adapters/ce01_narrative_structure.adapter';
import { CE05ConflictDetectorAdapter } from './adapters/ce05_conflict_detector.adapter';
import { CE08CharacterArcAdapter } from './adapters/ce08_character_arc.adapter';
import { CE12ThemeExtractorAdapter } from './adapters/ce12_theme_extractor.adapter';
import { CE13PacingAnalyzerAdapter } from './adapters/ce13_pacing_analyzer.adapter';
import { Ce14NarrativeClimaxAdapter } from './adapters/ce14_narrative_climax.adapter';
import { CE15MultiCharSceneAdapter } from './adapters/ce15_multi_char_scene.adapter';
import { CE16StoryBranchCoordinatorAdapter } from './adapters/ce16_story_branch_coordinator.adapter';
import { CE17CulturalConsistencyAdapter } from './adapters/ce17_cultural_consistency.adapter';
import { CE18WorldLogicValidatorAdapter } from './adapters/ce18_world_logic_validator.adapter';
import { CE19StorySummaryGenAdapter } from './adapters/ce19_story_summary_gen.adapter';
import { VG01BackgroundRenderAdapter } from './adapters/vg01_background_render.adapter';
import { VG02CharacterRenderAdapter } from './adapters/vg02_character_render.adapter';
import { VG03LightingEngineAdapter } from './adapters/vg03_lighting_engine.adapter';
import { VG04CameraPathAdapter } from './adapters/vg04_camera_path.adapter';
import { VG05VFXCompositorAdapter } from './adapters/vg05_vfx_compositor.adapter';
import { VG06SkeletalAnimationAdapter } from './adapters/vg06_skeletal_animation.adapter';
import { VG07FacialExpressionAdapter } from './adapters/vg07_facial_expression.adapter';
import { VG08AdvancedLightingAdapter } from './adapters/vg08_advanced_lighting.adapter';
import { VG09HairPhysicsAdapter } from './adapters/vg09_hair_physics.adapter';
import { VG10ClothDynamicsAdapter } from './adapters/vg10_cloth_dynamics.adapter';
import { VG11ParticleEffectsAdapter } from './adapters/vg11_particle_effects.adapter';
import { VG12DynamicLightingRigAdapter } from './adapters/vg12_dynamic_lighting_rig.adapter';
import { AU01VoiceTTSAdapter } from './adapters/au01_voice_tts.adapter';
import { AU02BGMGenAdapter } from './adapters/au02_bgm_gen.adapter';
import { AU03SFXGenAdapter } from './adapters/au03_sfx_gen.adapter';
import { AU04AudioMixAdapter } from './adapters/au04_audio_mix.adapter';
import { AU05EnvironmentalReverbAdapter } from './adapters/au05_environmental_reverb.adapter';
import { AU06SpatialAudioAdapter } from './adapters/au06_spatial_audio.adapter';
import { PP01VideoStitchAdapter } from './adapters/pp01_video_stitch.adapter';
import { PP02SubtitleOverlayAdapter } from './adapters/pp02_subtitle_overlay.adapter';
import { PP03WatermarkAdapter } from './adapters/pp03_watermark.adapter';
import { PP04HLSPackageAdapter } from './adapters/pp04_hls_package.adapter';
import { PP05PosterGenAdapter } from './adapters/pp05_poster_gen.adapter';
import { PP06CreditsGenAdapter } from './adapters/pp06_credits_gen.adapter';
import { QC01VisualFidelityAdapter } from './adapters/qc01_visual_fidelity.adapter';
import { QC02NarrativeConsistencyAdapter } from './adapters/qc02_narrative_consistency.adapter';
import { QC03IdentityContinuityAdapter } from './adapters/qc03_identity_continuity.adapter';
import { QC04ComplianceScanAdapter } from './adapters/qc04_compliance_scan.adapter';
import { QC05TechnicalComplianceAdapter } from './adapters/qc05_technical_compliance.adapter';
import { QC06FlickerDetectorAdapter } from './adapters/qc06_flicker_detector.adapter';
import { CE23IdentityLocalAdapter } from './adapters/ce23-identity.local.adapter';
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
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuditModule } from '../audit/audit.module';
import { CostModule } from '../cost/cost.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [PrismaModule, EngineAdminModule, AuditLogModule, AuditModule, CostModule, CharacterModule, forwardRef(() => EngineHubModule)], // 修复 DI 缺失
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
    ShotRenderMpsAdapter,
    ShotRenderRouterAdapter,
    HttpEngineAdapter,
    MockEngineAdapter,
    CE11ComfyUIAdapter,
    G5DialogueBindingAdapter, // G5-P0-1: Dialogue Binding Engine
    G5SemanticMotionMapperAdapter, // G5-P0-2: Semantic Motion Mapper
    G5AssetLayeringResolverAdapter, // G5-P0-3: Asset Layering Resolver
    G5SubengineHubService, // G5 Orchestrator
    TranslationCloudAdapter,
    StyleTransferReplicateAdapter,
    CharacterGenAdapter,
    SceneCompositionAdapter,
    EmotionAnalysisAdapter,
    DialogueOptimizationAdapter,
    CE07MemoryUpdateAdapter,
    CE01NarrativeStructureAdapter,
    CE05ConflictDetectorAdapter,
    CE08CharacterArcAdapter,
    CE12ThemeExtractorAdapter,
    CE13PacingAnalyzerAdapter,
    Ce14NarrativeClimaxAdapter,
    CE15MultiCharSceneAdapter,
    CE16StoryBranchCoordinatorAdapter,
    CE17CulturalConsistencyAdapter,
    CE18WorldLogicValidatorAdapter,
    CE19StorySummaryGenAdapter,
    VG01BackgroundRenderAdapter,
    VG02CharacterRenderAdapter,
    VG03LightingEngineAdapter,
    VG04CameraPathAdapter,
    VG05VFXCompositorAdapter,
    VG06SkeletalAnimationAdapter,
    VG07FacialExpressionAdapter,
    VG08AdvancedLightingAdapter,
    VG09HairPhysicsAdapter,
    VG10ClothDynamicsAdapter,
    VG11ParticleEffectsAdapter,
    VG12DynamicLightingRigAdapter,
    AU01VoiceTTSAdapter,
    AU02BGMGenAdapter,
    AU03SFXGenAdapter,
    AU04AudioMixAdapter,
    AU05EnvironmentalReverbAdapter,
    AU06SpatialAudioAdapter,
    PP01VideoStitchAdapter,
    PP02SubtitleOverlayAdapter,
    PP03WatermarkAdapter,
    PP04HLSPackageAdapter,
    PP05PosterGenAdapter,
    PP06CreditsGenAdapter,
    QC01VisualFidelityAdapter,
    QC02NarrativeConsistencyAdapter,
    QC03IdentityContinuityAdapter,
    QC04ComplianceScanAdapter,
    QC05TechnicalComplianceAdapter,
    QC06FlickerDetectorAdapter,
    CE23IdentityLocalAdapter,
  ],
  exports: [
    EngineRegistry,
    EngineConfigStoreService,
    EngineStrategyService,
    EngineConfigService,
    HttpEngineAdapter,
    ShotRenderRouterAdapter,
    G5SubengineHubService,
    CE01NarrativeStructureAdapter,
    CE05ConflictDetectorAdapter,
    CE08CharacterArcAdapter,
    CE12ThemeExtractorAdapter,
    CE13PacingAnalyzerAdapter,
    Ce14NarrativeClimaxAdapter,
    CE15MultiCharSceneAdapter,
    CE16StoryBranchCoordinatorAdapter,
    CE17CulturalConsistencyAdapter,
    CE18WorldLogicValidatorAdapter,
    VG01BackgroundRenderAdapter,
    VG02CharacterRenderAdapter,
    VG03LightingEngineAdapter,
    VG04CameraPathAdapter,
    VG05VFXCompositorAdapter,
    VG06SkeletalAnimationAdapter,
    VG07FacialExpressionAdapter,
    VG08AdvancedLightingAdapter,
    VG09HairPhysicsAdapter,
    VG10ClothDynamicsAdapter,
    VG11ParticleEffectsAdapter,
    AU01VoiceTTSAdapter,
    AU02BGMGenAdapter,
    AU03SFXGenAdapter,
    AU04AudioMixAdapter,
    AU05EnvironmentalReverbAdapter,
    PP01VideoStitchAdapter,
    PP02SubtitleOverlayAdapter,
    PP03WatermarkAdapter,
    PP04HLSPackageAdapter,
    PP05PosterGenAdapter,
    QC01VisualFidelityAdapter,
    QC02NarrativeConsistencyAdapter,
    QC03IdentityContinuityAdapter,
    QC04ComplianceScanAdapter,
    QC05TechnicalComplianceAdapter,
    QC06FlickerDetectorAdapter,
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
    @Inject(ShotRenderMpsAdapter)
    private readonly shotRenderMpsAdapter: ShotRenderMpsAdapter,
    @Inject(ShotRenderRouterAdapter)
    private readonly shotRenderRouterAdapter: ShotRenderRouterAdapter,
    @Inject(HttpEngineAdapter)
    private readonly httpAdapter: HttpEngineAdapter,
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
    private readonly styleTransferReplicateAdapter: StyleTransferReplicateAdapter,
    @Inject(CharacterGenAdapter)
    private readonly characterGenAdapter: CharacterGenAdapter,
    @Inject(SceneCompositionAdapter)
    private readonly sceneCompositionAdapter: SceneCompositionAdapter,
    @Inject(EmotionAnalysisAdapter)
    private readonly emotionAnalysisAdapter: EmotionAnalysisAdapter,
    @Inject(DialogueOptimizationAdapter)
    private readonly dialogueOptimizationAdapter: DialogueOptimizationAdapter,
    @Inject(CE07MemoryUpdateAdapter)
    private readonly ce07Adapter: CE07MemoryUpdateAdapter,
    @Inject(CE01NarrativeStructureAdapter)
    private readonly ce01Adapter: CE01NarrativeStructureAdapter,
    @Inject(CE05ConflictDetectorAdapter)
    private readonly ce05Adapter: CE05ConflictDetectorAdapter,
    @Inject(CE08CharacterArcAdapter)
    private readonly ce08Adapter: CE08CharacterArcAdapter,
    @Inject(CE12ThemeExtractorAdapter)
    private readonly ce12Adapter: CE12ThemeExtractorAdapter,
    @Inject(CE13PacingAnalyzerAdapter)
    private readonly ce13Adapter: CE13PacingAnalyzerAdapter,
    @Inject(Ce14NarrativeClimaxAdapter)
    private readonly ce14Adapter: Ce14NarrativeClimaxAdapter,
    @Inject(CE15MultiCharSceneAdapter)
    private readonly ce15Adapter: CE15MultiCharSceneAdapter,
    @Inject(CE16StoryBranchCoordinatorAdapter)
    private readonly ce16Adapter: CE16StoryBranchCoordinatorAdapter,
    @Inject(CE17CulturalConsistencyAdapter)
    private readonly ce17Adapter: CE17CulturalConsistencyAdapter,
    @Inject(CE18WorldLogicValidatorAdapter)
    private readonly ce18Adapter: CE18WorldLogicValidatorAdapter,
    @Inject(CE19StorySummaryGenAdapter)
    private readonly ce19Adapter: CE19StorySummaryGenAdapter,
    @Inject(VG01BackgroundRenderAdapter)
    private readonly vg01Adapter: VG01BackgroundRenderAdapter,
    @Inject(VG02CharacterRenderAdapter)
    private readonly vg02Adapter: VG02CharacterRenderAdapter,
    @Inject(VG03LightingEngineAdapter)
    private readonly vg03Adapter: VG03LightingEngineAdapter,
    @Inject(VG04CameraPathAdapter)
    private readonly vg04Adapter: VG04CameraPathAdapter,
    @Inject(VG05VFXCompositorAdapter)
    private readonly vg05Adapter: VG05VFXCompositorAdapter,
    @Inject(VG06SkeletalAnimationAdapter)
    private readonly vg06Adapter: VG06SkeletalAnimationAdapter,
    private readonly vg07Adapter: VG07FacialExpressionAdapter,
    @Inject(VG08AdvancedLightingAdapter)
    private readonly vg08Adapter: VG08AdvancedLightingAdapter,
    @Inject(VG09HairPhysicsAdapter)
    private readonly vg09Adapter: VG09HairPhysicsAdapter,
    @Inject(VG10ClothDynamicsAdapter)
    private readonly vg10Adapter: VG10ClothDynamicsAdapter,
    @Inject(VG11ParticleEffectsAdapter)
    private readonly vg11Adapter: VG11ParticleEffectsAdapter,
    @Inject(VG12DynamicLightingRigAdapter)
    private readonly vg12Adapter: VG12DynamicLightingRigAdapter,
    @Inject(AU01VoiceTTSAdapter)
    private readonly au01Adapter: AU01VoiceTTSAdapter,
    @Inject(AU02BGMGenAdapter)
    private readonly au02Adapter: AU02BGMGenAdapter,
    @Inject(AU03SFXGenAdapter)
    private readonly au03Adapter: AU03SFXGenAdapter,
    @Inject(AU04AudioMixAdapter)
    private readonly au04Adapter: AU04AudioMixAdapter,
    @Inject(AU05EnvironmentalReverbAdapter)
    private readonly au05Adapter: AU05EnvironmentalReverbAdapter,
    @Inject(AU06SpatialAudioAdapter)
    private readonly au06Adapter: AU06SpatialAudioAdapter,
    @Inject(PP01VideoStitchAdapter)
    private readonly pp01Adapter: PP01VideoStitchAdapter,
    @Inject(PP02SubtitleOverlayAdapter)
    private readonly pp02Adapter: PP02SubtitleOverlayAdapter,
    @Inject(PP03WatermarkAdapter)
    private readonly pp03Adapter: PP03WatermarkAdapter,
    @Inject(PP04HLSPackageAdapter)
    private readonly pp04Adapter: PP04HLSPackageAdapter,
    @Inject(PP05PosterGenAdapter)
    private readonly pp05Adapter: PP05PosterGenAdapter,
    @Inject(PP06CreditsGenAdapter)
    private readonly pp06Adapter: PP06CreditsGenAdapter,
    @Inject(QC01VisualFidelityAdapter)
    private readonly qc01Adapter: QC01VisualFidelityAdapter,
    @Inject(QC02NarrativeConsistencyAdapter)
    private readonly qc02Adapter: QC02NarrativeConsistencyAdapter,
    @Inject(QC03IdentityContinuityAdapter)
    private readonly qc03Adapter: QC03IdentityContinuityAdapter,
    @Inject(QC04ComplianceScanAdapter)
    private readonly qc04Adapter: QC04ComplianceScanAdapter,
    @Inject(QC05TechnicalComplianceAdapter)
    private readonly qc05Adapter: QC05TechnicalComplianceAdapter,
    @Inject(QC06FlickerDetectorAdapter)
    private readonly qc06Adapter: QC06FlickerDetectorAdapter,
    @Inject(CE23IdentityLocalAdapter)
    private readonly ce23Adapter: CE23IdentityLocalAdapter
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

    // CE11 Real Registration (Base registration before alias)
    this.registry.register(this.ce11ComfyUIAdapter);

    // [P1-B Fix] Register Aliases for CE components
    this.registry.register(this.ce06Adapter);
    this.registry.register(this.ce03Adapter);
    this.registry.register(this.ce04Adapter);

    this.registry.registerAlias('ce06_novel_parsing', this.ce06Adapter);
    this.registry.registerAlias('ce03_visual_density', this.ce03Adapter);
    this.registry.registerAlias('ce04_visual_enrichment', this.ce04Adapter);
    this.registry.registerAlias('video_merge', this.videoMergeAdapter);
    this.registry.registerAlias('ce10_timeline_compose', this.ce04Adapter); // Mapping to enrichment for now
    this.registry.registerAlias('ce11_timeline_preview', this.ce04Adapter);
    this.registry.registerAlias('ce11_shot_generator_real', this.shotRenderRouterAdapter);
    this.registry.registerAlias('ce23_identity_consistency', this.ce23Adapter);
    this.registry.registerAlias('g5_video_render', this.shotRenderRouterAdapter);

    // Shot Render Registration
    // Phase 0-R: Use Router as primary entry for shot_render
    this.registry.register(this.shotRenderRouterAdapter);
    this.registry.registerAlias('shot_render', this.shotRenderRouterAdapter);
    this.registry.registerAlias('real_shot_render', this.shotRenderRouterAdapter);
    this.registry.registerAlias('default_shot_render', this.shotRenderRouterAdapter);

    // Keep individual adapters registered but not as primary alias
    this.registry.register(this.shotRenderReplicateAdapter);
    this.registry.register(this.shotRenderComfyuiAdapter);
    this.registry.register(this.shotRenderMpsAdapter);
    this.registry.register(this.shotRenderAdapter);

    // P0-R2: Register Video Merge Adapter
    this.registry.register(this.videoMergeAdapter);
    this.registry.register(this.characterGenAdapter);
    this.registry.register(this.sceneCompositionAdapter);
    this.registry.register(this.emotionAnalysisAdapter);
    this.registry.register(this.dialogueOptimizationAdapter);
    this.registry.register(this.ce07Adapter);
    this.registry.registerAlias('shot_preview', this.shotRenderRouterAdapter);
    this.registry.registerAlias('ce02_identity_lock', this.ce23Adapter);
    this.registry.registerAlias('ce06_scan_toc', this.ce06Adapter);
    this.registry.registerAlias('ce06_chunk_parse', this.ce06Adapter);

    // G5-P0-1: Dialogue Binding Engine
    this.registry.register(this.g5DialogueBindingAdapter);

    // G5-P0-2: Semantic Motion Mapper
    this.registry.register(this.g5SemanticMotionMapperAdapter);

    // G5-P0-3: Asset Layering Resolver
    this.registry.register(this.g5AssetLayeringResolverAdapter);

    // P1: Translation Engine
    this.registry.register(this.translationCloudAdapter);
    this.registry.registerAlias('translation_engine', this.translationCloudAdapter);

    // P1: Style Transfer Engine
    this.registry.register(this.styleTransferReplicateAdapter);
    this.registry.registerAlias('style_transfer', this.styleTransferReplicateAdapter);

    // P2.1: Character Gen Engine
    this.registry.register(this.characterGenAdapter);

    // P2.2: Scene Composition Engine
    this.registry.register(this.sceneCompositionAdapter);

    // P2.3: Emotion Analysis Engine
    this.registry.register(this.emotionAnalysisAdapter);

    // P2.4: Dialogue Optimization Engine
    this.registry.register(this.dialogueOptimizationAdapter);

    // P3: CE07 Memory Update
    this.registry.register(this.ce07Adapter);

    // P3: CE01 Narrative Structure
    this.registry.register(this.ce01Adapter);

    // P3: CE05 Conflict Detector
    this.registry.register(this.ce05Adapter);

    // P3.3 Batch: Character Arc, Theme, Pacing
    this.registry.register(this.ce08Adapter);
    this.registry.register(this.ce12Adapter);
    this.registry.register(this.ce13Adapter);
    this.registry.register(this.ce14Adapter);
    this.registry.register(this.ce15Adapter); // P0: Multi-Char Scene Coordination
    this.registry.register(this.ce16Adapter); // P1: Story Branch coordinator
    this.registry.register(this.ce17Adapter); // P1: Cultural Consistency
    this.registry.register(this.ce18Adapter); // P1: World Logic Validator
    this.registry.register(this.ce19Adapter); // P1: Story Summary Generation

    // P3.2 Batch: VG Engines
    this.registry.register(this.vg01Adapter);
    this.registry.register(this.vg02Adapter);
    this.registry.register(this.vg03Adapter);
    this.registry.register(this.vg04Adapter);
    this.registry.register(this.vg05Adapter);
    this.registry.register(this.vg06Adapter); // P0: Skeletal Animation
    this.registry.register(this.vg07Adapter); // P0: Facial Expression
    this.registry.register(this.vg08Adapter); // P0: Advanced Lighting
    this.registry.register(this.vg09Adapter); // P1: Hair Physics
    this.registry.register(this.vg10Adapter); // P1: Cloth Dynamics
    this.registry.register(this.vg11Adapter); // P1: Particle Effects (VFX)
    this.registry.register(this.vg12Adapter); // P1: Dynamic Lighting Rig

    // P3.2 Batch: AU Engines
    this.registry.register(this.au01Adapter);
    this.registry.register(this.au02Adapter);
    this.registry.register(this.au03Adapter);
    this.registry.register(this.au04Adapter);
    this.registry.register(this.au05Adapter); // P1: Environmental Reverb
    this.registry.register(this.au06Adapter); // P1: Spatial Audio mapping

    // P3.2 Batch: PP Engines
    this.registry.register(this.pp01Adapter);
    this.registry.register(this.pp02Adapter);
    this.registry.register(this.pp03Adapter);
    this.registry.register(this.pp04Adapter);
    this.registry.register(this.pp05Adapter); // P1: Poster Generation
    this.registry.register(this.pp06Adapter); // P1: Credits Generation

    // P3.2 Batch: QC Engines
    this.registry.register(this.qc01Adapter);
    this.registry.register(this.qc02Adapter);
    this.registry.register(this.qc03Adapter);
    this.registry.register(this.qc04Adapter);
    this.registry.register(this.qc05Adapter); // P1: Technical Compliance QC
    this.registry.register(this.qc06Adapter); // P1: Flicker Detector QC

    // P4: Identity Consistency
    this.registry.register(this.ce23Adapter);
  }
}
