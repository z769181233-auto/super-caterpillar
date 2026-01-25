# ENGINE_MATRIX_SSOT.md - 引擎矩阵单一真源

> **版本**: 1.2.0  
> **更新时间**: 2026-01-23  
> **状态**: ACTIVE

---

## 概述

本文件是毛毛虫宇宙所有引擎的**唯一真源（SSOT）**。任何引擎的新增、修改、封印都必须同步更新此文件。

---

## 引擎矩阵

| EngineKey                   | JobType                   | 实现状态              | 计费模型                                 | 审计 Action 前缀     | Gate 脚本                                                    | 封印 Tag                                       | 备注                                                                                                                                                       |
| --------------------------- | ------------------------- | --------------------- | ---------------------------------------- | -------------------- | ------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ce06_novel_parsing`        | CE06_NOVEL_PARSING        | LEGACY (Monolithic)   | router-based                             | `CE%`                | `gate-ce06-story-parse-real.sh`                              | `legacy_monolithic`                            | **DEPRECATED**: Use SCAN/CHUNK                                                                                                                             |
| `ce06_scan_toc`             | NOVEL_SCAN_TOC            | REAL (Streaming)      | file-size-based                          | `ce06.scan`          | `gate-stage4-scale.sh`                                       | `seal/stage4_scale_verified_20260116`          | **NEW**: Table of Contents Scanner                                                                                                                         |
| `ce06_chunk_parse`          | NOVEL_CHUNK_PARSE         | REAL (Streaming)      | file-size-based                          | `ce06.parse`         | `gate-stage4-scale.sh`                                       | `seal/stage4_scale_verified_20260116`          | **NEW**: Chapter Content Parser                                                                                                                            |
| `ce02_identity_lock`        | CE02_IDENTITY_LOCK        | REAL (Postgres/Redis) | router-based                             | `ID%`                | `gate-ce02_identity_lock.sh`                                 | `seal/phase5D_identity_regression_20260116_v1` | **NEW**: Identity Consistency Anchor                                                                                                                       |
| `ce03_visual_density`       | CE03_VISUAL_DENSITY       | REAL (Heuristic)      | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`                              | `seal/phase3_commercial_e2e_hard_20260113`     |                                                                                                                                                            |
| `ce04_visual_enrichment`    | CE04_VISUAL_ENRICHMENT    | REAL (Template)       | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`                              | `seal/phase3_commercial_e2e_hard_20260113`     |                                                                                                                                                            |
| `shot_render`               | SHOT_RENDER               | REAL (Verified)       | gpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-shot-render-preview.sh`                                | `seal/p13_1_shot_preview_20260121`             | **P13-1**: Verified via Preview Loop                                                                                                                       |
| `video_merge`               | VIDEO_MERGE               | REAL                  | cpuSeconds (priced via PRICING_SSOT)     | `engine.video_merge` | `gate-p0-r1_video_merge_real.sh`                             | `video_merge_local_ffmpeg_sealed_20260109`     | LEGACY: Compatible with V1.0                                                                                                                               |
| `ce10_timeline_compose`     | TIMELINE_COMPOSE          | REAL                  | router-based (dynamic; see PRICING_SSOT) | `CE%`                | `gate-phase3-commercial-e2e.sh`                              | `seal/phase3_commercial_e2e_hard_20260113`     |                                                                                                                                                            |
| `ce11_timeline_preview`     | TIMELINE_PREVIEW          | REAL                  | cpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-phase3-commercial-e2e.sh`                              | `seal/phase3_commercial_e2e_hard_20260113`     |                                                                                                                                                            |
| `workflow_ce_dag`           | CE06->SHOT->VIDEO         | REAL (Orchestrator)   | Multi-Step                               | `CE%`                | `gate-phase3-commercial-e2e.sh`                              | `seal/phase3_commercial_e2e_hard_20260113`     | Orchestrator Workflow                                                                                                                                      |
| `ce11_shot_generator_real`  | CE11_SHOT_GENERATOR       | REAL (ComfyUI)        | gpuSeconds (priced via PRICING_SSOT)     | `CE%`                | `gate-ce11-shot-generator-real.sh`                           | `seal/ce11_real_p5_sealed_20260119`            | **P5-NEW**: Explicit Real Routing                                                                                                                          |
| `ce23_identity_consistency` | CE23_IDENTITY_CONSISTENCY | REAL (PPV-64)         | router-based (internal)                  | `ID%`                | `gate-ce23-identity-consistency-real.sh`                     | `seal/p15_0_ce23_real_ppv64_20260123`          | **P15-0**: Content-based Real Scoring (PPV-64)                                                                                                             |
| `audio_tts`                 | TIMELINE_RENDER (Sub)     | REAL (Production)     | router-based (internal)                  | `CE%`                | `gate-audio-p21-0-ops.sh`                                    | `seal/p21_0_audio_ops_integration_20260124`    | **P21-0**: Ops Integration Sealed. Dashboard Snapshot + Health Heartbeat + Auto-Diagnostic verified. Evidence: `p21_0_ops_integration_1769309936_gesrrand` |
| `audio_bgm`                 | TIMELINE_RENDER (Sub)     | REAL (Production)     | router-based (internal)                  | `CE%`                | `gate-audio-p21-0-ops.sh`                                    | `seal/p21_0_audio_ops_integration_20260124`    | **P21-0**: Ops Integration Sealed.                                                                                                                         |
| `quality_prod_hook`         | QUALITY_SCORE             | REAL (Production)     | 0-cost audit                             | `QC%`                | `gate-quality-prod-hook.sh`, `gate-quality-prod-hook-slo.sh` | `seal/p14_1_quality_rework_slo_20260123`       | **P14-1**: SLO Concurrency Rails. **P16**: `ce23RealEnabled=true` 时 Identity 判定源切换为 REAL(PPV-64)，设定为 `projects.settingsJson` 白名单。           |

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

---

## 架构硬化事实记录 (Hardened Facts)

### P13-3: 质量评分与自动返工 (0-Risk Hardened)

- **三道闸保障**：由 `MAX_ATTEMPT_REACHED` (轮次限制), `IDEMPOTENCY_HIT` (0-Risk 去重表拦截), `BUDGET_GUARD_BLOCKED` (真实 Credits 校验) 组成审计闭环。
- **0-Risk 幂等硬约束**：引入 `ShotReworkDedupe` 轻量表，避开了对 `ShotJob` 主表的 schema 修改风险。利用 `reworkKey` 唯一索引在物理层确保全球唯一性。
- **负向拦截验证**：Gate 脚本集成了“预算不足”与“并发重复”等负向断言，达到商业级防刷与资源可控标。

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
