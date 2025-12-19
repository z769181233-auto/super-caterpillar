# 废弃项索引（Deprecation Index）

**生成日期**: 2025-12-18  
**状态**: 📋 **Phase A 文档标注完成**  
**关联文档**: `docs/DEPRECATION_AUDIT_REPORT.md`, `docs/DEPRECATION_CLEANUP_PLAN.md`

---

## 索引说明

本索引文档提供所有候选废弃项（DEP-XXX）的快速查找表，包含类型、路径、风险等级、建议处理阶段和备注信息。

---

## 索引表

| DEP-ID | 类型 | 路径 | 风险等级 | 建议 Phase | 备注 |
|:---|:---|:---|:---:|:---:|:---|
| **DEP-001** | Code / Schema | `packages/database/src/generated/prisma/schema.prisma` | P1 | 已剥离 | Prisma `@deprecated` 关系，已从清理计划剥离，见 `docs/DB_DEPRECATION_REMOVAL_RFC.md` |
| **DEP-002** | Code / Worker Demo | `apps/workers/minimal-worker/index.ts` | P2 | 永久保留 | Stage2 验证 Demo Worker，永久保留 |
| **DEP-003** | Code / 前端组件 | `apps/web/src/components/_legacy/studio/*` | P2 | Phase B/C | 旧 Studio 组件，已标记为冻结区域 |
| **DEP-010** | Test / Backup E2E | `apps/api_tests_backup/` | P1 | Phase B/C | 历史 E2E 场景库，仅参考，不接入 gate |
| **DEP-020** | Script / 调试工具 | `tools/headless-worker.ts` | P1 | Phase B/C | 本地调试工具，禁止在 CI/Prod 使用（仅文档约束） |
| **DEP-021** | Script / 调试工具 | `tools/mock-worker.ts` | P2 | Phase B/C | 本地调试工具，禁止在 CI/Prod 使用（仅文档约束） |
| **DEP-022** | Script / Demo | `tools/dev/hmac-replay-demo.ts` | P2 | 永久保留 | 安全 Demo 工具，永久保留 |
| **DEP-030** | Doc / 历史 Stage | `docs/stage1_*.md` | P2 | Phase B | 历史证据文档，保留原路径；若需归档仅做复制快照，不移动 |
| **DEP-031** | Doc / 历史 Stage | `docs/STAGE2_*.md` | P2 | Phase B | 历史证据文档，保留原路径；若需归档仅做复制快照，不移动 |
| **DEP-032** | Doc / 历史 Stage | `docs/STAGE3_*.md` | P2 | Phase B | 历史证据文档，保留原路径；若需归档仅做复制快照，不移动 |
| **DEP-033** | Doc / 历史 Stage | `docs/STAGE4_*.md` | P2 | Phase B | 历史证据文档，保留原路径；若需归档仅做复制快照，不移动 |
| **DEP-034** | Doc / 未来 Stage | `docs/STAGE9_*.md`, `docs/STAGE10_*.md`, `docs/STAGE12_*.md`, `docs/STAGE13_*.md` | P2 | 永久保留 | 未来路线图，永久保留 |

---

## 详细说明

### DEP-001 — 旧 ProjectEpisodes 关系（Prisma Schema 向下兼容）

- **类型**: Code / Schema
- **路径**: `packages/database/src/generated/prisma/schema.prisma`
- **风险等级**: P1（数据兼容性风险）
- **建议 Phase**: 已从清理计划剥离
- **备注**: Prisma `@deprecated` 关系，涉及数据库 Schema 变更，风险较高。已从 `docs/DEPRECATION_CLEANUP_PLAN.md` 剥离，单独规划见 `docs/DB_DEPRECATION_REMOVAL_RFC.md`。

---

### DEP-002 — minimal-worker 示例 Worker

- **类型**: Code / Worker Demo
- **路径**: `apps/workers/minimal-worker/index.ts`
- **风险等级**: P2（影响历史验证文档可复现性）
- **建议 Phase**: 永久保留
- **备注**: Stage2 验证 Demo Worker，永久保留。作为 Stage2 Runtime Verify 的官方 Demo Worker，用于验证 Engine Hub 与 Orchestrator。

