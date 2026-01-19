# GATE MODE SEMANTICS (SSOT)

> **Version**: 1.0
> **Scope**: V3.0 Regression Pipeline (`run_launch_gates.sh`)

## 1. 运行模式定义 (GATE_ENV_MODE)

为了保证开发效率与生产严谨性的平衡，系统支持两种核心运行模式：

### 1.1 MODE=local (默认)

- **描述**: 开发与本地验证环境。
- **SKIP 治理**: 允许跳过依赖云端资源、计费点或高耗时的非核心门禁。
- **允许 SKIP 列表**:
  - Gate 4 (Video E2E - 依赖真实 Credit)
  - Gate 5 (Capacity Report - 依赖压测数据)
  - Gate 7 (Video Merge Guardrails - 局部验证)
  - Gate 8 (Context Injection - V3.0 P0-2 特定)
  - Gate 9 (Director Columns - 数据库局部)
  - Gate 11 (P4 E2E - 完整长链)
  - Gate 12 (Billing Integrity - 计费闭环)
- **REQUIRED 列表** (必须通过才能密封):
  - Gate 1-3 (基础预检、安全、流水线基础)
  - **Gate 13 (CE01 Protocol Alignment)**
  - **Gate 14 (CE02 Visual Density)**
  - **Gate 15 (CE11 Shot Generator)**

### 1.2 MODE=production

- **描述**: CI/CD 合并前或发布前的最终审计环境。
- **SKIP 治理**: **不允许任何 SKIP**。所有门禁必须全量通过 (Hard Pass)。
- **要求**: Gate 1 到 Gate 15 (及后续增量) 必须全部显示 ✅ PASSED。

## 2. 汇总报告要求

- 脚本必须在结尾打印 `MODE`、`Required`、`Skipped`、`Failed` 的统计表。
- 任何处于 `Required` 列表中的门禁失败均会导致 `ALL_PASSED=false` 并退出码非零。
- `Skipped` 门禁应在报告中明确标记为 `⚠️ SKIPPED (local mode)`。
