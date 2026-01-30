# Cost Model SSOT (Phase G3)

> **Version**: 1.0.0
> **Status**: Active
> **Last Updated**: 2026-01-28

本文件定义了 Super Caterpillar 渲染链路的成本计费模型 Single Source of Truth。
所有成本估算（Compiler）、预算熔断（Gate）、账本汇总（Ledger）均必须严格遵循本口径。

## 1. 基础计费单位 (Cost Unit Definition)

**Cost Unit (CU)** 是本项目标准化的计费单位，用于统一度量计算资源消耗。

- **Base Frame CU**: `1.0`
  - 定义：1 帧标准复杂度（Stub/Preview）渲染的基准成本。
  - 粒度：Per Frame

## 2. 计费公式 (Calculation Formula)

单镜头成本：
`ShotCost = DurationFrames * BaseFrameCU * TemplateMultiplier * (CharacterMultiplier + LocationMultiplier)`

_注：当前阶段 Character/Location Multiplier 暂定为 1.0 (Hook for future use)_

简化公式 (G3-0):
`ShotCost = DurationFrames * TemplateMultiplier`

总成本：
`TotalCostUnits = Σ(ShotCost)`

## 3. 模板倍率表 (Template Multipliers)

根据渲染复杂度（GPU/CPU 消耗、资产加载量、光照计算）定义倍率。

| Template ID Pattern | Multiplier | Description                              |
| :------------------ | :--------- | :--------------------------------------- |
| `DEFAULT`           | **1.0**    | 标准倍率，适用于大多数普通对话/动作镜头  |
| `.*_HEAVY`          | **2.0**    | 高负载镜头（如大场景、多角色、复杂特效） |
| `.*_LITE`           | **0.5**    | 低负载镜头（如空镜、特写、静态）         |
| `STUB_.*`           | **0.1**    | Stub 占位符（最低成本，防止计费噪音）    |

_注：若无特定匹配，默认使用 1.0_

## 4. 预算阈值 (Budget Thresholds)

硬性熔断标准。

- **BUDGET_EPISODE_COST_UNITS**: `20000` (约 8640 帧 x 2.3 倍率冗余)
- **BUDGET_SEASON_COST_UNITS**: `200000` (10 集总预算)

## 5. 证据落盘 (Evidence Contract)

- **Cost Model Digest**: `cost_model_sha256.txt` (This file's SHA)
- **Estimate File**: `cost_estimate.json` (Per Episode)
- **Ledger File**: `season_cost_ledger_evidence.json` (Per Season)
