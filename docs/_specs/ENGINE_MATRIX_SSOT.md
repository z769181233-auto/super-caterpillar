# ENGINE_MATRIX_SSOT.md - 引擎矩阵单一真源

> **版本**: 1.0.0  
> **更新时间**: 2026-01-09  
> **状态**: ACTIVE

---

## 概述

本文件是毛毛虫宇宙所有引擎的**唯一真源（SSOT）**。任何引擎的新增、修改、封印都必须同步更新此文件。

---

## 引擎矩阵

| EngineKey      | JobType                | 实现状态  | 计费模型           | 审计 Action 前缀     | Gate 脚本                                  | 封印 Tag                                   |
| -------------- | ---------------------- | --------- | ------------------ | -------------------- | ------------------------------------------ | ------------------------------------------ |
| `ce06`         | CE06_NOVEL_PARSING     | REAL-STUB | tokens @ 0.2/1k    | `engine.ce06`        | `gate-stage3-b_ce06_billing_closure.sh`    | `stage3b_ce06_billing_closure`             |
| `ce03`         | CE03_VISUAL_DENSITY    | REAL      | tokens @ 1.0/1k    | `engine.ce03`        | `gate-stage3-c_ce03_density_closure.sh`    | `stage3c_ce03_density_closure`             |
| `ce04`         | CE04_VISUAL_ENRICHMENT | REAL-STUB | tokens @ 1.0/1k    | `engine.ce04`        | `gate-stage3-d_ce04_enrichment_closure.sh` | `stage3d_ce04_enrichment_closure`          |
| `shot_render`  | SHOT_RENDER            | REAL      | gpuSeconds @ 50/1k | `engine.shot_render` | `gate-p0-r0_shot_render_real.sh`           | `shot_render_local_mps_sealed_20260109`    |
| `video_merge`  | VIDEO_MERGE            | REAL      | cpuSeconds @ TBD   | `engine.video_merge` | `gate-p0-r1_video_merge_real.sh`           | `video_merge_local_ffmpeg_sealed_20260109` |
| `E2E_Pipeline` | CE06->SHOT->VIDEO      | REAL      | Multi-Step         | `pipeline.e2e_video` | `gate-p0-r2_e2e_video_pipeline.sh`         | `p0_r2_e2e_video_pipeline_sealed_20260109` |

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

---

## Gate 验收标准

每个引擎的 Gate 必须断言：

- [ ] 输出结构符合 `types.ts` 定义
- [ ] `billing_usage` 存在且 `totalTokens > 0` 或 `gpuSeconds > 0`
- [ ] `audit_trail` 存在且 `engineKey` 非空
- [ ] CostLedger 记录存在
- [ ] BillingEvent 1:1 绑定（如适用）
- [ ] 无 STUB 特征（如 `FAKE PNG HEADER`）对于 REAL 状态引擎

---

## 60+ 引擎扩展计划

### P0（必须）

- shot_render ✅
- video_merge

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

## 变更记录

| 日期       | 变更                   | 操作人 |
| ---------- | ---------------------- | ------ |
| 2026-01-09 | 初始化矩阵 SSOT        | Gemini |
| 2026-01-09 | 添加 shot_render P0-R0 | Gemini |
| 2026-01-09 | 封印 P0-R2 E2E 管线    | Gemini |
| 2026-01-09 | P1-3 基础可观测性建设  | Gemini |

---

## 系统能力矩阵 (System Capabilities)

### 可观测性 (Observability) - P1-3 Foundation

| Capability       | Status | Provider            | Key Metrics                                     | Gate Script                              |
| ---------------- | ------ | ------------------- | ----------------------------------------------- | ---------------------------------------- |
| **Metrics**      | ACTIVE | `prom-client`       | `worker_jobs_active`, `scu_api_uptime_seconds`  | `gate-p1-3_performance_observability.sh` |
| **Tracing**      | ACTIVE | `AsyncLocalStorage` | `x-trace-id` propagation (API->Worker->Billing) | `gate-p1-3_performance_observability.sh` |
| **Log Trace ID** | ACTIVE | `pino` + `ALS`      | Automatic injection of `traceId` in all logs    | `gate-p1-3_performance_observability.sh` |
| **Performance**  | ACTIVE | `Gate-Enforced`     | P95/P99 Latency (CE03/04/06), Failure Rate < 1% | `gate-p1-4_performance_sla.sh`           |

> [!WARNING]
> **P1-4 Status: Conditionally Sealed**
> SLA definition, stress tooling, and performance gates are fully implemented.
> Due to environment variable propagation instability in the current turbo-based Gate session, the P1-4 performance gate has not yet produced a fully reproducible hard evidence run.
> A clean, single-command Gate rerun is required to upgrade this milestone to Hard Sealed status.

| **Trace x Perf** | ACTIVE | `Span-Correlated` | Queue/Prepare/Exec/Persist Breakdown | `gate-p1-5_trace_perf_correlation.sh` |