---

### DEP-003 — 旧 Studio 组件 `_legacy/studio/*`

- **类型**: Code / 前端组件
- **路径**: 
  - `apps/web/src/components/_legacy/studio/ProjectEmptyState.tsx`
  - `apps/web/src/components/_legacy/studio/SemanticInfoPanel.tsx`
  - `apps/web/src/components/_legacy/studio/QualityHintPanel.tsx`
  - `apps/web/src/components/_legacy/studio/ShotPlanningPanel.tsx`
- **风险等级**: P2（影响历史截图/文档）
- **建议 Phase**: Phase B（建立索引 + 可选复制快照），Phase C（评估删除）
- **备注**: 旧 Studio 组件，已标记为冻结区域。新的 Studio 结构与组件已经在其他目录中落地。

---

### DEP-010 — 旧版 API E2E 测试备份集

- **类型**: Test / Backup E2E Suite
- **路径**: `apps/api_tests_backup/`
- **风险等级**: P1（丢失历史 E2E 场景参考）
- **建议 Phase**: Phase B（建立索引 + 可选复制快照），Phase C（评估删除）
- **备注**: 历史 E2E 场景库，仅参考，不接入 gate。早期 Nest E2E / 单元测试备份，目前不参与主线 Gate / Smoke / Regression 流程。

---

### DEP-020 — headless-worker 调试脚本

- **类型**: Script / Worker 调试工具
- **路径**: `tools/headless-worker.ts`
- **风险等级**: P1（削弱 Stage4 调试手段）
- **建议 Phase**: Phase B（建立索引 + 可选复制快照），Phase C（评估删除）
- **备注**: 本地调试工具，禁止在 CI/Prod 使用（仅文档约束）。用于本地/实验性地直接操作 Prisma 与结构树，绕过 API 层进行 Worker 级调试。

---

### DEP-021 — mock-worker 调试脚本

- **类型**: Script / Worker 调试工具
- **路径**: `tools/mock-worker.ts`
- **风险等级**: P2（丢失一类调试入口）
- **建议 Phase**: Phase B（建立索引 + 可选复制快照），Phase C（评估删除）
- **备注**: 本地调试工具，禁止在 CI/Prod 使用（仅文档约束）。为早期“模拟 Worker”场景提供辅助逻辑。

---

### DEP-022 — HMAC Replay Demo 脚本

- **类型**: Script / Demo
- **路径**: `tools/dev/hmac-replay-demo.ts`
- **风险等级**: P2（减少一个安全演示工具）
- **建议 Phase**: 永久保留
- **备注**: 安全 Demo 工具，永久保留。用于演示/验证 HMAC 重放攻击场景，与 `tools/security/hmac-*.js` 相互补充。

---

### DEP-030 — Stage1 早期差异与规划文档

- **类型**: Doc / 历史 Stage
- **路径（示例）**:
  - `docs/stage1_gap_report.md`
  - `docs/STAGE1_DB_SCHEMA_DELTA_PLAN.md`
  - `docs/STAGE1_DB_MIGRATION_SOP.md`
  - `docs/STAGE1_EXECUTION_REPORT.md`
- **风险等级**: P2（丢失历史背景与归档依据）
- **建议 Phase**: Phase B（建立索引 + 可选复制快照）
- **备注**: 历史证据文档，保留原路径；若需归档仅做复制快照，不移动。已被 `docs/LAUNCH_STANDARD_V1.1.md` 与 `docs/FULL_LAUNCH_GAP_REPORT.md` 中的新 Stage1 规范与差距报告所补充/覆盖。

---

### DEP-031 — Stage2 早期规划与执行文档

- **类型**: Doc / 历史 Stage
- **路径（示例）**:
  - `docs/STAGE2_PLAN.md`
  - `docs/STAGE2_PLAN_V2.md`
  - `docs/STAGE2_ENGINE_HUB_PLAN.md`
  - `docs/STAGE2_A_IMPLEMENTATION_SUMMARY.md`
  - `docs/STAGE2_A_RUNTIME_VERIFY.md`
  - `docs/STAGE2_B_RUNTIME_VERIFY.md`
  - `docs/STAGE2_B_RUNTIME_EVIDENCE.md`
