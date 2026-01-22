# QUALITY_SCORE_SSOT.md - 质量评分与返工单一真源

> **版本**: 1.0.1
> **状态**: SEALED (P13-3 0-Risk Rev.)
> **硬收口门禁**: `tools/gate/gates/gate-quality-auto-rework.sh`
> **封板证据**: `docs/_evidence/quality_rework_20260122203405/`

## 1. 概述

本文件定义毛毛虫宇宙视频产线中“质量评分（Quality Score）”的计算标准、信号维度及自动返工（Auto-Rework）触发逻辑，确保产出物符合商业交付基线。

## 2. 评分信号 (Scoring Signals)

| 信号名称          | 来源                 | 权重 | 判定标准                             |
| :---------------- | :------------------- | :--- | :----------------------------------- |
| `identity_score`  | `CE23` (Consistency) | P0   | 角色一致性评分，低于 0.8 标记为 FAIL |
| `render_physical` | `Audit`              | P1   | 检查文件物理存在（VIDEO Asset）      |
| `audio_existence` | `Audit`              | P0   | 场景级音频资产完整性审计             |

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

## 4. 数据契约 (Data Contract)

### 4.1 `quality_scores` 核心审计

- `verdict`: PASS/FAIL
- `signals`: 记录所有分数及 `stopReason` (如有)
- `attempt`: 当前尝试轮次

### 4.2 `shot_rework_dedupe` 去重表

- `reworkKey`: 唯一审计主键
- `traceId`, `shotId`, `attempt`: 审计元数据

---

**END OF SSOT**

---

**END OF SSOT**
