# ENGINE_MATRIX_SSOT.md - 引擎矩阵单一真源

> **版本**: 1.1.0  
> **更新时间**: 2026-01-13  
> **状态**: ACTIVE

---

## 概述

本文件是毛毛虫宇宙所有引擎的**唯一真源（SSOT）**。任何引擎的新增、修改、封印都必须同步更新此文件。

---

## 引擎矩阵

| EngineKey                  | JobType                | 实现状态              | 计费模型                                 | 审计 Action 前缀     | Gate 脚本                          | 封印 Tag                                       | 备注                                 |
| -------------------------- | ---------------------- | --------------------- | ---------------------------------------- | -------------------- | ---------------------------------- | ---------------------------------------------- | ------------------------------------ |
| `ce06_novel_parsing`       | CE06_NOVEL_PARSING     | LEGACY (Monolithic)   | router-based                             | `CE%`                | `gate-ce06-story-parse-real.sh`    | `legacy_monolithic`                            | **DEPRECATED**: Use SCAN/CHUNK       |
| `ce06_scan_toc`            | NOVEL_SCAN_TOC         | REAL (Streaming)      | file-size-based                          | `ce06.scan`          | `gate-stage4-scale.sh`             | `seal/stage4_scale_verified_20260116`          | **NEW**: Table of Contents Scanner   |
| `ce06_chunk_parse`         | NOVEL_CHUNK_PARSE      | REAL (Streaming)      | file-size-based                          | `ce06.parse`         | `gate-stage4-scale.sh`             | `seal/stage4_scale_verified_20260116`          | **NEW**: Chapter Content Parser      |
| `ce02_identity_lock`       | CE02_IDENTITY_LOCK     | REAL (Postgres/Redis) | router-based                             | `ID%`                | `gate-ce02_identity_lock.sh`       | `seal/phase5D_identity_regression_20260116_v1` | **NEW**: Identity Consistency Anchor |
| `ce03_visual_density`      | CE03_VISUAL_DENSITY    | REAL (Heuristic)      | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`    | `seal/phase3_commercial_e2e_hard_20260113`     |                                      |
| `ce04_visual_enrichment`   | CE04_VISUAL_ENRICHMENT | REAL (Template)       | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`    | `seal/phase3_commercial_e2e_hard_20260113`     |                                      |
| `shot_render`              | SHOT_RENDER            | REAL                  | gpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-phase3-commercial-e2e.sh`    | `seal/phase3_commercial_e2e_hard_20260113`     |                                      |
| `video_merge`              | VIDEO_MERGE            | REAL                  | cpuSeconds (priced via PRICING_SSOT)     | `engine.video_merge` | `gate-p0-r1_video_merge_real.sh`   | `video_merge_local_ffmpeg_sealed_20260109`     | LEGACY: Compatible with V1.0         |
| `ce10_timeline_compose`    | TIMELINE_COMPOSE       | REAL                  | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`    | `seal/phase3_commercial_e2e_hard_20260113`     |                                      |
| `ce11_timeline_preview`    | TIMELINE_PREVIEW       | REAL                  | cpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-phase3-commercial-e2e.sh`    | `seal/phase3_commercial_e2e_hard_20260113`     |                                      |
| `workflow_ce_dag`          | CE06->SHOT->VIDEO      | REAL (Orchestrator)   | Multi-Step                               | `CE%`                | `gate-phase3-commercial-e2e.sh`    | `seal/phase3_commercial_e2e_hard_20260113`     | Orchestrator Workflow                |
| `ce11_shot_generator_real` | CE11_SHOT_GENERATOR    | REAL (ComfyUI)        | gpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-ce11-shot-generator-real.sh` | `seal/ce11_real_p5_sealed_20260119`            | **P5-NEW**: Explicit Real Routing    |

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
4. **ce02_identity_lock** - 角色一致性（中间件）

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

## 变更记录

| 日期       | 变更                                                                                                                                                                        | 操作人      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 2026-01-09 | 初始化矩阵 SSOT                                                                                                                                                             | Gemini      |
| 2026-01-09 | 添加 shot_render P0-R0                                                                                                                                                      | Gemini      |
| 2026-01-09 | 封印 P0-R2 E2E 管线                                                                                                                                                         | Gemini      |
| 2026-01-09 | P1-3 基础可观测性建设                                                                                                                                                       | Gemini      |
| 2026-01-13 | 封印 CE11 Timeline Preview                                                                                                                                                  | Antigravity |
| 2026-01-13 | Phase 1 HARD SEALED（CE06 Real + CE11 Regression）                                                                                                                          | Gemini      |
| 2026-01-13 | Phase 3 HARD SEALED（Commercial E2E）                                                                                                                                       | Gemini      |
| 2026-01-13 | Phase 4 UI Commercial Closure                                                                                                                                               | Gemini      |
| 2026-01-13 | **Billing Gap Closure (P0 Hotfix)** — CostLedger全链路闭环完成                                                                                                              | Antigravity |
| 2026-01-16 | **Phase 5D HARD SEALED** — Identity Consistency Regression Complete                                                                                                         | Antigravity |
| 2026-01-16 | **Stage 4 SEALED** — Scale Architecture Verified (100 chaps → 100 chunk jobs, ce06_scan_toc + ce06_chunk_parse)                                                             | Antigravity |
| 2026-01-19 | **CE11 P5 REAL SEALED** — Real Engine Integration with Explicit Routing, Realism Assertions, Cost Audit & Worker Flow                                                       | Antigravity |
| 2026-01-19 | **Phase P9 SEALED** — V3 Job Logic Integration complete. Contract API -> REAL Worker -> DB. Evidence: `docs/_evidence/v3_job_e2e_20260119193320`                            | Antigravity |
| 2026-01-19 | **Phase P10 SEALED** — V3 Production Ready. Standardized Receipts, Guardrails (Concurrency/Budget), and Studio UI Integration. Evidence: `docs/_evidence/P10_SEAL_20260119` | Antigravity |

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
