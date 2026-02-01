# Engine Matrix SSOT

本文件定义毛毛虫宇宙（Super Caterpillar）核心引擎矩阵的生产基线。所有引擎必须经过 Gate 验证并标记 Git Tag 后方可进入 **SEALED** 状态。

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
<!-- SSOT_TABLE:SEALED_END -->

## IN-PROGRESS (已实现/待封印)
<!-- SSOT_TABLE:INPROGRESS_BEGIN -->
| engine_key | job_type | state | ledger_required | audit_prefix | adapter_path | gate_path | seal_tag | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ce05_conflict_detector` | `CE05_DIRECTOR_CONTROL` | P1 | YES | CE05 | `apps/api/src/engines/adapters/ce05_conflict_detector.adapter.ts` | `tools/gate/gates/gate-ce05_m1_hard.sh` | - | 剧情冲突检测 |
| `shot_render_router` | `SHOT_RENDER` | P1 | YES | SR00 | `apps/api/src/engines/adapters/shot-render.router.adapter.ts` | `tools/gate/gates/gate-prod_slice_v1_real.sh` | - | 分发路由层 |
<!-- SSOT_TABLE:INPROGRESS_END -->

## PLANNED ENGINES (纯规划)
<!-- SSOT_TABLE:PLANNED_BEGIN -->
| engine_key | job_type | state | ledger_required | audit_prefix | adapter_path | gate_path | seal_tag | notes | expected_adapter_path | expected_gate_path |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ce14_narrative_climax` | `NOVEL_ANALYSIS` | PLAN | YES | CE14 |  |  |  | 高潮与反转识别 | `apps/api/src/engines/adapters/ce14_narrative_climax.adapter.ts` | `tools/gate/gates/gate_ce14_climax.sh` |
<!-- SSOT_TABLE:PLANNED_END -->

> **Note**: 本矩阵共包含 42 个引擎入口。PLANNED 列表中的引擎尚未实施，禁止在 Registry 中注册或存在实现文件。
