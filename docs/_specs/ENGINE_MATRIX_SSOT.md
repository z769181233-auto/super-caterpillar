# ENGINE_MATRIX_SSOT.md - 引擎矩阵单一真源

> **版本**: 1.2.0  
> **更新时间**: 2026-01-23  
> **状态**: ACTIVE

---

## 概述

本文件是毛毛虫宇宙所有引擎的**唯一真源（SSOT）**。任何引擎的新增、修改、封印都必须同步更新此文件。

---

## 引擎清单 (Engine Inventory)

### 1. 已封印引擎 (SEALED ENGINES)

> [!IMPORTANT]
> **完成条件**：`规划中引擎 (PLANNED ENGINES)` 表为空 && `迭代中引擎 (IN-PROGRESS ENGINES)` 表为空。
> 任何新引擎代码实现前必须先入 `PLANNED` 表，否则门禁合规检查将失败。

| EngineKey                   | JobType                   | 实现状态              | 计费模型                                 | 审计 Action 前缀     | Gate 脚本                                | 封印 Tag                                       | 备注                                                                                                                                                       |
| --------------------------- | ------------------------- | --------------------- | ---------------------------------------- | -------------------- | ---------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ce06_novel_parsing`        | CE06_NOVEL_PARSING        | LEGACY (Monolithic)   | router-based                             | `CE%`                | `gate-ce06-story-parse-real.sh`          | `legacy_monolithic`                            | **DEPRECATED**: Use SCAN/CHUNK                                                                                                                             |
| `ce06_scan_toc`             | NOVEL_SCAN_TOC            | REAL (Streaming)      | file-size-based                          | `ce06.scan`          | `gate-stage4-scale.sh`                   | `seal/stage4_scale_verified_20260116`          | **NEW**: Table of Contents Scanner                                                                                                                         |
| `ce06_chunk_parse`          | NOVEL_CHUNK_PARSE         | REAL (Streaming)      | file-size-based                          | `ce06.parse`         | `gate-stage4-scale.sh`                   | `seal/stage4_scale_verified_20260116`          | **NEW**: Chapter Content Parser                                                                                                                            |
| `ce02_identity_lock`        | CE02_IDENTITY_LOCK        | REAL (Postgres/Redis) | router-based                             | `ID%`                | `gate-ce02_identity_lock.sh`             | `seal/phase5D_identity_regression_20260116_v1` | **NEW**: Identity Consistency Anchor                                                                                                                       |
| `ce07_memory_update`        | CE07_MEMORY_UPDATE        | REAL (Postgres)       | ledger_required                          | `CE%`                | `gate_ce07_memory_update.sh`             | `seal/ce07_memory_update_20260201`             | **NEW**: P1 Memory Consistency Engine. Cost: MISS=1 HIT=0                                                                                                  |
| `shot_preview`              | SHOT_PREVIEW              | REAL (Redis+Render)   | ledger_required                          | `CE%`                | `gate_shot_preview_fast.sh`              | `seal/shot_preview_fast_20260201_v2`           | **NEW**: P1 Fast Preview (<1s cache, 0 secret, Real File). Cost: MISS=1 HIT=0                                                              |
| `ce03_visual_density`       | CE03_VISUAL_DENSITY       | REAL (Heuristic)      | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`          | `seal/phase3_commercial_e2e_hard_20260113_153210`     |                                                                                                                                                            |
| `ce04_visual_enrichment`    | CE04_VISUAL_ENRICHMENT    | REAL (Template)       | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`          | `seal/phase3_commercial_e2e_hard_20260113_153210`     |                                                                                                                                                            |
| `shot_render`               | SHOT_RENDER               | REAL (Verified)       | gpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-shot-render-preview.sh`            | `seal/p13_1_shot_preview_20260121`             | **P13-1**: Verified via Preview Loop                                                                                                                       |
| `video_merge`               | VIDEO_MERGE               | REAL                  | cpuSeconds (priced via PRICING_SSOT)     | `engine.video_merge` | `gate-p0-r1_video_merge_real.sh`         | `video_merge_local_ffmpeg_sealed_20260109`     | LEGACY: Compatible with V1.0                                                                                                                               |
| `ce10_timeline_compose`     | TIMELINE_COMPOSE          | REAL                  | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`          | `seal/phase3_commercial_e2e_hard_20260113_153210`     |                                                                                                                                                            |
| `ce11_timeline_preview`     | TIMELINE_PREVIEW          | REAL                  | cpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-phase3-commercial-e2e.sh`          | `seal/phase3_commercial_e2e_hard_20260113_153210`     |                                                                                                                                                            |
| `ce11_shot_generator_real`  | CE11_SHOT_GENERATOR       | REAL (ComfyUI)        | gpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-ce11-shot-generator-real.sh`       | `seal/ce11_real_p5_sealed_20260119`            | **P5-NEW**: Explicit Real Routing                                                                                                                          |
| `ce23_identity_consistency` | CE23_IDENTITY_CONSISTENCY | REAL (PPV-64)         | router-based (internal)                  | `ID%`                | `gate-ce23-identity-consistency-real.sh` | `seal/p15_0_ce23_real_ppv64_20260123`          | **P15-0**: Content-based Real Scoring (PPV-64)                                                                                                             |
| `audio_tts`                 | TIMELINE_RENDER (Sub)     | REAL (Production)     | router-based (internal)                  | `CE%`                | `gate-audio-p21-0-ops.sh`                | `seal/p21_0_audio_ops_integration_20260124`    | **P21-0**: Ops Integration Sealed. Dashboard Snapshot + Health Heartbeat + Auto-Diagnostic verified. Evidence: `p21_0_ops_integration_1769309936_gesrrand` |
| `audio_bgm`                 | TIMELINE_RENDER (Sub)     | REAL (Production)     | router-based (internal)                  | `CE%`                | `gate-audio-p21-0-ops.sh`                | `seal/p21_0_audio_ops_integration_20260124`    | **P21-0**: Ops Integration Sealed.                                                                                                                         |
| `g5_video_render`           | VIDEO_RENDER (G5)         | REAL (Production)     | gpuSeconds (priced via PRICING_SSOT)     | `G5%`                | `g5_b_E0001_real.sh`                     | `seal/g5_b_E0001_real_20260129`                | **G5-M1**: 15s Orbit Proof achieved. 1440p High-Fi, 3-View View Routing, Grounding Shadows.                                                                |
| `translation_engine`        | TRANSLATION (P1)          | REAL-STUB (Provider-pluggable) | ledger_required                          | `TRANSLATION`        | `gate_translation_engine.sh`             | `seal/translation_engine_20260201`             | **P1.1**: Pluggable (DeepL/Stub), Content-Hash Cache. Cost: MISS=1 HIT=0. Evidence: `docs/_evidence/translation_engine_v1`                      |
| `style_transfer`            | STYLE_TRANSFER (P1)       | REAL-STUB (Provider-pluggable) | ledger_required                          | `STYLE`              | `gate_style_transfer.sh`                 | `seal/style_transfer_20260201`                 | **P1.2**: Pluggable (Stub/Replicate), Redis Cache, No-Key Fail verified. Evidence: `docs/_evidence/style_transfer_v1`                             |
| `character_gen`             | CHARACTER_GEN (P2)        | REAL-STUB (Provider-pluggable) | ledger_required                          | `CHAR`               | `gate_character_gen.sh`                  | `seal/character_gen_20260201`                  | **P2.1**: Pluggable (Stub/Replicate), Redis Cache, No-Key Fail verified. Evidence: `docs/_evidence/character_gen_v1`                              |
| `scene_composition`         | SCENE_COMPOSITION (P2)    | REAL-STUB (FFmpeg)    | ledger_required                          | `SCENE`              | `gate_scene_composition.sh`              | `seal/scene_composition_20260201`              | **P2.2**: FFmpeg Layering (Overlay), Redis Cache. Evidence: `docs/_evidence/scene_composition_v1`                                                 |
| `emotion_analysis`          | NOVEL_ANALYSIS (P2)       | REAL-STUB (Regex)     | job (priced via PRICING_SSOT)            | `EMO`                | `gate_emotion_analysis.sh`               | `seal/emotion_analysis_20260201`               | **P2.3**: Cache/Stub, Audit/Cost Verified. Evidence: `docs/_evidence/emotion_analysis_v1`                                                         |
| `dialogue_optimization`     | NOVEL_ANALYSIS (P2)       | REAL-STUB (Regex)     | job (priced via PRICING_SSOT)            | `DIA`                | `gate_dialogue_optimization.sh`          | `seal/dialogue_optimization_20260201`          | **P2.4**: Cache/Stub, Audit/Cost Verified. Evidence: `docs/_evidence/dialogue_optimization_v1`                                                    |
| `ce01_narrative_structure`  | NOVEL_ANALYSIS (P3)       | REAL-STUB (Regex)     | job                                      | `CE%`                | `gate_p3_ce_batch_v2.sh`                 | `seal/p3_ce_batch_ce01_ce05_20260201`          | **P3.2**: Story beat analysis. Evidence: `docs/_evidence/p3_ce_batch_20260201`                                                                             |
| `ce05_conflict_detector`    | NOVEL_ANALYSIS (P3)       | REAL-STUB (Regex)     | job                                      | `CE%`                | `gate_p3_ce_batch_v2.sh`                 | `seal/p3_ce_batch_ce01_ce05_20260201`          | **P3.2**: Conflict detection. Evidence: `docs/_evidence/p3_ce_batch_20260201`                                                                              |
| `ce08_character_arc`       | NOVEL_ANALYSIS (P3)       | REAL-STUB (Regex)     | job                                      | `CE%`                | `gate_p3_ce_batch_v2.sh`                 | `seal/p3_ce_batch_v2_20260201`                 | **P3.3**: Character arc progression. Evidence: `docs/_evidence/p3_ce_batch_v2_20260201`                                                                    |
| `ce12_theme_extractor`      | NOVEL_ANALYSIS (P3)       | REAL-STUB (Regex)     | job                                      | `CE%`                | `gate_p3_ce_batch_v2.sh`                 | `seal/p3_ce_batch_v2_20260201`                 | **P3.3**: Theme & motif extraction. Evidence: `docs/_evidence/p3_ce_batch_v2_20260201`                                                                     |
| `ce13_pacing_analyzer`      | NOVEL_ANALYSIS (P3)       | REAL-STUB (Regex)     | job                                      | `CE%`                | `gate_p3_ce_batch_v2.sh`                 | `seal/p3_ce_batch_v2_20260201`                 | **P3.3**: Narrative pacing analysis. Evidence: `docs/_evidence/p3_ce_batch_v2_20260201`                                                                    |
| `vg01_background_render`   | VG_RENDER (P3)            | REAL-STUB (FFmpeg)    | ledger_required                          | `VG%`                | `gate_p3_vg_batch_v1.sh`                 | `seal/vg01_background_render_20260201`         | **P3.2A**: Background generation. Evidence: `docs/_evidence/p3_vg_batch_v1_20260201`                                                                      |
| `vg02_character_render`    | VG_RENDER (P3)            | REAL-STUB (FFmpeg)    | ledger_required                          | `VG%`                | `gate_p3_vg_batch_v1.sh`                 | `seal/vg02_character_render_20260201`          | **P3.2A**: Character rendering. Evidence: `docs/_evidence/p3_vg_batch_v1_20260201`                                                                         |
| `vg03_lighting_engine`     | VG_RENDER (P3)            | REAL-STUB (FFmpeg)    | ledger_required                          | `VG%`                | `gate_p3_vg_batch_v1.sh`                 | `seal/vg03_lighting_engine_20260201`           | **P3.2A**: Lighting effects. Evidence: `docs/_evidence/p3_vg_batch_v1_20260201`                                                                            |
| `vg04_camera_path`         | VG_RENDER (P3)            | REAL-STUB (JSON)      | ledger_required                          | `VG%`                | `gate_p3_vg_batch_v1.sh`                 | `seal/vg04_camera_path_20260201`               | **P3.2A**: Camera path generation. Evidence: `docs/_evidence/p3_vg_batch_v1_20260201`                                                                     |
| `vg05_vfx_compositor`      | VG_RENDER (P3)            | REAL-STUB (FFmpeg)    | ledger_required                          | `VG%`                | `gate_p3_vg_batch_v1.sh`                 | `seal/vg05_vfx_compositor_20260201`            | **P3.2A**: VFX composition. Evidence: `docs/_evidence/p3_vg_batch_v1_20260201`                                                                            |
| `au01_voice_tts` | AU_RENDER (P3) | REAL-STUB (FFmpeg) | ledger_required | `AU%` | `gate_p3_au_batch_v1.sh` | `seal/au_batch_v1_20260201` | **P3.2D**: Voice TTS. Evidence: `docs/_evidence/p3_au_batch_v1_20260201` |
| `au02_bgm_gen` | AU_RENDER (P3) | REAL-STUB (FFmpeg) | ledger_required | `AU%` | `gate_p3_au_batch_v1.sh` | `seal/au_batch_v1_20260201` | **P3.2D**: BGM Generation. Evidence: `docs/_evidence/p3_au_batch_v1_20260201` |
| `au03_sfx_gen` | AU_RENDER (P3) | REAL-STUB (FFmpeg) | ledger_required | `AU%` | `gate_p3_au_batch_v1.sh` | `seal/au_batch_v1_20260201` | **P3.2D**: SFX Generation. Evidence: `docs/_evidence/p3_au_batch_v1_20260201` |
| `au04_audio_mix` | AU_RENDER (P3) | REAL-STUB (FFmpeg) | ledger_required | `AU%` | `gate_p3_au_batch_v1.sh` | `seal/au_batch_v1_20260201` | **P3.2D**: Audio Mixing. Evidence: `docs/_evidence/p3_au_batch_v1_20260201` |
| `pp01_video_stitch` | PP_RENDER (P3) | REAL-STUB (FFmpeg) | ledger_required | `PP%` | `gate_p3_pp_batch_v1.sh` | `seal/pp_batch_v1_20260201` | **P3.2D**: Video Stitching. Evidence: `docs/_evidence/p3_pp_batch_v1_20260201` |
| `pp02_subtitle_overlay` | PP_RENDER (P3) | REAL-STUB (FFmpeg) | ledger_required | `PP%` | `gate_p3_pp_batch_v1.sh` | `seal/pp_batch_v1_20260201` | **P3.2D**: Subtitle Overlay. Evidence: `docs/_evidence/p3_pp_batch_v1_20260201` |
| `pp03_watermark` | PP_RENDER (P3) | REAL-STUB (FFmpeg) | ledger_required | `PP%` | `gate_p3_pp_batch_v1.sh` | `seal/pp_batch_v1_20260201` | **P3.2D**: Watermarking. Evidence: `docs/_evidence/p3_pp_batch_v1_20260201` |
| `pp04_hls_package` | PP_RENDER (P3) | REAL-STUB (FFmpeg) | ledger_required | `PP%` | `gate_p3_pp_batch_v1.sh` | `seal/pp_batch_v1_20260201` | **P3.2D**: HLS Packaging. Evidence: `docs/_evidence/p3_pp_batch_v1_20260201` |
| `qc01_visual_fidelity` | QC_CHECK (P3) | REAL-STUB (Deterministic) | ledger_required | `QC%` | `gate_p3_qc_batch_v1.sh` | `seal/qc_batch_v1_20260201` | **P3.2D**: Visual fidelity check (FFprobe). Evidence: `docs/_evidence/p3_qc_batch_v1_20260201` |
| `qc02_narrative_consistency` | QC_CHECK (P3) | REAL-STUB (Deterministic) | ledger_required | `QC%` | `gate_p3_qc_batch_v1.sh` | `seal/qc_batch_v1_20260201` | **P3.2D**: Narrative consistency check (Field Valid). Evidence: `docs/_evidence/p3_qc_batch_v1_20260201` |
| `qc03_identity_continuity` | QC_CHECK (P3) | REAL-STUB (Deterministic) | ledger_required | `QC%` | `gate_p3_qc_batch_v1.sh` | `seal/qc_batch_v1_20260201` | **P3.2D**: Identity continuity check (Score Assert). Evidence: `docs/_evidence/p3_qc_batch_v1_20260201` |
| `qc04_compliance_scan` | QC_CHECK (P3) | REAL-STUB (Deterministic) | ledger_required | `QC%` | `gate_p3_qc_batch_v1.sh` | `seal/qc_batch_v1_20260201` | **P3.2D**: Compliance scan (Keyword scan). Evidence: `docs/_evidence/p3_qc_batch_v1_20260201` |

### 2. 迭代中引擎 (IN-PROGRESS ENGINES)

| EngineKey | JobType | 实现状态 | 计费模型 | 审计 Action 前缀 | Gate 脚本 | 封印 Tag | 备注 |
| --------- | ------- | -------- | -------- | ---------------- | --------- | -------- | ---- |
|           |         |          |          |                  |           |          |      |

### 3. 规划中引擎 (PLANNED ENGINES)

| EngineKey | JobType | 实现状态 | 优先级 | 适配器路径 | Gate 脚本 | 计费单位 | 依赖引擎 | 备注 |
| --------- | ------- | -------- | ------ | ---------- | --------- | -------- | -------- | ---- |
| `ce14_role_consistency_score` | NOVEL_ANALYSIS | PLANNED | P3 | adapters/ce14_role_consistency_score.adapter.ts | gate_p3_ce_batch_v3.sh | job | ce02 | 角色一致性评分 |
| `ce15_keyframe_planning` | SHOT_PLANNING | PLANNED | P3 | adapters/ce15_keyframe_planning.adapter.ts | gate_p3_ce_batch_v3.sh | job | ce10 | 关键帧规划 |
| `ce16_camera_move_strategy` | SHOT_PLANNING | PLANNED | P3 | adapters/ce16_camera_move_strategy.adapter.ts | gate_p3_ce_batch_v3.sh | job | ce10 | 镜头运动策略 |
| `ce17_color_palette_gen` | SHOT_PLANNING | PLANNED | P3 | adapters/ce17_color_palette_gen.adapter.ts | gate_p3_ce_batch_v3.sh | job | ce10 | 配色方案生成 |
| `ce18_sound_script_planning` | NOVEL_ANALYSIS | PLANNED | P3 | adapters/ce18_sound_script_planning.adapter.ts | gate_p3_ce_batch_v3.sh | job | ce01 | 音效脚本规划 |
| `ce19_subtitle_gen_from_text` | PP_RENDER | PLANNED | P3 | adapters/ce19_subtitle_gen.adapter.ts | gate_p3_ce_batch_v3.sh | job | ce01 | 基于文本生成 SRT |
| `ce20_marketing_copy_gen` | CONTENT_GEN | PLANNED | P3 | adapters/ce20_marketing_copy.adapter.ts | gate_p3_ce_batch_v3.sh | tokens | ce01 | 营销文案生成 |
| `vg06_pose_adjustment` | VG_RENDER | PLANNED | P3 | adapters/vg06_pose_adj.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | vg02 | 姿态微调 |
| `vg07_expression_morphing` | VG_RENDER | PLANNED | P3 | adapters/vg07_expr_morph.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | vg02 | 表情迁移 |
| `vg08_cloth_simulation` | VG_RENDER | PLANNED | P3 | adapters/vg08_cloth_sim.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | vg02 | 布料物理模拟 |
| `vg09_hair_physics` | VG_RENDER | PLANNED | P4 | adapters/vg09_hair_phys.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | vg02 | 头发物理模拟 |
| `vg10_particle_fx` | VG_RENDER | PLANNED | P4 | adapters/vg10_particle_fx.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | vg05 | 粒子特效 (烟/火) |
| `vg11_face_swap` | VG_RENDER | PLANNED | P4 | adapters/vg11_face_swap.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | vg02 | AI 换脸 |
| `vg12_style_consistency_fix` | VG_RENDER | PLANNED | P4 | adapters/vg12_style_fix.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | style_transfer | 风格一致性修复 |
| `vg13_video_upscaler_4k` | VG_RENDER | PLANNED | P3 | adapters/vg13_upscaler.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | video_merge | 4K 超分 |
| `vg14_denoising_engine` | VG_RENDER | PLANNED | P4 | adapters/vg14_denoising.adapter.ts | gate_p3_vg_batch_v2.sh | gpu_seconds | vg01 | 画面降噪 |
| `vg15_depth_map_gen` | VG_RENDER | PLANNED | P5 | adapters/vg15_depth_gen.adapter.ts | gate_p3_vg_batch_v2.sh | job | vg01 | 深度图生成 |
| `au05_voice_cloning` | AU_RENDER | PLANNED | P3 | adapters/au05_voice_clone.adapter.ts | gate_p3_au_batch_v2.sh | job | au01 | 声音克隆 |
| `au06_audio_restoration` | AU_RENDER | PLANNED | P4 | adapters/au06_audio_rest.adapter.ts | gate_p3_au_batch_v2.sh | seconds | au01 | 音频修复/降噪 |
| `au07_beat_sync_engine` | AU_RENDER | PLANNED | P3 | adapters/au07_beat_sync.adapter.ts | gate_p3_au_batch_v2.sh | job | au02 | 卡点/节奏同步 |
| `au08_lyrics_gen` | CONTENT_GEN | PLANNED | P5 | adapters/au08_lyrics_gen.adapter.ts | gate_p3_au_batch_v2.sh | tokens | ce01 | 歌词生成 |
| `au09_vocal_tuning` | AU_RENDER | PLANNED | P5 | adapters/au09_vocal_tune.adapter.ts | gate_p3_au_batch_v2.sh | seconds | au05 | 人声调优 (Auto-Tune) |
| `au10_spatial_audio_3d` | AU_RENDER | PLANNED | P5 | adapters/au10_spatial_3d.adapter.ts | gate_p3_au_batch_v2.sh | seconds | au04 | 3D 空间音频 |
| `pp05_motion_graphics_gen` | PP_RENDER | PLANNED | P3 | adapters/pp05_motion_gfx.adapter.ts | gate_p3_pp_batch_v2.sh | job | vg05 | 动态图形生成 |
| `pp06_transitions_engine` | PP_RENDER | PLANNED | P3 | adapters/pp06_transitions.adapter.ts | gate_p3_pp_batch_v2.sh | job | video_merge | 转场处理 |
| `pp07_end_credits_gen` | PP_RENDER | PLANNED | P4 | adapters/pp07_end_credits.adapter.ts | gate_p3_pp_batch_v2.sh | job | video_merge | 片尾滚动字幕 |
| `pp08_bokeh_effect` | PP_RENDER | PLANNED | P5 | adapters/pp08_bokeh.adapter.ts | gate_p3_pp_batch_v2.sh | gpu_seconds | vg03 | 虚化/散景效果 |
| `pp09_color_grading_lut` | PP_RENDER | PLANNED | P3 | adapters/pp09_color_grade.adapter.ts | gate_p3_pp_batch_v2.sh | job | video_merge | 调色 (LUT 映射) |
| `pp10_video_stabilizer` | PP_RENDER | PLANNED | P5 | adapters/pp10_stabilizer.adapter.ts | gate_p3_pp_batch_v2.sh | job | video_merge | 画面防抖 |
| `qc05_audio_clipping_det` | QC_CHECK | PLANNED | P3 | adapters/qc05_audio_clip.adapter.ts | gate_p3_qc_batch_v2.sh | job | au04 | 音频爆音检测 |
| `qc06_lip_sync_verify` | QC_CHECK | PLANNED | P3 | adapters/qc06_lip_sync.adapter.ts | gate_p3_qc_batch_v2.sh | job | vg07 | 嘴型同步校验 |
| `qc07_brand_safety_guard` | QC_CHECK | PLANNED | P3 | adapters/qc07_brand_safety.adapter.ts | gate_p3_qc_batch_v2.sh | job | ce09 | 品牌安全过滤 |
| `qc08_copyright_check` | QC_CHECK | PLANNED | P3 | adapters/qc08_copyright_chk.adapter.ts | gate_p3_qc_batch_v2.sh | job | ce09 | 版权侵权检测 |
| `qc09_file_integrity_chk` | QC_CHECK | PLANNED | P4 | adapters/qc09_file_integ.adapter.ts | gate_p3_qc_batch_v2.sh | job | pp04 | 文件完整性校验 (MD5) |
| `qc10_metadata_validation` | QC_CHECK | PLANNED | P4 | adapters/qc10_meta_val.adapter.ts | gate_p3_qc_batch_v2.sh | job | pp04 | 元数据准确性评估 |
| `ce24_novel_summary_gen` | NOVEL_ANALYSIS | PLANNED | P3 | adapters/ce24_summary.adapter.ts | gate_p3_ce_batch_v3.sh | tokens | ce01 | 小说提纲/摘要生成 |
| `ce25_world_setting_gen` | NOVEL_ANALYSIS | PLANNED | P3 | adapters/ce25_world_set.adapter.ts | gate_p3_ce_batch_v3.sh | tokens | ce01 | 世界观设定解析 |
| `vg16_lighting_bake` | VG_RENDER | PLANNED | P5 | adapters/vg16_light_bake.adapter.ts | gate_p3_vg_batch_v2.sh | job | vg03 | 光照烘焙 |
| `au11_bgm_stem_extract` | AU_RENDER | PLANNED | P5 | adapters/au11_stem_extract.adapter.ts | gate_p3_au_batch_v2.sh | job | au02 | BGM 分道拆解 |
| `pp11_motion_blur_fix` | PP_RENDER | PLANNED | P5 | adapters/pp11_motion_blur.adapter.ts | gate_p3_pp_batch_v2.sh | gpu_seconds | video_merge | 运动模糊修正 |


---

## 实现状态说明

| 状态          | 含义                                 |
| ------------- | ------------------------------------ |
| **REAL**      | 真实实现，调用外部 API/GPU           |
| **REAL-STUB** | 确定性 I/O，可审计，但非真实 AI 输出 |
| **STUB**      | 占位实现，仅用于开发测试             |
| **PLANNED**   | 计划中，未开始实现                   |

---

## P0 优先引擎（必须真做）

以下引擎位于生产链路关键路径，必须达到 **REAL** 状态：

1. **shot_render** - 分镜渲染（视频产线末端）
2. **video_merge** - 视频合成（视频产线末端）
3. **ce06_novel_parsing** - 小说解析（产线入口）
4. **g5_video_render** - G5 动态视频（1440p/2.5D 生产）

---

## Gate 验收标准

### 通用标准（所有引擎）

- ✅ **NO_EMPTY_OUTPUT_RULE**: 任何引擎（无论 REAL 或 STUB）不得返回空值 (null/undefined/空字符串)
- ✅ **AUDIT_LOG_INTEGRITY**: 每次引擎调用必须生成 AuditLog 记录 (成功/失败都需要)
- ✅ **GATE_RETRY_STABILITY**: Gate 连跑两次必须稳定通过（幂等性验证）

### REAL 引擎额外标准

- ✅ **REAL_OUTPUT_DIFF**: 确定性引擎必须产生一致输出（可基于 seed）
- ✅ **ASSET_PERSISTENCE**: 涉及资源的引擎必须落库 (Asset Table)
- ✅ **ERROR_PROPAGATION**: 错误必须带 `errorMessage` 字段并传播到审计日志

### 商业计费强制标准（P0 Billing Infrastructure）

> [!IMPORTANT]
> **HARD SEALED**: 2026-01-13 Billing Gap Closure (P0 Hotfix)  
> Evidence: `docs/_evidence/GATE_PHASE3_E2E_1768298805`

- ✅ **COST_LEDGER_COVERAGE**: 所有REAL引擎必须存在CostLedger记录（允许cost=0用于audit），否则Gate必须FAIL
- ✅ **ENGINE_KEY_WHITELIST**: CostLedger的engineKey必须在ENGINE_MATRIX_SSOT中存在
- ✅ **BILLING_IDEMPOTENCY**: 同一traceId重复调用不得重复计费（通过idempotencyKey保障）
- ✅ **0_COST_AUDIT_SUPPORT**: 允许quantity=0/cost=0用于完整audit trail记录

---

## 60+ 引擎扩展计划

### P0（必须）

- shot_render ✅
- video_merge ✅
- ce02_identity_lock ✅

### P1（应该）

- ce07_memory_update
- shot_preview
- audio_tts
- audio_bgm

### P2（可以）

- translation_engine
- style_transfer
- character_gen
- scene_composition

---

---

## 架构硬化事实记录 (Hardened Facts)

### P13-3: 质量评分与自动返工 (0-Risk Hardened)

- **三道闸保障**：由 `MAX_ATTEMPT_REACHED` (轮次限制), `IDEMPOTENCY_HIT` (0-Risk 去重表拦截), `BUDGET_GUARD_BLOCKED` (真实 Credits 校验) 组成审计闭环。
- **0-Risk 幂等硬约束**：引入 `ShotReworkDedupe` 轻量表，避开了对 `ShotJob` 主表的 schema 修改风险。利用 `reworkKey` 唯一索引在物理层确保全球唯一性。
- **负向拦截验证**：Gate 脚本集成了“预算不足”与“并发重复”等负向断言，达到商业级防刷与资源可控标。

### G5-M1: 资产先行与 Gate-0 法律 (Asset-First Pipeline)

- **Gate-0 法律定义**：视频必须满足 `24fps / duration*24 frames / 1440p+ / Logical Grounding`。
- **三视图路由规则**：严禁单视图拉伸。视频必须支持 `camera_angle` 驱动的 `front/side/back` 物理切换。
- **不可被否认的视频**：以 `E0001-Real` (15s连续Orbit) 为合法性基点。在此基点达成前，任何批量引擎扩展均视为“非法”。

## 变更记录

| 日期       | 变更                                                                                                                                                                                      | 操作人      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 2026-01-09 | 初始化矩阵 SSOT                                                                                                                                                                           | Gemini      |
| 2026-01-09 | 添加 shot_render P0-R0                                                                                                                                                                    | Gemini      |
| 2026-01-09 | 封印 P0-R2 E2E 管线                                                                                                                                                                       | Gemini      |
| 2026-01-09 | P1-3 基础可观测性建设                                                                                                                                                                     | Gemini      |
| 2026-01-13 | 封印 CE11 Timeline Preview                                                                                                                                                                | Antigravity |
| 2026-01-13 | Phase 1 HARD SEALED（CE06 Real + CE11 Regression）                                                                                                                                        | Gemini      |
| 2026-01-13 | Phase 3 HARD SEALED（Commercial E2E）                                                                                                                                                     | Gemini      |
| 2026-01-13 | Phase 4 UI Commercial Closure                                                                                                                                                             | Gemini      |
| 2026-01-13 | **Billing Gap Closure (P0 Hotfix)** — CostLedger全链路闭环完成                                                                                                                            | Antigravity |
| 2026-01-16 | **Phase 5D HARD SEALED** — Identity Consistency Regression Complete                                                                                                                       | Antigravity |
| 2026-01-16 | **Stage 4 SEALED** — Scale Architecture Verified (100 chaps → 100 chunk jobs, ce06_scan_toc + ce06_chunk_parse)                                                                           | Antigravity |
| 2026-01-19 | **CE11 P5 REAL SEALED** — Real Engine Integration with Explicit Routing, Realism Assertions, Cost Audit & Worker Flow                                                                     | Antigravity |
| 2026-01-19 | **Phase P9 SEALED** — V3 Job Logic Integration complete. Contract API -> REAL Worker -> DB. Evidence: `docs/_evidence/v3_job_e2e_20260119193320`                                          | Antigravity |
| 2026-01-19 | **Phase P10 SEALED** — V3 Production Ready. Standardized Receipts, Guardrails (Concurrency/Budget), and Studio UI Integration. Evidence: `docs/_evidence/P10_SEAL_20260119`               | Antigravity |
| 2026-01-19 | **Phase P10.1 SEALED** — Receipt Completeness & Gate Upgrade. 0-Risk Asset Discovery + Availability Assertions. Evidence: `docs/_evidence/P10_1_SEAL_20260119`                            | Antigravity |
| 2026-01-20 | **P13-0 SEALED** — CE23 Identity Consistency Schema & Minimal Loop. Evidence: `docs/_evidence/ce23_identity_20260120*`                                                                    | Antigravity |
| 2026-01-21 | **P13-1 SEALED** — Shot Render Preview Loop (Visual Quality). Worker Write-back, Asset Persistence & Physical Verification. Evidence: `docs/_evidence/shot_preview_20260121*`             | Antigravity |
| 2026-01-22 | **P13-2 HARD SEALED** — Audio Minloop & DB Hardening. Enum Injection, Foreign Key Decoupling, and Automated Evidence Generation. Evidence: `docs/_evidence/P13_2_AUDIO_GATE_PASS`         | Antigravity |
| 2026-01-22 | **P13-3 HARD SEALED** — Quality Scoring & Auto-Rework (0-Risk Rev.). Triple-Guard Audit (Attempt, Dedupe, Real Budget). Evidence: `docs/_evidence/quality_rework_20260122203405`          | Antigravity |
| 2026-01-23 | **P15-0 REAL SEALED** — CE23 Identity Consistency upgrade to REAL (PPV-64). Content-based deterministic scoring + Audit Evidence. Evidence: `docs/_evidence/ce23_identity_real_20260123*` | Antigravity |
| 2026-01-23 | **P16-0 EXT SERVICE SEALED** — CE23 Shadow/Real Mode Integration. Double-Pass Verified (S1 Shadow Audit / S2 Real Rework). Evidence: `docs/_evidence/ce23_real_shadow_20260123*`          | Antigravity |
| 2026-01-24 | **P16-1 SEALED** — Dynamic Thresholds & Guardrails (0-Risk Rework Block). Ops Metrics + Double-Pass Verified. Evidence: `docs/_evidence/ce23_real_threshold_calib_20260124*`              | Antigravity |
| 2026-01-25 | **P24-0 HARD SEALED** — Performance SLA (CE03/04/06) verified with N=20 concurrency. P95 targets fully met. Evidence: `docs/_evidence/p24_0_performance_1769321734`                       | Antigravity |
| 2026-01-29 | **G5-B HARD SEALED** — First Real Video (E0001) achieved. 15s Orbit, 1440p, 3-View Switch, Grounding Shadow. Definition: Gate-0 Law. Evidence: `docs/_evidence_archived/G5_M1_E0001_REAL` | Antigravity |
| 2026-01-31 | **Phase 8 HARD SEALED** — Production Operating Readiness. Release Audit, Monitoring, Incident & Cost Drills implemented and verified. Evidence: `docs/_evidence/p8_operating_readiness_20260131_233552` | Antigravity |
| 2026-02-01 | **P2 Minloop SEALED** — Character -> Scene -> Preview Integration. Minloop Gate Passed (Double-Run, Audit, Cost). Evidence: `docs/_evidence/p2_minloop_scene_to_preview_v1`                             | Antigravity |
| 2026-02-01 | **P2.3 SEALED** — Emotion Analysis (REAL-STUB). Deterministic Regex, Redis Cache, Job Billing. Evidence: `docs/_evidence/emotion_analysis_v1`                                                           | Antigravity |
| 2026-02-01 | **P2.4 SEALED** — Dialogue Optimization (REAL-STUB). Deterministic Regex, Redis Cache, Job Billing. Evidence: `docs/_evidence/dialogue_optimization_v1`                                                 | Antigravity |
| 2026-02-01 | **P2 Text Minloop SEALED** — Dialogue -> Emotion -> Memory Integration. Validated Audit/Cost Chain. Evidence: `docs/_evidence/p2_text_minloop_dialogue_to_memory_v1`                                    | Antigravity |
| 2026-02-01 | **P3 NLP Base SEALED** — Standardized Tokenize/Hash/Cache/Audit/Ledger. Hardened Infrastructure for Extension Engines. Tag: `seal/p3_nlp_base_20260201`. Evidence: `docs/_evidence/p3_nlp_base_20260201` | Antigravity |
| 2026-02-01 | **P3 CE Batch SEALED** — CE01 Narrative Structure & CE05 Conflict Detector. REAL-STUB, NLP Base, Pre-push Integrated. Tag: `seal/p3_ce_batch_ce01_ce05_20260201` | Antigravity |
| 2026-02-01 | **P3.3 CE Batch V2 SEALED** — CE08 Character Arc, CE12 Theme, CE13 Pacing. REAL-STUB, Comprehensive Batch Gate. Tag: `seal/p3_ce_batch_v2_20260201` | Antigravity |

---

## 系统能力矩阵 (System Capabilities)

### 可观测性 (Observability) - P1-3 Foundation

| Capability       | Status | Provider            | Key Metrics                                     | Gate Script                              |
| ---------------- | ------ | ------------------- | ----------------------------------------------- | ---------------------------------------- |
| **Metrics**      | ACTIVE | `prom-client`       | `worker_jobs_active`, `scu_api_uptime_seconds`  | `gate-p1-3_performance_observability.sh` |
| **Tracing**      | ACTIVE | `AsyncLocalStorage` | `x-trace-id` propagation (API->Worker->Billing) | `gate-p1-3_performance_observability.sh` |
| **Log Trace ID** | ACTIVE | `pino` + `ALS`      | Automatic injection of `traceId` in all logs    | `gate-p1-3_performance_observability.sh` |
| **Performance**  | ACTIVE | `Gate-Enforced`     | P95/P99 Latency (CE03/04/06), Failure Rate < 1% | `gate-p1-4_performance_sla.sh`           |

> [!IMPORTANT]
> **P1-4 Status: HARD SEALED** (2026-01-25)
> SLA definition, stress tooling, and performance gates are fully verified.
> N=20 concurrency load test passed with 100% P95 compliance for CE03/04/06.
> Evidence: `docs/_evidence/p24_0_performance_1769321734/gate_p24.log`

| **Trace x Perf** | ACTIVE | `Span-Correlated` | Queue/Prepare/Exec/Persist Breakdown | `gate-p1-5_trace_perf_correlation.sh` |
| **Ops Dashboard**| ACTIVE | `Snapshot-Model` | P16-2.3 Alerting (Rework/Block/Fail). Evidence: `docs/_evidence/p17_0_ops_dashboard_1769270258_31617` | `gate-ops-dashboard-snapshot.sh` |
| **Operating Readiness**| ACTIVE | `P8-Enforced` | Release Audit, Monitoring, Incident & Cost Drills | `tools/run_p8_operating_readiness.sh` |

> [!IMPORTANT]
> **P8 Status: HARD SEALED** (2026-01-31)
> Release governance, Monitoring SSOT, Incident simulation, and Cost circuit breakers are fully verified.
> Evidence: `docs/_evidence/p8_operating_readiness_20260131_233552`

---




