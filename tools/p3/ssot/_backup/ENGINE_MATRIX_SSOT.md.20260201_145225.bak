# Engine Matrix SSOT

本文件定义毛毛虫宇宙（Super Caterpillar）核心引擎矩阵的生产基线。所有引擎必须经过 Gate 验证并标记 Git Tag 后方可进入 **SEALED** 状态。

## SEALED ENGINES (已封印/正式生产)
<!-- SSOT_TABLE:SEALED_BEGIN -->
| engine_key | job_type | state | billing | audit_prefix | adapter_path | gate_path | seal_tag | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ce01_narrative_structure` | `NOVEL_ANALYSIS` | P1 | YES | CE01 | `ce01_narrative_structure.adapter.ts` | `gate-ce01_m1_hard.sh` | `seal/ce01_protocol_instantiation_20260110` | 叙事结构分析 |
| `ce02_identity_lock` | `CE02_IDENTITY_LOCK` | P1 | YES | CE02 | `ce23-identity.local.adapter.ts` | `gate-ce02_identity_lock.sh` | `seal/ce02_mother_engine_adopt_ce03_ce04_20260110` | 角色形象锁定 (Alias to CE23) |
| `ce03_visual_density` | `CE03_VISUAL_DENSITY` | P1 | YES | CE03 | `ce03.local.adapter.ts` | `gate-p0-r2_ce02_ce03_real.sh` | `seal/p0_r2_ce02_ce03_real_20260114` | 视觉密度评估 |
| `ce04_visual_enrichment` | `CE04_VISUAL_ENRICHMENT` | P1 | YES | CE04 | `ce04.local.adapter.ts` | `gate-p0-r3_ce02_ce04_real.sh` | `seal/p0_r3_ce02_ce04_real_20260114` | 视觉增强引擎 |
| `ce06_novel_parsing` | `CE06_NOVEL_PARSING` | P1 | YES | CE06 | `ce06.local.adapter.ts` | `gate-ce06-story-parse-real.sh` | `seal/p0_r1_ce02_ce06_real_20260114` | 小说深度解析 |
| `ce10_timeline_compose` | `PIPELINE_TIMELINE_COMPOSE` | P1 | YES | CE10 | `ce04.local.adapter.ts` | `gate-p0-r4_ce02_video_render_real.sh` | `seal/p0_r4_ce02_video_render_real_20260114` | 时间轴合成 |
| `ce11_shot_generator_real` | `CE11_SHOT_GENERATOR` | P1 | YES | CE11 | `shot-render.router.adapter.ts` | `gate-ce11-shot-generator-real.sh` | `seal/ce11_real_p5_sealed_20260119` | 分镜视频生成 (Real) |
| `ce23_identity_consistency` | `CE23_IDENTITY_CONSISTENCY` | P1 | YES | CE23 | `ce23-identity.local.adapter.ts` | `gate-ce23-identity-consistency-real.sh` | `seal/ce23_p13_0_20260120` | 最终形象一致性校验 |
| `au01_voice_tts` | `AUDIO` | P1 | YES | AU01 | `au01_voice_tts.adapter.ts` | `gate-audio-real-tts-provider.sh` | `seal/p19_0_audio_golive_20260124` | 语音合成 (TTS) |
| `au02_bgm_gen` | `AUDIO` | P1 | YES | AU02 | `au02_bgm_gen.adapter.ts` | `gate-audio-bgm-library.sh` | `seal/p19_0_audio_golive_20260124` | 背景音乐生成 (BGM) |
| `au03_sfx_gen` | `AUDIO` | P1 | YES | AU03 | `au03_sfx_gen.adapter.ts` | `gate-audio-multi-library.sh` | `seal/p19_0_audio_golive_20260124` | 音效生成 (SFX) |
| `au04_audio_mix` | `AU_RENDER` | P1 | YES | AU04 | `au04_audio_mix.adapter.ts` | `gate-audio-production-mix.sh` | `seal/p19_0_audio_golive_20260124` | 自动化混音 |
| `video_merge` | `VIDEO_RENDER` | P1 | YES | VM01 | `video-merge.local.adapter.ts` | `gate-p0-r1_video_merge_real.sh` | `p0-video-merge-v2-sealed-20260109` | 视频硬合并 |
| `pp04_hls_package` | `PP_RENDER` | P1 | NO | PP04 | `pp04_hls_package.adapter.ts` | `gate-p4-e2e-novel-to-published-hls.sh` | `seal/p4_gate11_e2e_published_hls_20260117` | HLS 切片分发包装 |
| `qc01_visual_fidelity` | `QC_CHECK` | P1 | NO | QC01 | `qc01_visual_fidelity.adapter.ts` | `gate_p3_qc_batch_v1.sh` | `seal/p3_3_qc_deterministic_20260201` | 视觉忠诚度 QC (ffprobe) |
| `qc02_narrative_consistency` | `QC_CHECK` | P1 | NO | QC02 | `qc02_narrative_consistency.adapter.ts` | `gate_p3_qc_batch_v1.sh` | `seal/p3_3_qc_deterministic_20260201` | 叙事连贯性 QC (schema) |
| `qc03_identity_continuity` | `QC_CHECK` | P1 | NO | QC03 | `qc03_identity_continuity.adapter.ts` | `gate_p3_qc_batch_v1.sh` | `seal/p3_3_qc_deterministic_20260201` | 形象一致性 QC (score) |
| `qc04_compliance_scan` | `QC_CHECK` | P1 | NO | QC04 | `qc04_compliance_scan.adapter.ts` | `gate_p3_qc_batch_v1.sh` | `seal/p3_3_qc_deterministic_20260201` | 内容合规性 QC (rules) |
<!-- SSOT_TABLE:SEALED_END -->

## IN-PROGRESS (已实现/待封印)
<!-- SSOT_TABLE:INPROGRESS_BEGIN -->
| engine_key | job_type | state | billing | audit_prefix | adapter_path | gate_path | seal_tag | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ce05_conflict_detector` | `CE05_DIRECTOR_CONTROL` | P1 | YES | CE05 | `ce05_conflict_detector.adapter.ts` | `gate-ce05_m1_hard.sh` | - | 剧情冲突检测 |
| `ce07_memory_update` | `CE07_MEMORY_UPDATE` | P1 | YES | CE07 | `ce07_memory_update.local.adapter.ts` | `gate_ce07_memory_update.sh` | - | 故事长程记忆更新 |
| `ce08_character_arc` | `CE08_STORY_KG` | P1 | YES | CE08 | `ce08_character_arc.adapter.ts` | `gate_ce08_character_arc.sh` | - | 角色弧光追踪 |
| `ce12_theme_extractor` | `NOVEL_ANALYSIS` | P1 | YES | CE12 | `ce12_theme_extractor.adapter.ts` | `gate_ce12_theme_extractor.sh` | - | 主题基调提取 |
| `ce13_pacing_analyzer` | `NOVEL_ANALYSIS` | P1 | YES | CE13 | `ce13_pacing_analyzer.adapter.ts` | `gate_ce13_pacing_analyzer.sh` | - | 节奏与张力分析 |
| `translation_engine` | `CE06_NOVEL_PARSING` | P1 | YES | TR01 | `translation.cloud.adapter.ts` | `gate_translation_engine.sh` | - | 多语言云端翻译 |
| `style_transfer` | `SHOT_RENDER` | P1 | YES | ST01 | `style-transfer.replicate.adapter.ts` | `gate_style_transfer.sh` | - | 风格迁移与艺术化 |
| `character_gen` | `CE02_IDENTITY_LOCK` | P1 | YES | CG01 | `character_gen.adapter.ts` | `gate_character_gen.sh` | - | 角色基座资产生成 |
| `scene_composition` | `SHOT_RENDER` | P1 | YES | SC01 | `scene_composition.adapter.ts` | `gate_scene_composition.sh` | - | 场景布局合成 |
| `emotion_analysis` | `CE06_NOVEL_PARSING` | P1 | YES | EA01 | `emotion_analysis.adapter.ts` | `gate_emotion_analysis.sh` | - | 情感与反馈分析 |
| `dialogue_optimization` | `CE06_NOVEL_PARSING` | P1 | YES | DO01 | `dialogue_optimization.adapter.ts` | `gate_dialogue_optimization.sh` | - | 对话润色与本土化 |
| `vg01_background_render` | `VG_RENDER` | P1 | YES | VG01 | `vg01_background_render.adapter.ts` | `gate_p3_vg_batch_v1.sh` | - | 背景高精渲染 |
| `vg02_character_render` | `VG_RENDER` | P1 | YES | VG02 | `vg02_character_render.adapter.ts` | `gate_p3_vg_batch_v1.sh` | - | 角色高精渲染 |
| `vg03_lighting_engine` | `VG_RENDER` | P1 | YES | VG03 | `vg03_lighting_engine.adapter.ts` | `gate_p3_vg_batch_v1.sh` | - | AI 灯光系统 |
| `vg04_camera_path` | `VG_RENDER` | P1 | YES | VG04 | `vg04_camera_path.adapter.ts` | `gate_p3_vg_batch_v1.sh` | - | 自动化相机运镜 |
| `vg05_vfx_compositor` | `VG_RENDER` | P1 | YES | VG05 | `vg05_vfx_compositor.adapter.ts` | `gate_p3_vg_batch_v1.sh` | - | 特效合成引擎 |
| `pp01_video_stitch` | `PP_RENDER` | P1 | YES | PP01 | `pp01_video_stitch.adapter.ts` | `gate_p3_pp_batch_v1.sh` | - | 工业级视频拼接 |
| `pp02_subtitle_overlay` | `PP_RENDER` | P1 | YES | PP02 | `pp02_subtitle_overlay.adapter.ts` | `gate_p3_pp_batch_v1.sh` | - | 自动化字幕压制 |
| `pp03_watermark` | `PP_RENDER` | P1 | YES | PP03 | `pp03_watermark.adapter.ts` | `gate_p3_pp_batch_v1.sh` | - | 版权隐形水印 |
| `g5_dialogue_binding` | `AUDIO` | P1 | YES | G501 | `g5-dialogue-binding.adapter.ts` | `g5_b_E0001_real.sh` | - | 语义对话绑定 |
| `g5_semantic_motion` | `SHOT_RENDER` | P1 | YES | G502 | `g5-semantic-motion-mapper.adapter.ts` | `g5_b_E0001_real.sh` | - | 动作原语合成 |
| `g5_asset_layering` | `SHOT_RENDER` | P1 | YES | G503 | `g5-asset-layering-resolver.adapter.ts` | `g5_b_E0001_real.sh` | - | 动态图层解算 |
| `shot_render_router` | `SHOT_RENDER` | P1 | YES | SR00 | `shot-render.router.adapter.ts` | `gate-prod_slice_v1_real.sh` | - | 分发路由层 |
<!-- SSOT_TABLE:INPROGRESS_END -->

## PLANNED ENGINES (纯规划)
<!-- SSOT_TABLE:PLANNED_BEGIN -->
| engine_key | job_type | state | billing | audit_prefix | adapter_path | gate_path | seal_tag | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ce14_narrative_climax` | `NOVEL_ANALYSIS` | PLAN | YES | CE14 | `ce14_narrative_climax.adapter.ts` | `gate_ce14_climax.sh` | - | 高潮与反转识别 |
<!-- SSOT_TABLE:PLANNED_END -->

> **Note**: 本矩阵共包含 42 个引擎入口。PLANNED 列表中的引擎尚未实施，禁止在 Registry 中注册或存在实现文件。
