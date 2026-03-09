"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EngineModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const novel_analysis_local_adapter_NEW_1 = require("./adapters/novel-analysis.local.adapter.NEW");
const ce06_novel_parsing_adapter_1 = require("./adapters/ce06_novel_parsing.adapter");
const ce09_security_adapter_1 = require("./adapters/ce09_security.adapter");
const ce03_visual_density_adapter_1 = require("./adapters/ce03_visual_density.adapter");
const ce04_visual_enrichment_adapter_1 = require("./adapters/ce04_visual_enrichment.adapter");
const video_merge_adapter_1 = require("./adapters/video_merge.adapter");
const shot_render_local_adapter_1 = require("./adapters/shot-render.local.adapter");
const shot_render_replicate_adapter_1 = require("./adapters/shot-render.replicate.adapter");
const shot_render_comfyui_adapter_1 = require("./adapters/shot-render.comfyui.adapter");
const shot_render_mps_adapter_1 = require("./adapters/shot-render.mps.adapter");
const shot_render_router_adapter_1 = require("./adapters/shot_render_router.adapter");
const fusion_adapter_1 = require("./adapters/fusion.adapter");
const http_engine_adapter_1 = require("../engine/adapters/http-engine.adapter");
const mock_engine_adapter_1 = require("../engine/adapters/mock-engine.adapter");
const ce11_comfyui_adapter_1 = require("../engine/adapters/ce11.comfyui.adapter");
const translation_cloud_adapter_1 = require("./adapters/translation.cloud.adapter");
const style_transfer_replicate_adapter_1 = require("./adapters/style-transfer.replicate.adapter");
const character_gen_adapter_1 = require("./adapters/character_gen.adapter");
const scene_composition_adapter_1 = require("./adapters/scene_composition.adapter");
const emotion_analysis_adapter_1 = require("./adapters/emotion_analysis.adapter");
const dialogue_optimization_adapter_1 = require("./adapters/dialogue_optimization.adapter");
const ce07_memory_update_adapter_1 = require("./adapters/ce07_memory_update.adapter");
const ce01_narrative_structure_adapter_1 = require("./adapters/ce01_narrative_structure.adapter");
const ce05_conflict_detector_adapter_1 = require("./adapters/ce05_conflict_detector.adapter");
const ce08_character_arc_adapter_1 = require("./adapters/ce08_character_arc.adapter");
const ce12_theme_extractor_adapter_1 = require("./adapters/ce12_theme_extractor.adapter");
const ce13_pacing_analyzer_adapter_1 = require("./adapters/ce13_pacing_analyzer.adapter");
const ce14_narrative_climax_adapter_1 = require("./adapters/ce14_narrative_climax.adapter");
const ce15_multi_char_scene_adapter_1 = require("./adapters/ce15_multi_char_scene.adapter");
const ce16_story_branch_coordinator_adapter_1 = require("./adapters/ce16_story_branch_coordinator.adapter");
const ce17_cultural_consistency_adapter_1 = require("./adapters/ce17_cultural_consistency.adapter");
const ce18_world_logic_validator_adapter_1 = require("./adapters/ce18_world_logic_validator.adapter");
const ce19_story_summary_gen_adapter_1 = require("./adapters/ce19_story_summary_gen.adapter");
const vg01_background_render_adapter_1 = require("./adapters/vg01_background_render.adapter");
const vg02_character_render_adapter_1 = require("./adapters/vg02_character_render.adapter");
const vg03_lighting_engine_adapter_1 = require("./adapters/vg03_lighting_engine.adapter");
const vg04_camera_path_adapter_1 = require("./adapters/vg04_camera_path.adapter");
const vg05_vfx_compositor_adapter_1 = require("./adapters/vg05_vfx_compositor.adapter");
const vg06_skeletal_animation_adapter_1 = require("./adapters/vg06_skeletal_animation.adapter");
const vg07_facial_expression_adapter_1 = require("./adapters/vg07_facial_expression.adapter");
const vg08_advanced_lighting_adapter_1 = require("./adapters/vg08_advanced_lighting.adapter");
const vg09_hair_physics_adapter_1 = require("./adapters/vg09_hair_physics.adapter");
const vg10_cloth_dynamics_adapter_1 = require("./adapters/vg10_cloth_dynamics.adapter");
const vg11_particle_effects_adapter_1 = require("./adapters/vg11_particle_effects.adapter");
const vg12_dynamic_lighting_rig_adapter_1 = require("./adapters/vg12_dynamic_lighting_rig.adapter");
const au01_voice_tts_adapter_1 = require("./adapters/au01_voice_tts.adapter");
const au02_bgm_gen_adapter_1 = require("./adapters/au02_bgm_gen.adapter");
const au03_sfx_gen_adapter_1 = require("./adapters/au03_sfx_gen.adapter");
const au04_audio_mix_adapter_1 = require("./adapters/au04_audio_mix.adapter");
const au05_environmental_reverb_adapter_1 = require("./adapters/au05_environmental_reverb.adapter");
const au06_spatial_audio_adapter_1 = require("./adapters/au06_spatial_audio.adapter");
const pp01_video_stitch_adapter_1 = require("./adapters/pp01_video_stitch.adapter");
const pp02_subtitle_overlay_adapter_1 = require("./adapters/pp02_subtitle_overlay.adapter");
const pp03_watermark_adapter_1 = require("./adapters/pp03_watermark.adapter");
const pp04_hls_package_adapter_1 = require("./adapters/pp04_hls_package.adapter");
const pp05_poster_gen_adapter_1 = require("./adapters/pp05_poster_gen.adapter");
const pp06_credits_gen_adapter_1 = require("./adapters/pp06_credits_gen.adapter");
const qc01_visual_fidelity_adapter_1 = require("./adapters/qc01_visual_fidelity.adapter");
const qc02_narrative_consistency_adapter_1 = require("./adapters/qc02_narrative_consistency.adapter");
const qc03_identity_continuity_adapter_1 = require("./adapters/qc03_identity_continuity.adapter");
const qc04_compliance_scan_adapter_1 = require("./adapters/qc04_compliance_scan.adapter");
const qc05_technical_compliance_adapter_1 = require("./adapters/qc05_technical_compliance.adapter");
const qc06_flicker_detector_adapter_1 = require("./adapters/qc06_flicker_detector.adapter");
const ce23_identity_lock_adapter_1 = require("./adapters/ce23_identity_lock.adapter");
const engine_config_1 = require("../config/engine.config");
const prisma_module_1 = require("../prisma/prisma.module");
const engine_config_store_service_1 = require("../engine/engine-config-store.service");
const engine_routing_service_1 = require("../engine/engine-routing.service");
const engine_strategy_service_1 = require("../engine/engine-strategy.service");
const engine_invoker_service_1 = require("./engine-invoker.service");
const engine_controller_1 = require("../engine/engine.controller");
const engine_admin_module_1 = require("../engine-admin/engine-admin.module");
const g5_dialogue_binding_adapter_1 = require("./adapters/g5-dialogue-binding.adapter");
const g5_semantic_motion_mapper_adapter_1 = require("./adapters/g5-semantic-motion-mapper.adapter");
const g5_asset_layering_resolver_adapter_1 = require("./adapters/g5-asset-layering-resolver.adapter");
const g5_subengine_hub_service_1 = require("./g5-subengine-hub.service");
const engine_hub_module_1 = require("../engine-hub/engine-hub.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const audit_module_1 = require("../audit/audit.module");
const cost_module_1 = require("../cost/cost.module");
const character_module_1 = require("../character/character.module");
const audio_module_1 = require("../audio/audio.module");
const audio_tts_local_adapter_1 = require("./adapters/audio-tts.local.adapter");
let EngineModule = EngineModule_1 = class EngineModule {
    moduleRef;
    registry;
    novelAdapter;
    ce06Adapter;
    ce03Adapter;
    ce04Adapter;
    videoMergeAdapter;
    shotRenderAdapter;
    shotRenderReplicateAdapter;
    shotRenderComfyuiAdapter;
    shotRenderMpsAdapter;
    shotRenderRouterAdapter;
    fusionAdapter;
    httpAdapter;
    mockEngineAdapter;
    ce11ComfyUIAdapter;
    g5DialogueBindingAdapter;
    g5SemanticMotionMapperAdapter;
    g5AssetLayeringResolverAdapter;
    translationCloudAdapter;
    styleTransferReplicateAdapter;
    characterGenAdapter;
    sceneCompositionAdapter;
    emotionAnalysisAdapter;
    dialogueOptimizationAdapter;
    ce07Adapter;
    ce01Adapter;
    ce05Adapter;
    ce08Adapter;
    ce12Adapter;
    ce13Adapter;
    ce14Adapter;
    ce15Adapter;
    ce16Adapter;
    ce17Adapter;
    ce09Adapter;
    ce18Adapter;
    ce19Adapter;
    vg01Adapter;
    vg02Adapter;
    vg03Adapter;
    vg04Adapter;
    vg05Adapter;
    vg06Adapter;
    vg07Adapter;
    vg08Adapter;
    vg09Adapter;
    vg10Adapter;
    vg11Adapter;
    vg12Adapter;
    au01Adapter;
    au02Adapter;
    au03Adapter;
    au04Adapter;
    au05Adapter;
    au06Adapter;
    pp01Adapter;
    pp02Adapter;
    pp03Adapter;
    pp04Adapter;
    pp05Adapter;
    pp06Adapter;
    qc01Adapter;
    qc02Adapter;
    qc03Adapter;
    qc04Adapter;
    qc05Adapter;
    qc06Adapter;
    ce23Adapter;
    audioTTSAdapter;
    logger = new common_1.Logger(EngineModule_1.name);
    constructor(moduleRef, registry, novelAdapter, ce06Adapter, ce03Adapter, ce04Adapter, videoMergeAdapter, shotRenderAdapter, shotRenderReplicateAdapter, shotRenderComfyuiAdapter, shotRenderMpsAdapter, shotRenderRouterAdapter, fusionAdapter, httpAdapter, mockEngineAdapter, ce11ComfyUIAdapter, g5DialogueBindingAdapter, g5SemanticMotionMapperAdapter, g5AssetLayeringResolverAdapter, translationCloudAdapter, styleTransferReplicateAdapter, characterGenAdapter, sceneCompositionAdapter, emotionAnalysisAdapter, dialogueOptimizationAdapter, ce07Adapter, ce01Adapter, ce05Adapter, ce08Adapter, ce12Adapter, ce13Adapter, ce14Adapter, ce15Adapter, ce16Adapter, ce17Adapter, ce09Adapter, ce18Adapter, ce19Adapter, vg01Adapter, vg02Adapter, vg03Adapter, vg04Adapter, vg05Adapter, vg06Adapter, vg07Adapter, vg08Adapter, vg09Adapter, vg10Adapter, vg11Adapter, vg12Adapter, au01Adapter, au02Adapter, au03Adapter, au04Adapter, au05Adapter, au06Adapter, pp01Adapter, pp02Adapter, pp03Adapter, pp04Adapter, pp05Adapter, pp06Adapter, qc01Adapter, qc02Adapter, qc03Adapter, qc04Adapter, qc05Adapter, qc06Adapter, ce23Adapter, audioTTSAdapter) {
        this.moduleRef = moduleRef;
        this.registry = registry;
        this.novelAdapter = novelAdapter;
        this.ce06Adapter = ce06Adapter;
        this.ce03Adapter = ce03Adapter;
        this.ce04Adapter = ce04Adapter;
        this.videoMergeAdapter = videoMergeAdapter;
        this.shotRenderAdapter = shotRenderAdapter;
        this.shotRenderReplicateAdapter = shotRenderReplicateAdapter;
        this.shotRenderComfyuiAdapter = shotRenderComfyuiAdapter;
        this.shotRenderMpsAdapter = shotRenderMpsAdapter;
        this.shotRenderRouterAdapter = shotRenderRouterAdapter;
        this.fusionAdapter = fusionAdapter;
        this.httpAdapter = httpAdapter;
        this.mockEngineAdapter = mockEngineAdapter;
        this.ce11ComfyUIAdapter = ce11ComfyUIAdapter;
        this.g5DialogueBindingAdapter = g5DialogueBindingAdapter;
        this.g5SemanticMotionMapperAdapter = g5SemanticMotionMapperAdapter;
        this.g5AssetLayeringResolverAdapter = g5AssetLayeringResolverAdapter;
        this.translationCloudAdapter = translationCloudAdapter;
        this.styleTransferReplicateAdapter = styleTransferReplicateAdapter;
        this.characterGenAdapter = characterGenAdapter;
        this.sceneCompositionAdapter = sceneCompositionAdapter;
        this.emotionAnalysisAdapter = emotionAnalysisAdapter;
        this.dialogueOptimizationAdapter = dialogueOptimizationAdapter;
        this.ce07Adapter = ce07Adapter;
        this.ce01Adapter = ce01Adapter;
        this.ce05Adapter = ce05Adapter;
        this.ce08Adapter = ce08Adapter;
        this.ce12Adapter = ce12Adapter;
        this.ce13Adapter = ce13Adapter;
        this.ce14Adapter = ce14Adapter;
        this.ce15Adapter = ce15Adapter;
        this.ce16Adapter = ce16Adapter;
        this.ce17Adapter = ce17Adapter;
        this.ce09Adapter = ce09Adapter;
        this.ce18Adapter = ce18Adapter;
        this.ce19Adapter = ce19Adapter;
        this.vg01Adapter = vg01Adapter;
        this.vg02Adapter = vg02Adapter;
        this.vg03Adapter = vg03Adapter;
        this.vg04Adapter = vg04Adapter;
        this.vg05Adapter = vg05Adapter;
        this.vg06Adapter = vg06Adapter;
        this.vg07Adapter = vg07Adapter;
        this.vg08Adapter = vg08Adapter;
        this.vg09Adapter = vg09Adapter;
        this.vg10Adapter = vg10Adapter;
        this.vg11Adapter = vg11Adapter;
        this.vg12Adapter = vg12Adapter;
        this.au01Adapter = au01Adapter;
        this.au02Adapter = au02Adapter;
        this.au03Adapter = au03Adapter;
        this.au04Adapter = au04Adapter;
        this.au05Adapter = au05Adapter;
        this.au06Adapter = au06Adapter;
        this.pp01Adapter = pp01Adapter;
        this.pp02Adapter = pp02Adapter;
        this.pp03Adapter = pp03Adapter;
        this.pp04Adapter = pp04Adapter;
        this.pp05Adapter = pp05Adapter;
        this.pp06Adapter = pp06Adapter;
        this.qc01Adapter = qc01Adapter;
        this.qc02Adapter = qc02Adapter;
        this.qc03Adapter = qc03Adapter;
        this.qc04Adapter = qc04Adapter;
        this.qc05Adapter = qc05Adapter;
        this.qc06Adapter = qc06Adapter;
        this.ce23Adapter = ce23Adapter;
        this.audioTTSAdapter = audioTTSAdapter;
    }
    onModuleInit() {
        if (!this.registry) {
            this.logger.warn('[EngineModule] EngineRegistry is undefined during onModuleInit, attempting to resolve via ModuleRef...');
            try {
                this.registry = this.moduleRef.get(engine_registry_service_1.EngineRegistry, { strict: false });
            }
            catch (e) {
                this.logger.error('[EngineModule] Failed to resolve EngineRegistry via ModuleRef. Adapters will NOT be registered!');
                return;
            }
        }
        this.registry.register(this.novelAdapter);
        this.registry.register(this.httpAdapter);
        this.registry.register(this.ce11ComfyUIAdapter);
        this.registry.register(this.ce06Adapter);
        this.registry.register(this.ce03Adapter);
        this.registry.register(this.ce04Adapter);
        this.registry.registerAlias('ce06_novel_parsing', this.ce06Adapter);
        this.registry.registerAlias('ce03_visual_density', this.ce03Adapter);
        this.registry.registerAlias('ce04_visual_enrichment', this.ce04Adapter);
        this.registry.registerAlias('video_merge', this.videoMergeAdapter);
        this.registry.registerAlias('ce10_timeline_compose', this.ce04Adapter);
        this.registry.registerAlias('ce11_timeline_preview', this.ce04Adapter);
        this.registry.registerAlias('ce11_shot_generator_real', this.ce11ComfyUIAdapter);
        this.registry.registerAlias('ce11_shot_generator_mock', this.mockEngineAdapter);
        this.registry.registerAlias('ce23_identity_consistency', this.ce23Adapter);
        this.registry.registerAlias('g5_video_render', this.shotRenderRouterAdapter);
        this.registry.register(this.shotRenderRouterAdapter);
        this.registry.registerAlias('shot_render', this.shotRenderRouterAdapter);
        this.registry.registerAlias('real_shot_render', this.shotRenderRouterAdapter);
        this.registry.registerAlias('default_shot_render', this.shotRenderRouterAdapter);
        this.registry.register(this.fusionAdapter);
        this.registry.registerAlias('fusion', this.fusionAdapter);
        this.registry.registerAlias('ce11_fusion_real', this.fusionAdapter);
        this.registry.register(this.shotRenderReplicateAdapter);
        this.registry.register(this.shotRenderComfyuiAdapter);
        this.registry.register(this.shotRenderMpsAdapter);
        this.registry.register(this.shotRenderAdapter);
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
        this.registry.register(this.g5DialogueBindingAdapter);
        this.registry.register(this.g5SemanticMotionMapperAdapter);
        this.registry.register(this.g5AssetLayeringResolverAdapter);
        this.registry.register(this.translationCloudAdapter);
        this.registry.registerAlias('translation_engine', this.translationCloudAdapter);
        this.registry.register(this.styleTransferReplicateAdapter);
        this.registry.registerAlias('style_transfer', this.styleTransferReplicateAdapter);
        this.registry.register(this.characterGenAdapter);
        this.registry.register(this.sceneCompositionAdapter);
        this.registry.register(this.emotionAnalysisAdapter);
        this.registry.register(this.dialogueOptimizationAdapter);
        this.registry.register(this.ce09Adapter);
        this.registry.register(this.ce07Adapter);
        this.registry.register(this.ce01Adapter);
        this.registry.register(this.ce05Adapter);
        this.registry.register(this.ce08Adapter);
        this.registry.register(this.ce12Adapter);
        this.registry.register(this.ce13Adapter);
        this.registry.register(this.ce14Adapter);
        this.registry.register(this.ce15Adapter);
        this.registry.register(this.ce16Adapter);
        this.registry.register(this.ce17Adapter);
        this.registry.register(this.ce18Adapter);
        this.registry.register(this.ce19Adapter);
        this.registry.register(this.vg01Adapter);
        this.registry.register(this.vg02Adapter);
        this.registry.register(this.vg03Adapter);
        this.registry.register(this.vg04Adapter);
        this.registry.register(this.vg05Adapter);
        this.registry.register(this.vg06Adapter);
        this.registry.register(this.vg07Adapter);
        this.registry.register(this.vg08Adapter);
        this.registry.register(this.vg09Adapter);
        this.registry.register(this.vg10Adapter);
        this.registry.register(this.vg11Adapter);
        this.registry.register(this.vg12Adapter);
        this.registry.register(this.au01Adapter);
        this.registry.register(this.au02Adapter);
        this.registry.register(this.au03Adapter);
        this.registry.register(this.au04Adapter);
        this.registry.register(this.au05Adapter);
        this.registry.register(this.au06Adapter);
        this.registry.register(this.pp01Adapter);
        this.registry.register(this.pp02Adapter);
        this.registry.register(this.pp03Adapter);
        this.registry.register(this.pp04Adapter);
        this.registry.register(this.pp05Adapter);
        this.registry.register(this.pp06Adapter);
        this.registry.register(this.qc01Adapter);
        this.registry.register(this.qc02Adapter);
        this.registry.register(this.qc03Adapter);
        this.registry.register(this.qc04Adapter);
        this.registry.register(this.qc05Adapter);
        this.registry.register(this.qc06Adapter);
        this.registry.register(this.ce23Adapter);
        this.registry.register(this.audioTTSAdapter);
    }
};
exports.EngineModule = EngineModule;
exports.EngineModule = EngineModule = EngineModule_1 = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            engine_admin_module_1.EngineAdminModule,
            audit_log_module_1.AuditLogModule,
            audit_module_1.AuditModule,
            cost_module_1.CostModule,
            character_module_1.CharacterModule,
            (0, common_1.forwardRef)(() => engine_hub_module_1.EngineHubModule),
            audio_module_1.AudioModule,
        ],
        controllers: [engine_controller_1.EngineController],
        providers: [
            engine_registry_service_1.EngineRegistry,
            engine_config_1.EngineConfigService,
            engine_config_store_service_1.EngineConfigStoreService,
            engine_routing_service_1.EngineRoutingService,
            engine_strategy_service_1.EngineStrategyService,
            engine_invoker_service_1.EngineInvokerService,
            novel_analysis_local_adapter_NEW_1.NovelAnalysisLocalAdapter,
            ce06_novel_parsing_adapter_1.CE06LocalAdapter,
            ce03_visual_density_adapter_1.CE03LocalAdapter,
            ce04_visual_enrichment_adapter_1.CE04LocalAdapter,
            video_merge_adapter_1.VideoMergeLocalAdapter,
            shot_render_local_adapter_1.ShotRenderLocalAdapter,
            shot_render_replicate_adapter_1.ShotRenderReplicateAdapter,
            shot_render_comfyui_adapter_1.ShotRenderComfyuiAdapter,
            shot_render_mps_adapter_1.ShotRenderMpsAdapter,
            shot_render_router_adapter_1.ShotRenderRouterAdapter,
            fusion_adapter_1.FusionAdapter,
            http_engine_adapter_1.HttpEngineAdapter,
            mock_engine_adapter_1.MockEngineAdapter,
            ce11_comfyui_adapter_1.CE11ComfyUIAdapter,
            g5_dialogue_binding_adapter_1.G5DialogueBindingAdapter,
            g5_semantic_motion_mapper_adapter_1.G5SemanticMotionMapperAdapter,
            g5_asset_layering_resolver_adapter_1.G5AssetLayeringResolverAdapter,
            g5_subengine_hub_service_1.G5SubengineHubService,
            translation_cloud_adapter_1.TranslationCloudAdapter,
            style_transfer_replicate_adapter_1.StyleTransferReplicateAdapter,
            character_gen_adapter_1.CharacterGenAdapter,
            scene_composition_adapter_1.SceneCompositionAdapter,
            emotion_analysis_adapter_1.EmotionAnalysisAdapter,
            dialogue_optimization_adapter_1.DialogueOptimizationAdapter,
            ce09_security_adapter_1.CE09SecurityLocalAdapter,
            ce07_memory_update_adapter_1.CE07MemoryUpdateAdapter,
            ce01_narrative_structure_adapter_1.CE01NarrativeStructureAdapter,
            ce05_conflict_detector_adapter_1.CE05ConflictDetectorAdapter,
            ce08_character_arc_adapter_1.CE08CharacterArcAdapter,
            ce12_theme_extractor_adapter_1.CE12ThemeExtractorAdapter,
            ce13_pacing_analyzer_adapter_1.CE13PacingAnalyzerAdapter,
            ce14_narrative_climax_adapter_1.Ce14NarrativeClimaxAdapter,
            ce15_multi_char_scene_adapter_1.CE15MultiCharSceneAdapter,
            ce16_story_branch_coordinator_adapter_1.CE16StoryBranchCoordinatorAdapter,
            ce17_cultural_consistency_adapter_1.CE17CulturalConsistencyAdapter,
            ce18_world_logic_validator_adapter_1.CE18WorldLogicValidatorAdapter,
            ce19_story_summary_gen_adapter_1.CE19StorySummaryGenAdapter,
            vg01_background_render_adapter_1.VG01BackgroundRenderAdapter,
            vg02_character_render_adapter_1.VG02CharacterRenderAdapter,
            vg03_lighting_engine_adapter_1.VG03LightingEngineAdapter,
            vg04_camera_path_adapter_1.VG04CameraPathAdapter,
            vg05_vfx_compositor_adapter_1.VG05VFXCompositorAdapter,
            vg06_skeletal_animation_adapter_1.VG06SkeletalAnimationAdapter,
            vg07_facial_expression_adapter_1.VG07FacialExpressionAdapter,
            vg08_advanced_lighting_adapter_1.VG08AdvancedLightingAdapter,
            vg09_hair_physics_adapter_1.VG09HairPhysicsAdapter,
            vg10_cloth_dynamics_adapter_1.VG10ClothDynamicsAdapter,
            vg11_particle_effects_adapter_1.VG11ParticleEffectsAdapter,
            vg12_dynamic_lighting_rig_adapter_1.VG12DynamicLightingRigAdapter,
            au01_voice_tts_adapter_1.AU01VoiceTTSAdapter,
            au02_bgm_gen_adapter_1.AU02BGMGenAdapter,
            au03_sfx_gen_adapter_1.AU03SFXGenAdapter,
            au04_audio_mix_adapter_1.AU04AudioMixAdapter,
            au05_environmental_reverb_adapter_1.AU05EnvironmentalReverbAdapter,
            au06_spatial_audio_adapter_1.AU06SpatialAudioAdapter,
            pp01_video_stitch_adapter_1.PP01VideoStitchAdapter,
            pp02_subtitle_overlay_adapter_1.PP02SubtitleOverlayAdapter,
            pp03_watermark_adapter_1.PP03WatermarkAdapter,
            pp04_hls_package_adapter_1.PP04HLSPackageAdapter,
            pp05_poster_gen_adapter_1.PP05PosterGenAdapter,
            pp06_credits_gen_adapter_1.PP06CreditsGenAdapter,
            qc01_visual_fidelity_adapter_1.QC01VisualFidelityAdapter,
            qc02_narrative_consistency_adapter_1.QC02NarrativeConsistencyAdapter,
            qc03_identity_continuity_adapter_1.QC03IdentityContinuityAdapter,
            qc04_compliance_scan_adapter_1.QC04ComplianceScanAdapter,
            qc05_technical_compliance_adapter_1.QC05TechnicalComplianceAdapter,
            qc06_flicker_detector_adapter_1.QC06FlickerDetectorAdapter,
            ce23_identity_lock_adapter_1.CE23IdentityLocalAdapter,
            audio_tts_local_adapter_1.AudioTTSLocalAdapter,
        ],
        exports: [
            engine_registry_service_1.EngineRegistry,
            engine_config_store_service_1.EngineConfigStoreService,
            engine_strategy_service_1.EngineStrategyService,
            engine_config_1.EngineConfigService,
            http_engine_adapter_1.HttpEngineAdapter,
            shot_render_router_adapter_1.ShotRenderRouterAdapter,
            fusion_adapter_1.FusionAdapter,
            g5_subengine_hub_service_1.G5SubengineHubService,
            ce01_narrative_structure_adapter_1.CE01NarrativeStructureAdapter,
            ce05_conflict_detector_adapter_1.CE05ConflictDetectorAdapter,
            ce08_character_arc_adapter_1.CE08CharacterArcAdapter,
            ce12_theme_extractor_adapter_1.CE12ThemeExtractorAdapter,
            ce13_pacing_analyzer_adapter_1.CE13PacingAnalyzerAdapter,
            ce14_narrative_climax_adapter_1.Ce14NarrativeClimaxAdapter,
            ce15_multi_char_scene_adapter_1.CE15MultiCharSceneAdapter,
            ce16_story_branch_coordinator_adapter_1.CE16StoryBranchCoordinatorAdapter,
            ce17_cultural_consistency_adapter_1.CE17CulturalConsistencyAdapter,
            ce18_world_logic_validator_adapter_1.CE18WorldLogicValidatorAdapter,
            vg01_background_render_adapter_1.VG01BackgroundRenderAdapter,
            vg02_character_render_adapter_1.VG02CharacterRenderAdapter,
            vg03_lighting_engine_adapter_1.VG03LightingEngineAdapter,
            vg04_camera_path_adapter_1.VG04CameraPathAdapter,
            vg05_vfx_compositor_adapter_1.VG05VFXCompositorAdapter,
            vg06_skeletal_animation_adapter_1.VG06SkeletalAnimationAdapter,
            vg07_facial_expression_adapter_1.VG07FacialExpressionAdapter,
            vg08_advanced_lighting_adapter_1.VG08AdvancedLightingAdapter,
            vg09_hair_physics_adapter_1.VG09HairPhysicsAdapter,
            vg10_cloth_dynamics_adapter_1.VG10ClothDynamicsAdapter,
            vg11_particle_effects_adapter_1.VG11ParticleEffectsAdapter,
            au01_voice_tts_adapter_1.AU01VoiceTTSAdapter,
            au02_bgm_gen_adapter_1.AU02BGMGenAdapter,
            au03_sfx_gen_adapter_1.AU03SFXGenAdapter,
            au04_audio_mix_adapter_1.AU04AudioMixAdapter,
            au05_environmental_reverb_adapter_1.AU05EnvironmentalReverbAdapter,
            pp01_video_stitch_adapter_1.PP01VideoStitchAdapter,
            pp02_subtitle_overlay_adapter_1.PP02SubtitleOverlayAdapter,
            pp03_watermark_adapter_1.PP03WatermarkAdapter,
            pp04_hls_package_adapter_1.PP04HLSPackageAdapter,
            pp05_poster_gen_adapter_1.PP05PosterGenAdapter,
            ce09_security_adapter_1.CE09SecurityLocalAdapter,
            qc01_visual_fidelity_adapter_1.QC01VisualFidelityAdapter,
            qc02_narrative_consistency_adapter_1.QC02NarrativeConsistencyAdapter,
            qc03_identity_continuity_adapter_1.QC03IdentityContinuityAdapter,
            qc04_compliance_scan_adapter_1.QC04ComplianceScanAdapter,
            qc05_technical_compliance_adapter_1.QC05TechnicalComplianceAdapter,
            ce06_novel_parsing_adapter_1.CE06LocalAdapter,
            ce03_visual_density_adapter_1.CE03LocalAdapter,
            ce04_visual_enrichment_adapter_1.CE04LocalAdapter,
            novel_analysis_local_adapter_NEW_1.NovelAnalysisLocalAdapter,
            qc06_flicker_detector_adapter_1.QC06FlickerDetectorAdapter,
            audio_tts_local_adapter_1.AudioTTSLocalAdapter,
        ],
    }),
    __param(1, (0, common_1.Inject)(engine_registry_service_1.EngineRegistry)),
    __param(2, (0, common_1.Inject)(novel_analysis_local_adapter_NEW_1.NovelAnalysisLocalAdapter)),
    __param(3, (0, common_1.Inject)(ce06_novel_parsing_adapter_1.CE06LocalAdapter)),
    __param(4, (0, common_1.Inject)(ce03_visual_density_adapter_1.CE03LocalAdapter)),
    __param(5, (0, common_1.Inject)(ce04_visual_enrichment_adapter_1.CE04LocalAdapter)),
    __param(6, (0, common_1.Inject)(video_merge_adapter_1.VideoMergeLocalAdapter)),
    __param(7, (0, common_1.Inject)(shot_render_local_adapter_1.ShotRenderLocalAdapter)),
    __param(8, (0, common_1.Inject)(shot_render_replicate_adapter_1.ShotRenderReplicateAdapter)),
    __param(9, (0, common_1.Inject)(shot_render_comfyui_adapter_1.ShotRenderComfyuiAdapter)),
    __param(10, (0, common_1.Inject)(shot_render_mps_adapter_1.ShotRenderMpsAdapter)),
    __param(11, (0, common_1.Inject)(shot_render_router_adapter_1.ShotRenderRouterAdapter)),
    __param(12, (0, common_1.Inject)(fusion_adapter_1.FusionAdapter)),
    __param(13, (0, common_1.Inject)(http_engine_adapter_1.HttpEngineAdapter)),
    __param(14, (0, common_1.Inject)(mock_engine_adapter_1.MockEngineAdapter)),
    __param(15, (0, common_1.Inject)(ce11_comfyui_adapter_1.CE11ComfyUIAdapter)),
    __param(16, (0, common_1.Inject)(g5_dialogue_binding_adapter_1.G5DialogueBindingAdapter)),
    __param(17, (0, common_1.Inject)(g5_semantic_motion_mapper_adapter_1.G5SemanticMotionMapperAdapter)),
    __param(18, (0, common_1.Inject)(g5_asset_layering_resolver_adapter_1.G5AssetLayeringResolverAdapter)),
    __param(19, (0, common_1.Inject)(translation_cloud_adapter_1.TranslationCloudAdapter)),
    __param(20, (0, common_1.Inject)(style_transfer_replicate_adapter_1.StyleTransferReplicateAdapter)),
    __param(21, (0, common_1.Inject)(character_gen_adapter_1.CharacterGenAdapter)),
    __param(22, (0, common_1.Inject)(scene_composition_adapter_1.SceneCompositionAdapter)),
    __param(23, (0, common_1.Inject)(emotion_analysis_adapter_1.EmotionAnalysisAdapter)),
    __param(24, (0, common_1.Inject)(dialogue_optimization_adapter_1.DialogueOptimizationAdapter)),
    __param(25, (0, common_1.Inject)(ce07_memory_update_adapter_1.CE07MemoryUpdateAdapter)),
    __param(26, (0, common_1.Inject)(ce01_narrative_structure_adapter_1.CE01NarrativeStructureAdapter)),
    __param(27, (0, common_1.Inject)(ce05_conflict_detector_adapter_1.CE05ConflictDetectorAdapter)),
    __param(28, (0, common_1.Inject)(ce08_character_arc_adapter_1.CE08CharacterArcAdapter)),
    __param(29, (0, common_1.Inject)(ce12_theme_extractor_adapter_1.CE12ThemeExtractorAdapter)),
    __param(30, (0, common_1.Inject)(ce13_pacing_analyzer_adapter_1.CE13PacingAnalyzerAdapter)),
    __param(31, (0, common_1.Inject)(ce14_narrative_climax_adapter_1.Ce14NarrativeClimaxAdapter)),
    __param(32, (0, common_1.Inject)(ce15_multi_char_scene_adapter_1.CE15MultiCharSceneAdapter)),
    __param(33, (0, common_1.Inject)(ce16_story_branch_coordinator_adapter_1.CE16StoryBranchCoordinatorAdapter)),
    __param(34, (0, common_1.Inject)(ce17_cultural_consistency_adapter_1.CE17CulturalConsistencyAdapter)),
    __param(35, (0, common_1.Inject)(ce09_security_adapter_1.CE09SecurityLocalAdapter)),
    __param(36, (0, common_1.Inject)(ce18_world_logic_validator_adapter_1.CE18WorldLogicValidatorAdapter)),
    __param(37, (0, common_1.Inject)(ce19_story_summary_gen_adapter_1.CE19StorySummaryGenAdapter)),
    __param(38, (0, common_1.Inject)(vg01_background_render_adapter_1.VG01BackgroundRenderAdapter)),
    __param(39, (0, common_1.Inject)(vg02_character_render_adapter_1.VG02CharacterRenderAdapter)),
    __param(40, (0, common_1.Inject)(vg03_lighting_engine_adapter_1.VG03LightingEngineAdapter)),
    __param(41, (0, common_1.Inject)(vg04_camera_path_adapter_1.VG04CameraPathAdapter)),
    __param(42, (0, common_1.Inject)(vg05_vfx_compositor_adapter_1.VG05VFXCompositorAdapter)),
    __param(43, (0, common_1.Inject)(vg06_skeletal_animation_adapter_1.VG06SkeletalAnimationAdapter)),
    __param(44, (0, common_1.Inject)(vg07_facial_expression_adapter_1.VG07FacialExpressionAdapter)),
    __param(45, (0, common_1.Inject)(vg08_advanced_lighting_adapter_1.VG08AdvancedLightingAdapter)),
    __param(46, (0, common_1.Inject)(vg09_hair_physics_adapter_1.VG09HairPhysicsAdapter)),
    __param(47, (0, common_1.Inject)(vg10_cloth_dynamics_adapter_1.VG10ClothDynamicsAdapter)),
    __param(48, (0, common_1.Inject)(vg11_particle_effects_adapter_1.VG11ParticleEffectsAdapter)),
    __param(49, (0, common_1.Inject)(vg12_dynamic_lighting_rig_adapter_1.VG12DynamicLightingRigAdapter)),
    __param(50, (0, common_1.Inject)(au01_voice_tts_adapter_1.AU01VoiceTTSAdapter)),
    __param(51, (0, common_1.Inject)(au02_bgm_gen_adapter_1.AU02BGMGenAdapter)),
    __param(52, (0, common_1.Inject)(au03_sfx_gen_adapter_1.AU03SFXGenAdapter)),
    __param(53, (0, common_1.Inject)(au04_audio_mix_adapter_1.AU04AudioMixAdapter)),
    __param(54, (0, common_1.Inject)(au05_environmental_reverb_adapter_1.AU05EnvironmentalReverbAdapter)),
    __param(55, (0, common_1.Inject)(au06_spatial_audio_adapter_1.AU06SpatialAudioAdapter)),
    __param(56, (0, common_1.Inject)(pp01_video_stitch_adapter_1.PP01VideoStitchAdapter)),
    __param(57, (0, common_1.Inject)(pp02_subtitle_overlay_adapter_1.PP02SubtitleOverlayAdapter)),
    __param(58, (0, common_1.Inject)(pp03_watermark_adapter_1.PP03WatermarkAdapter)),
    __param(59, (0, common_1.Inject)(pp04_hls_package_adapter_1.PP04HLSPackageAdapter)),
    __param(60, (0, common_1.Inject)(pp05_poster_gen_adapter_1.PP05PosterGenAdapter)),
    __param(61, (0, common_1.Inject)(pp06_credits_gen_adapter_1.PP06CreditsGenAdapter)),
    __param(62, (0, common_1.Inject)(qc01_visual_fidelity_adapter_1.QC01VisualFidelityAdapter)),
    __param(63, (0, common_1.Inject)(qc02_narrative_consistency_adapter_1.QC02NarrativeConsistencyAdapter)),
    __param(64, (0, common_1.Inject)(qc03_identity_continuity_adapter_1.QC03IdentityContinuityAdapter)),
    __param(65, (0, common_1.Inject)(qc04_compliance_scan_adapter_1.QC04ComplianceScanAdapter)),
    __param(66, (0, common_1.Inject)(qc05_technical_compliance_adapter_1.QC05TechnicalComplianceAdapter)),
    __param(67, (0, common_1.Inject)(qc06_flicker_detector_adapter_1.QC06FlickerDetectorAdapter)),
    __param(68, (0, common_1.Inject)(ce23_identity_lock_adapter_1.CE23IdentityLocalAdapter)),
    __param(69, (0, common_1.Inject)(audio_tts_local_adapter_1.AudioTTSLocalAdapter)),
    __metadata("design:paramtypes", [core_1.ModuleRef,
        engine_registry_service_1.EngineRegistry,
        novel_analysis_local_adapter_NEW_1.NovelAnalysisLocalAdapter,
        ce06_novel_parsing_adapter_1.CE06LocalAdapter,
        ce03_visual_density_adapter_1.CE03LocalAdapter,
        ce04_visual_enrichment_adapter_1.CE04LocalAdapter,
        video_merge_adapter_1.VideoMergeLocalAdapter,
        shot_render_local_adapter_1.ShotRenderLocalAdapter,
        shot_render_replicate_adapter_1.ShotRenderReplicateAdapter,
        shot_render_comfyui_adapter_1.ShotRenderComfyuiAdapter,
        shot_render_mps_adapter_1.ShotRenderMpsAdapter,
        shot_render_router_adapter_1.ShotRenderRouterAdapter,
        fusion_adapter_1.FusionAdapter,
        http_engine_adapter_1.HttpEngineAdapter,
        mock_engine_adapter_1.MockEngineAdapter,
        ce11_comfyui_adapter_1.CE11ComfyUIAdapter,
        g5_dialogue_binding_adapter_1.G5DialogueBindingAdapter,
        g5_semantic_motion_mapper_adapter_1.G5SemanticMotionMapperAdapter,
        g5_asset_layering_resolver_adapter_1.G5AssetLayeringResolverAdapter,
        translation_cloud_adapter_1.TranslationCloudAdapter,
        style_transfer_replicate_adapter_1.StyleTransferReplicateAdapter,
        character_gen_adapter_1.CharacterGenAdapter,
        scene_composition_adapter_1.SceneCompositionAdapter,
        emotion_analysis_adapter_1.EmotionAnalysisAdapter,
        dialogue_optimization_adapter_1.DialogueOptimizationAdapter,
        ce07_memory_update_adapter_1.CE07MemoryUpdateAdapter,
        ce01_narrative_structure_adapter_1.CE01NarrativeStructureAdapter,
        ce05_conflict_detector_adapter_1.CE05ConflictDetectorAdapter,
        ce08_character_arc_adapter_1.CE08CharacterArcAdapter,
        ce12_theme_extractor_adapter_1.CE12ThemeExtractorAdapter,
        ce13_pacing_analyzer_adapter_1.CE13PacingAnalyzerAdapter,
        ce14_narrative_climax_adapter_1.Ce14NarrativeClimaxAdapter,
        ce15_multi_char_scene_adapter_1.CE15MultiCharSceneAdapter,
        ce16_story_branch_coordinator_adapter_1.CE16StoryBranchCoordinatorAdapter,
        ce17_cultural_consistency_adapter_1.CE17CulturalConsistencyAdapter,
        ce09_security_adapter_1.CE09SecurityLocalAdapter,
        ce18_world_logic_validator_adapter_1.CE18WorldLogicValidatorAdapter,
        ce19_story_summary_gen_adapter_1.CE19StorySummaryGenAdapter,
        vg01_background_render_adapter_1.VG01BackgroundRenderAdapter,
        vg02_character_render_adapter_1.VG02CharacterRenderAdapter,
        vg03_lighting_engine_adapter_1.VG03LightingEngineAdapter,
        vg04_camera_path_adapter_1.VG04CameraPathAdapter,
        vg05_vfx_compositor_adapter_1.VG05VFXCompositorAdapter,
        vg06_skeletal_animation_adapter_1.VG06SkeletalAnimationAdapter,
        vg07_facial_expression_adapter_1.VG07FacialExpressionAdapter,
        vg08_advanced_lighting_adapter_1.VG08AdvancedLightingAdapter,
        vg09_hair_physics_adapter_1.VG09HairPhysicsAdapter,
        vg10_cloth_dynamics_adapter_1.VG10ClothDynamicsAdapter,
        vg11_particle_effects_adapter_1.VG11ParticleEffectsAdapter,
        vg12_dynamic_lighting_rig_adapter_1.VG12DynamicLightingRigAdapter,
        au01_voice_tts_adapter_1.AU01VoiceTTSAdapter,
        au02_bgm_gen_adapter_1.AU02BGMGenAdapter,
        au03_sfx_gen_adapter_1.AU03SFXGenAdapter,
        au04_audio_mix_adapter_1.AU04AudioMixAdapter,
        au05_environmental_reverb_adapter_1.AU05EnvironmentalReverbAdapter,
        au06_spatial_audio_adapter_1.AU06SpatialAudioAdapter,
        pp01_video_stitch_adapter_1.PP01VideoStitchAdapter,
        pp02_subtitle_overlay_adapter_1.PP02SubtitleOverlayAdapter,
        pp03_watermark_adapter_1.PP03WatermarkAdapter,
        pp04_hls_package_adapter_1.PP04HLSPackageAdapter,
        pp05_poster_gen_adapter_1.PP05PosterGenAdapter,
        pp06_credits_gen_adapter_1.PP06CreditsGenAdapter,
        qc01_visual_fidelity_adapter_1.QC01VisualFidelityAdapter,
        qc02_narrative_consistency_adapter_1.QC02NarrativeConsistencyAdapter,
        qc03_identity_continuity_adapter_1.QC03IdentityContinuityAdapter,
        qc04_compliance_scan_adapter_1.QC04ComplianceScanAdapter,
        qc05_technical_compliance_adapter_1.QC05TechnicalComplianceAdapter,
        qc06_flicker_detector_adapter_1.QC06FlickerDetectorAdapter,
        ce23_identity_lock_adapter_1.CE23IdentityLocalAdapter,
        audio_tts_local_adapter_1.AudioTTSLocalAdapter])
], EngineModule);
//# sourceMappingURL=engine.module.js.map