- **风险等级**: P2
- **建议 Phase**: Phase B（建立索引 + 可选复制快照）
- **备注**: 历史证据文档，保留原路径；若需归档仅做复制快照，不移动。新的统一标准与执行计划已经由 `LAUNCH_STANDARD_V1.1` / `FULL_LAUNCH_EXECUTION_PLAN` 承接。

---

### DEP-032 — Stage3 早期规划文档

- **类型**: Doc / 历史 Stage
- **路径（示例）**:
  - `docs/STAGE3_OVERVIEW.md`
  - `docs/STAGE3_OVERVIEW_PLAN.md`
  - `docs/STAGE3_PLAN.md`
- **风险等级**: P2
- **建议 Phase**: Phase B（建立索引 + 可选复制快照）
- **备注**: 历史证据文档，保留原路径；若需归档仅做复制快照，不移动。结构分析引擎（CE06）与 Scene Graph 能力现在主要由 `docs/LAUNCH_STANDARD_V1.1.md` 中 Stage3 部分进行规范与跟踪。

---

### DEP-033 — Stage4 早期规划与 MVP Close 文档

- **类型**: Doc / 历史 Stage
- **路径（示例）**:
  - `docs/STAGE4_OVERVIEW_PLAN.md`
  - `docs/STAGE4_PLAN.md`
  - `docs/STAGE4_FREEZE_DECLARATION.md`
  - `docs/STAGE4_CLOSE_MVP_CHECKLIST.md`
  - `docs/STAGE4_CLOSE_MVP_FINAL_CLOSE_REPORT.md`
  - `docs/STAGE4_CLOSE_MVP_FIX_REPORT.md`
  - `docs/STAGE4_CLOSE_MVP_DOC_ALIGNMENT_REPORT.md`
- **风险等级**: P2
- **建议 Phase**: Phase B（建立索引 + 可选复制快照）
- **备注**: 历史证据文档，保留原路径；若需归档仅做复制快照，不移动。特别是 FINAL_CLOSE_REPORT 与 CHECKLIST，作为历史 Close 证据。

---

### DEP-034 — Stage9 / Stage10 / Stage12 / Stage13 相关文档

- **类型**: Doc / 未来 Stage
- **路径（示例）**:
  - Stage9 UI：`docs/STAGE9_UI_*.md`
  - Stage10 UI Freeze：`docs/STAGE10_UI_FREEZE_DECLARATION.md`
  - Stage12 Research：`docs/STAGE12_RESEARCH_REPORT.md`
  - Stage13 Core Layer：`docs/STAGE13_*.md`
- **风险等级**: P2
- **建议 Phase**: 永久保留
- **备注**: 未来路线图，永久保留。面向更高 Stage（9–13）的 UI 优化、Freeze、核心引擎层设计与验证文档，为未来扩展能力提供路线图。

---

## 快速查找

### 按类型查找

- **Code / Schema**: DEP-001
- **Code / Worker Demo**: DEP-002
- **Code / 前端组件**: DEP-003
- **Test / Backup E2E**: DEP-010
- **Script / 调试工具**: DEP-020, DEP-021
- **Script / Demo**: DEP-022
- **Doc / 历史 Stage**: DEP-030, DEP-031, DEP-032, DEP-033
- **Doc / 未来 Stage**: DEP-034

### 按风险等级查找

- **P1（高风险）**: DEP-001, DEP-010, DEP-020
- **P2（中风险）**: DEP-002, DEP-003, DEP-021, DEP-022, DEP-030, DEP-031, DEP-032, DEP-033, DEP-034

### 按建议 Phase 查找

- **已剥离**: DEP-001
- **永久保留**: DEP-002, DEP-022, DEP-034
- **Phase B/C**: DEP-003, DEP-010, DEP-020, DEP-021
- **Phase B**: DEP-030, DEP-031, DEP-032, DEP-033

---

**维护说明**: 本索引文档应在每次 Phase 执行或 Stage Close 后更新。

