# QUALITY_SCORE_SSOT.md - 质量评分与返工单一真源

> **版本**: 1.2.0
> **状态**: SEALED (P14-1 Rework SLO)
> **硬收口门禁**: `tools/gate/gates/gate-quality-prod-hook-slo.sh`
> **封板证据**: `docs/_evidence/quality_prod_hook_slo_20260123201549/`

## 1. 概述

本文件定义毛毛虫宇宙视频产线中“质量评分（Quality Score）”的计算标准、信号维度及自动返工（Auto-Rework）触发逻辑，确保产出物符合商业交付基线。

## 2. 评分信号 (Scoring Signals)

| 信号名称                    | 来源                 | 权重 | 判定标准                                                                              |
| :-------------------------- | :------------------- | :--- | :------------------------------------------------------------------------------------ |
| `identity_score`            | `CE23` (Consistency) | P0   | 角色一致性评分，低于 0.8 标记为 FAIL                                                  |
| `identity_score_real_ppv64` | `CE23 REAL` (PPV-64) | P0   | `>= 0.80` PASS, else FAIL (仅当 `ce23RealEnabled=true` 时参与 Verdict；Shadow 仅审计) |
| `render_physical`           | `Audit`              | P1   | 检查文件物理存在（VIDEO Asset）                                                       |
| `audio_existence`           | `Audit`              | P0   | 场景级音频资产完整性审计                                                              |

## 3. 返工政策 (Rework Policy)

### 3.1 触发阈值

- **Verdict**: PASS (所有 P0 信号通过且总分 > 0.8) 或 **FAIL** (任一 P0 失败或总分 <= 0.8)。
- **Action**: 当判定为 `FAIL` 时，系统自动触发 `SHOT_RENDER` 返工。

### 3.2 返工三道闸 (Triple Guards - 0-Risk 版)

1. **闸 1: Attempt 上限 (Hard)**
   - 每个 Shot 的最大尝试次数为 2。
   - 触发上限时记录 `STOP_REASON=MAX_ATTEMPT_REACHED`。

2. **闸 2: 0-Risk 幂等性 (Hard)**
   - **机制**: 引入轻量级去重表 `shot_rework_dedupe`。
   - **约束**: 对 `rework_key` (`${traceId}:${shotId}:attempt_${nextAttempt}`) 建立唯一索引。
   - 命中冲突时记录 `STOP_REASON=IDEMPOTENCY_HIT`。

3. **闸 3: 真实预算检查 (Hard拦截)**
   - **机制**: 实时查询 `organization.credits`。
   - 余额不足（<= 0）时记录 `STOP_REASON=BUDGET_GUARD_BLOCKED`。

4. **闸 4: Org 维度并发护栏 (Production SLO)**
   - **机制**: 统计 Org 下处于 `PENDING/RUNNING` 状态的返工 Job 总数。
   - **识别标准**: `traceId` 包含 `:rework:` 标记。
   - **阈值**: `REWORK_MAX_CONCURRENCY_PER_ORG` (默认 2)。
   - **拦截动作**: 超过阈值时记录 `STOP_REASON=RATE_LIMIT_BLOCKED`，记录 `rateLimitSnapshot` 审计信息。

## 4. 数据契约 (Data Contract)

### 4.1 `quality_scores` 核心审计

- `verdict`: PASS/FAIL
- `signals`: 记录所有分数及 `stopReason` (如有)
- `attempt`: 当前尝试轮次

### 4.2 `shot_rework_dedupe` 去重表

- `reworkKey`: 唯一审计主键
- `traceId`, `shotId`, `attempt`: 审计元数据

## 5. 生产 Hook 政策 (Production Hook Policy)

### 5.1 触发时机 (Trigger Phase)

- **核心 Hook**: 下沉至 `JobService.triggerQualityHookAfterPersist`。
- **覆盖范围**:
  1.  **主动创建**: 用户/API 触发的 Job 汇报成功时。
  2.  **被动补漏**: Sweeper 发现 orphaned Job 并标记成功时。
- **同步/异步**: 生产环境默认**异步**分发，门禁模式下通过 `QUALITY_HOOK_SYNC_FOR_GATE=1` 强制同步。

### 5.2 预算一致性 (Budget Consistency)

- **返工计费**: 自动返工 Job (System Rework) 被视为标准渲染 Job。
- **拦截点**: 在 `JobService.create` 中通过 `BillingService` 预扣费。
- **计费模式**:
  - `isVerification = false` (强制计费，确保 Case C 拦截器生效)。
  - `ReferenceSheetId`: 使用 `gate-mock-ref-id` 去除生产契约拦截（限 Gate 模式）。

### 5.3 故障可观测性 (Observability)

- **错误透明**: `JobService` 必须透传 `BillingService` 的原始 Forbidden 详情（含 Credits 缺口）。
- **审计留痕**: `stopReason` 记录在 `quality_scores.signals` 中。

### 5.4 运营约束 (Operational Constraints)

- **默认策略**: Feature Flag 初始状态必须为 **OFF**，仅对白名单 Organization/Project 开启。
- **并发护栏参数**:
  - `REWORK_MAX_CONCURRENCY_PER_ORG`: 默认值 **2**。
  - **审计要求**: 拦截时必须写入 `STOP_REASON=RATE_LIMIT_BLOCKED`，并记录 `rateLimitSnapshot` (包含 `runningReworks` 与 `cap`)。
- **环境安全**: `QUALITY_HOOK_SYNC_FOR_GATE=1` 仅允许在 Gate 模式下启用，严禁用于生产热路径。

### 5.5 Hook Release Policy (P16 Update)

1.  **Strict 0-Risk**: Default configuration must be safe for existing pipelines.
2.  **Shadow First**: New hooks (like CE23 REAL) must run in Shadow Mode first (write signal, ignore verdict).
3.  **Real Mode Whitelist**: Switching to Real Mode requires `projects.settingsJson` whitelist and Gate proof.
4.  **Gate Sync**: `QUALITY_HOOK_SYNC_FOR_GATE=1` allowed in CI/Gate environments.

---
