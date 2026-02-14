# Engine Matrix SSOT

本文件定义毛毛虫宇宙（Super Caterpillar）核心引擎矩阵的生产基线。所有引擎必须经过 Gate 验证并标记 Git Tag 后方给进入 **SEALED** 状态。

## SEALED ENGINES (已封印/正式生产)
<!-- SSOT_TABLE:SEALED_BEGIN -->
| engine_key | job_type | state | ledger_required | audit_prefix | adapter_path | gate_path | seal_tag | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ce01_narrative_structure` | `NOVEL_ANALYSIS` | P1 | YES | CE01 | `apps/api/src/engines/adapters/ce01_narrative_structure.adapter.ts` | `tools/gate/gates/gate-ce01_m1_hard.sh` | `seal/ce01_protocol_instantiation_20260110` | 叙事结构分析 |
| `ce02_identity_lock` | `CE02_IDENTITY_LOCK` | P1 | YES | CE02 | `apps/api/src/engines/adapters/ce23-identity.local.adapter.ts` | `tools/gate/gates/gate-ce02_identity_lock.sh` | `seal/ce02_mother_engine_adopt_ce03_ce04_20260110` | 角色形象锁定 (Alias to CE23); ALIAS_OF=ce23_identity_consistency |
| `ce03_visual_density` | `CE03_VISUAL_DENSITY` | P1 | YES | CE03 | `apps/api/src/engines/adapters/ce03.local.adapter.ts` | `tools/gate/gates/gate-p0-r2_ce02_ce03_real.sh` | `seal/p0_r2_ce02_ce03_real_20260114` | 视觉密度评估 |
| `ce04_visual_enrichment` | `CE04_VISUAL_ENRICHMENT` | P1 | YES | CE04 | `apps/api/src/engines/adapters/ce04.local.adapter.ts` | `tools/gate/gates/gate-p0-r3_ce02_ce04_real.sh` | `seal/p0_r3_ce02_ce04_real_20260114` | 视觉增强引擎 |
| `ce06_novel_parsing` | `CE06_NOVEL_PARSING` | P1 | YES | CE06 | `apps/api/src/engines/adapters/ce06.local.adapter.ts` | `tools/gate/gates/gate-ce06-story-parse-real.sh` | `seal/p0_r1_ce02_ce06_real_20260114` | 小说深度解析 |
| `ce10_timeline_compose` | `PIPELINE_TIMELINE_COMPOSE` | P1 | YES | CE10 | `apps/api/src/engines/adapters/ce04.local.adapter.ts` | `tools/gate/gates/gate-p0-r4_ce02_video_render_real.sh` | `seal/p0_r4_ce02_video_render_real_20260114` | 时间轴合成 |
| `ce11_shot_generator_real` | `CE11_SHOT_GENERATOR` | P1 | YES | CE11 | `apps/api/src/engines/adapters/shot-render.router.adapter.ts` | `tools/gate/gates/gate-ce11-shot-generator-real.sh` | `seal/ce11_real_p5_sealed_20260119` | 分镜视频生成 (Real) |
| `ce23_identity_consistency` | `CE23_IDENTITY_CONSISTENCY` | P1 | YES | CE23 | `apps/api/src/engines/adapters/ce23-identity.local.adapter.ts` | `tools/gate/gates/gate-ce23-identity-consistency-real.sh` | `seal/ce23_p13_0_20260120` | 最终形象一致性校验 |
| `au01_voice_tts` | `AUDIO` | P1 | YES | AU01 | `apps/api/src/engines/adapters/au01_voice_tts.adapter.ts` | `tools/gate/gates/gate-audio-real-tts-provider.sh` | `seal/p19_0_audio_golive_20260124` | 语音合成 (TTS) |
| `au02_bgm_gen` | `AUDIO` | P1 | YES | AU02 | `apps/api/src/engines/adapters/au02_bgm_gen.adapter.ts` | `tools/gate/gates/gate-audio-bgm-library.sh` | `seal/p19_0_audio_golive_20260124` | 背景音乐生成 (BGM) |
| `au03_sfx_gen` | `AUDIO` | P1 | YES | AU03 | `apps/api/src/engines/adapters/au03_sfx_gen.adapter.ts` | `tools/gate/gates/gate-audio-multi-library.sh` | `seal/p19_0_audio_golive_20260124` | 音效生成 (SFX) |
| `au04_audio_mix` | `AU_RENDER` | P1 | YES | AU04 | `apps/api/src/engines/adapters/au04_audio_mix.adapter.ts` | `tools/gate/gates/gate-audio-production-mix.sh` | `seal/p19_0_audio_golive_20260124` | 自动化混音 |
| `video_merge` | `VIDEO_RENDER` | P1 | YES | VM01 | `apps/api/src/engines/adapters/video-merge.local.adapter.ts` | `tools/gate/gates/gate-p0-r1_video_merge_real.sh` | `p0-video-merge-v2-sealed-20260109` | 视频硬合并 |
| `pp04_hls_package` | `PP_RENDER` | P1 | NO | PP04 | `apps/api/src/engines/adapters/pp04_hls_package.adapter.ts` | `tools/gate/gates/gate-p4-e2e-novel-to-published-hls.sh` | `seal/p4_gate11_e2e_published_hls_20260117` | HLS 切片分发包装 |
| `qc01_visual_fidelity` | `QC_CHECK` | P1 | NO | QC01 | `apps/api/src/engines/adapters/qc01_visual_fidelity.adapter.ts` | `tools/gate/gates/gate_p3_qc_batch_v1.sh` | `seal/p3_3_qc_deterministic_20260201` | 视觉忠诚度 QC (ffprobe) |
| `qc02_narrative_consistency` | `QC_CHECK` | P1 | NO | QC02 | `apps/api/src/engines/adapters/qc02_narrative_consistency.adapter.ts` | `tools/gate/gates/gate_p3_qc_batch_v1.sh` | `seal/p3_3_qc_deterministic_20260201` | 叙事连贯性 QC (schema) |
| `qc03_identity_continuity` | `QC_CHECK` | P1 | NO | QC03 | `apps/api/src/engines/adapters/qc03_identity_continuity.adapter.ts` | `tools/gate/gates/gate_p3_qc_batch_v1.sh` | `seal/p3_3_qc_deterministic_20260201` | 形象一致性 QC (score) |
| `qc04_compliance_scan` | `QC_CHECK` | P1 | NO | QC04 | `apps/api/src/engines/adapters/qc04_compliance_scan.adapter.ts` | `tools/gate/gates/gate_p3_qc_batch_v1.sh` | `seal/p3_3_qc_deterministic_20260201` | 内容合规性 QC (rules) |
| `emotion_analysis` | `CE06_NOVEL_PARSING` | P1 | YES | EA01 | `apps/api/src/engines/adapters/emotion_analysis.adapter.ts` | `tools/gate/gates/gate_emotion_analysis.sh` | `seal/p3_4_promote_20260201_154257_misc` | 情感与反馈分析 |
| `dialogue_optimization` | `CE06_NOVEL_PARSING` | P1 | YES | DO01 | `apps/api/src/engines/adapters/dialogue_optimization.adapter.ts` | `tools/gate/gates/gate_dialogue_optimization.sh` | `seal/p3_4_promote_20260201_154257_misc` | 对话润色与本土化 |
| `g5_dialogue_binding` | `AUDIO` | P1 | YES | G501 | `apps/api/src/engines/adapters/g5-dialogue-binding.adapter.ts` | `tools/gate/gates/g5_b_E0001_real.sh` | `seal/p3_4_promote_20260201_154257_g5` | 语义对话绑定 |
| `g5_semantic_motion` | `SHOT_RENDER` | P1 | YES | G502 | `apps/api/src/engines/adapters/g5-semantic-motion-mapper.adapter.ts` | `tools/gate/gates/g5_b_E0001_real.sh` | `seal/p3_4_promote_20260201_154257_g5` | 动作原语合成 |
| `g5_asset_layering` | `SHOT_RENDER` | P1 | YES | G503 | `apps/api/src/engines/adapters/g5-asset-layering-resolver.adapter.ts` | `tools/gate/gates/g5_b_E0001_real.sh` | `seal/p3_4_promote_20260201_154257_g5` | 动态图层解算 |
| `ce08_character_arc` | `CE08_STORY_KG` | SEALED | YES | CE08 | `apps/api/src/engines/adapters/ce08_character_arc.adapter.ts` | `tools/gate/gates/gate_ce08_character_arc.sh` | `seal/p3_4_2_promote_pass1_ce_20260201_194738` | 角色弧光追踪 |
| `ce12_theme_extractor` | `NOVEL_ANALYSIS` | SEALED | YES | CE12 | `apps/api/src/engines/adapters/ce12_theme_extractor.adapter.ts` | `tools/gate/gates/gate_ce12_theme_extractor.sh` | `seal/p3_4_2_promote_pass1_ce_20260201_194738` | 主题基调提取 |
| `ce13_pacing_analyzer` | `NOVEL_ANALYSIS` | SEALED | YES | CE13 | `apps/api/src/engines/adapters/ce13_pacing_analyzer.adapter.ts` | `tools/gate/gates/gate_ce13_pacing_analyzer.sh` | `seal/p3_4_2_promote_pass1_ce_20260201_194738` | 节奏与张力分析 |
| `vg01_background_render` | `VG_RENDER` | SEALED | YES | VG01 | `apps/api/src/engines/adapters/vg01_background_render.adapter.ts` | `tools/gate/gates/gate_p3_vg_batch_v1.sh` | `seal/p3_4_2_promote_pass1_vg_20260201_194738` | 背景高精渲染 |
| `vg02_character_render` | `VG_RENDER` | SEALED | YES | VG02 | `apps/api/src/engines/adapters/vg02_character_render.adapter.ts` | `tools/gate/gates/gate_p3_vg_batch_v1.sh` | `seal/p3_4_2_promote_pass1_vg_20260201_194738` | 角色高精渲染 |
| `vg03_lighting_engine` | `VG_RENDER` | SEALED | YES | VG03 | `apps/api/src/engines/adapters/vg03_lighting_engine.adapter.ts` | `tools/gate/gates/gate_p3_vg_batch_v1.sh` | `seal/p3_4_2_promote_pass1_vg_20260201_194738` | AI 灯光系统 |
| `vg04_camera_path` | `VG_RENDER` | SEALED | YES | VG04 | `apps/api/src/engines/adapters/vg04_camera_path.adapter.ts` | `tools/gate/gates/gate_p3_vg_batch_v1.sh` | `seal/p3_4_2_promote_pass1_vg_20260201_194738` | 自动化相机运镜 |
| `vg05_vfx_compositor` | `VG_RENDER` | SEALED | YES | VG05 | `apps/api/src/engines/adapters/vg05_vfx_compositor.adapter.ts` | `tools/gate/gates/gate_p3_vg_batch_v1.sh` | `seal/p3_4_2_promote_pass1_vg_20260201_194738` | 特效合成引擎 |
| `pp01_video_stitch` | `PP_RENDER` | SEALED | YES | PP01 | `apps/api/src/engines/adapters/pp01_video_stitch.adapter.ts` | `tools/gate/gates/gate_p3_pp_batch_v1.sh` | `seal/p3_4_2_promote_pass1_pp_20260201_194738` | 工业级视频拼接 |
| `pp02_subtitle_overlay` | `PP_RENDER` | SEALED | YES | PP02 | `apps/api/src/engines/adapters/pp02_subtitle_overlay.adapter.ts` | `tools/gate/gates/gate_p3_pp_batch_v1.sh` | `seal/p3_4_2_promote_pass1_pp_20260201_194738` | 自动化字幕压制 |
| `pp03_watermark` | `PP_RENDER` | SEALED | YES | PP03 | `apps/api/src/engines/adapters/pp03_watermark.adapter.ts` | `tools/gate/gates/gate_p3_pp_batch_v1.sh` | `seal/p3_4_2_promote_pass1_pp_20260201_194738` | 版权隐形水印 |
| `ce07_memory_update` | `CE07_MEMORY_UPDATE` | SEALED | YES | CE07 | `apps/api/src/engines/adapters/ce07_memory_update.local.adapter.ts` | `tools/gate/gates/gate_ce07_memory_update.sh` | `seal/p3_4_2_promote_pass2_20260201_204451` | 故事长程记忆更新 |
| `translation_engine` | `CE06_NOVEL_PARSING` | SEALED | YES | TR01 | `apps/api/src/engines/adapters/translation.cloud.adapter.ts` | `tools/gate/gates/gate_translation_engine.sh` | `seal/p3_4_2_promote_pass2_20260201_204451` | 多语言云端翻译 |
| `style_transfer` | `SHOT_RENDER` | SEALED | YES | ST01 | `apps/api/src/engines/adapters/style-transfer.replicate.adapter.ts` | `tools/gate/gates/gate_style_transfer.sh` | `seal/p3_4_2_promote_pass2_20260201_204451` | 风格迁移与艺术化 |
| `character_gen` | `CE02_IDENTITY_LOCK` | SEALED | YES | CG01 | `apps/api/src/engines/adapters/character_gen.adapter.ts` | `tools/gate/gates/gate_character_gen.sh` | `seal/p3_4_2_promote_pass2_20260201_204451` | 角色基座资产生成 |
| `scene_composition` | `SHOT_RENDER` | SEALED | YES | SC01 | `apps/api/src/engines/adapters/scene_composition.adapter.ts` | `tools/gate/gates/gate_scene_composition.sh` | `seal/p3_4_2_promote_pass2_20260201_204451` | 场景布局合成 |
| `shot_render_router` | `SHOT_RENDER` | SEALED | YES | SR00 | `apps/api/src/engines/adapters/shot-render.router.adapter.ts` | `tools/gate/gates/gate-prod_slice_v1_real.sh` | `seal/p3_4_2_promote_pass2_20260201_235003` | 分发路由层 |
| `ce05_conflict_detector` | `CE05_DIRECTOR_CONTROL` | SEALED | YES | CE05 | `apps/api/src/engines/adapters/ce05_conflict_detector.adapter.ts` | `tools/gate/gates/gate-ce05_m1_hard.sh` | `seal/gate41_ce05_promote_20260202_204746` | 剧情冲突检测 |
| `ce14_narrative_climax` | `NOVEL_ANALYSIS` | SEALED | YES | CE14 | `apps/api/src/engines/adapters/ce14_narrative_climax.adapter.ts` | `tools/gate/gates/gate_ce14_climax.sh` | `seal/gate42_ce14_promote_20260202_213304` | 高潮与反转识别 |
| `vg06_skeletal_animation` | `VG_RENDER` | SEALED | YES | VG06 | `apps/api/src/engines/adapters/vg06_skeletal_animation.adapter.ts` | `tools/gate/gates/gate-vg06-skeletal-animation.sh` | `seal/p0_vg06_skeletal_20260214` | 2D骨骼动画生成与绑定 |
| `vg07_facial_expression` | `VG_RENDER` | SEALED | YES | VG07 | `apps/api/src/engines/adapters/vg07_facial_expression.adapter.ts` | `tools/gate/gates/gate-vg07-facial-expression.sh` | `seal/p0_vg07_facial_20260214` | 基于情感的面部表情生成 |
| `ce15_multi_char_scene` | `NOVEL_ANALYSIS` | SEALED | YES | CE15 | `apps/api/src/engines/adapters/ce15_multi_char_scene.adapter.ts` | `tools/gate/gates/gate-ce15-multi-char-scene.sh` | `seal/p0_ce15_multi_char_20260214` | 多角色场景协调计划 |
| `vg08_advanced_lighting` | `VG_RENDER` | SEALED | YES | VG08 | `apps/api/src/engines/adapters/vg08_advanced_lighting.adapter.ts` | `tools/gate/gates/gate-vg08-advanced-lighting.sh` | `seal/p0_vg08_lighting_20260214` | 基于物理的高级光照渲染 |
| `vg09_hair_physics` | `VG_RENDER` | SEALED | YES | VG09 | `apps/api/src/engines/adapters/vg09_hair_physics.adapter.ts` | `tools/gate/gates/gate-vg09-hair-physics.sh` | `seal/p1_vg09_hair_20260214` | 头发物理模拟 |
| `vg10_cloth_dynamics` | `VG_RENDER` | SEALED | YES | VG10 | `apps/api/src/engines/adapters/vg10_cloth_dynamics.adapter.ts` | `tools/gate/gates/gate-vg10-cloth-dynamics.sh` | `seal/p1_vg10_cloth_20260214` | 布料动力学模拟 |
| `vg11_particle_effects` | `VG_RENDER` | SEALED | YES | VG11 | `apps/api/src/engines/adapters/vg11_particle_effects.adapter.ts` | `tools/gate/gates/gate-vg11-particle-effects.sh` | `seal/p1_vg11_vfx_20260214` | 粒子特效系统 |
| `ce16_story_branch_coordinator` | `NOVEL_ANALYSIS` | SEALED | YES | CE16 | `apps/api/src/engines/adapters/ce16_story_branch_coordinator.adapter.ts` | `tools/gate/gates/gate-ce16-story-branch-coordinator.sh` | `seal/p1_ce16_story_20260214` | 故事分支协调 |
| `ce17_cultural_consistency` | `NOVEL_ANALYSIS` | SEALED | YES | CE17 | `apps/api/src/engines/adapters/ce17_cultural_consistency.adapter.ts` | `tools/gate/gates/gate-ce17-cultural-consistency.sh` | `seal/p1_ce17_culture_20260214` | 文化一致性校验 |
| `ce18_world_logic_validator` | `NOVEL_ANALYSIS` | SEALED | YES | CE18 | `apps/api/src/engines/adapters/ce18_world_logic_validator.adapter.ts` | `tools/gate/gates/gate-ce18-world-logic-validator.sh` | `seal/p1_ce18_logic_20260214` | 世界观逻辑验证 |
| `au05_environmental_reverb` | `AU_RENDER` | SEALED | YES | AU05 | `apps/api/src/engines/adapters/au05_environmental_reverb.adapter.ts` | `tools/gate/gates/gate-au05-environmental-reverb.sh` | `seal/p1_au05_reverb_20260214` | 环境混响生成 |
| `qc05_technical_compliance` | `QC_CHECK` | SEALED | YES | QC05 | `apps/api/src/engines/adapters/qc05_technical_compliance.adapter.ts` | `tools/gate/gates/gate-qc05-technical-compliance.sh` | `seal/p1_qc05_spec_20260214` | 技术规格合规性 QC |
| `pp05_poster_gen` | `PP_RENDER` | SEALED | YES | PP05 | `apps/api/src/engines/adapters/pp05_poster_gen.adapter.ts` | `tools/gate/gates/gate-pp05-poster-gen.sh` | `seal/p1_pp05_poster_20260214` | 封面海报生成 |
| `pp06_credits_gen` | `PP_RENDER` | SEALED | YES | PP06 | `apps/api/src/engines/adapters/pp06_credits_gen.adapter.ts` | `tools/gate/gates/gate-pp06-credits-gen.sh` | `seal/p1_pp06_credits_20260214` | 演职人员表生成 |
| `au06_spatial_audio` | `AU_RENDER` | SEALED | YES | AU06 | `apps/api/src/engines/adapters/au06_spatial_audio.adapter.ts` | `tools/gate/gates/gate-au06-spatial-audio.sh` | `seal/p1_au06_spatial_20260214` | 空间音频映射 |
| `qc06_flicker_detector` | `QC_CHECK` | SEALED | YES | QC06 | `apps/api/src/engines/adapters/qc06_flicker_detector.adapter.ts` | `tools/gate/gates/gate-qc06-flicker-detector.sh` | `seal/p1_qc06_flicker_20260214` | 画面闪烁检测 QC |
| `ce19_story_summary_gen` | `NOVEL_ANALYSIS` | SEALED | YES | CE19 | `apps/api/src/engines/adapters/ce19_story_summary_gen.adapter.ts` | `tools/gate/gates/gate-ce19-story-summary-gen.sh` | `seal/p1_ce19_summary_20260214` | 故事大纲生成 |
| `vg12_dynamic_lighting_rig` | `VG_RENDER` | SEALED | YES | VG12 | `apps/api/src/engines/adapters/vg12_dynamic_lighting_rig.adapter.ts` | `tools/gate/gates/gate-vg12-dynamic-lighting-rig.sh` | `seal/p1_vg12_rig_20260214` | 动态灯光组编排 |
<!-- SSOT_TABLE:SEALED_END -->

## IN-PROGRESS ENGINES (开发中/验证中)
<!-- SSOT_TABLE:INPROGRESS_BEGIN -->
| engine_key | job_type | state | ledger_required | audit_prefix | adapter_path | gate_path | seal_tag | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
<!-- SSOT_TABLE:INPROGRESS_END -->

## PLANNED ENGINES (纯规划)
<!-- SSOT_TABLE:PLANNED_BEGIN -->
| engine_key | job_type | state | ledger_required | audit_prefix | adapter_path | gate_path | seal_tag | notes | expected_adapter_path | expected_gate_path |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
<!-- SSOT_TABLE:PLANNED_END -->

> **Note**: 本矩阵共包含 60 个已封印引擎入口。PLANNED 列表中的引擎尚未实施。

## MOCK ENGINE POLICY (Mock 引擎策略)

为确保商业环境的可靠性，系统实施了严格的 Mock 引擎隔离策略：

| 环境模式 (ENGINE_MODE) | Mock允许 | 行为说明 |
| :--- | :--- | :--- |
| `production` | ❌ 禁止 | 启动时严格检查，若发现注册了 Mock 适配器或使用 `mock` provider，抛出 `PRODUCTION_SAFETY_ERROR` 异常并终止启动。 |
| `development` | ⚠️ 警告 | 允许 Mock 适配器注册，但在日志中输出警告信息。默认模式。 |
| `test` | ✅ 允许 | 专用于 CI/CD 和 Gate 测试，允许使用所有 Mock 功能。 |

### 已移除的 Mock 适配器
- `ce11_shot_generator_mock`: 已被 `ce11_shot_generator_real` (Router) 全面取代，代码已物理删除。

### 保留的 Mock 适配器
- `MockEngineAdapter`: 通用 Mock 适配器，仅用于 `ENGINE_MODE!=production` 时的测试与验证。
