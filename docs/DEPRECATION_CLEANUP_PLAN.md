# 废弃项清理执行计划（Deprecation Cleanup Plan）

**生成日期**: 2025-12-18  
**模式**: MODE: PLAN（仅限 Deprecation Cleanup）  
**状态**: 📋 **规划阶段**（禁止 EXECUTE，禁止删除文件，禁止修改现有代码/文档）

> **状态说明**: 本文件处于 PLAN 模式；Phase A（文档标注）已完成并通过验证（见 `docs/_evidence/automation_verification_deprecation_phaseA_20251219_080136.md` 和 `docs/_evidence/manual_verification_deprecation_phaseA_20251219_080136.md`）。

---

## 一、清理原则（强制执行）

### 1.1 永不删除项

以下内容**永不删除**，只能归档或保留：

- ✅ **Gate / Smoke / Audit / Risk / Health 相关脚本与文档**
- ✅ **验证脚本**（`tools/gate/*`, `tools/smoke/*`, `tools/verify/*`）
- ✅ **文档历史证据**（默认归档，不做物理删除）
- ✅ **Prisma `@deprecated` 关系**（必须先完成数据迁移与回归验证才能动）

### 1.2 清理时机规则

- **Phase A（Stage 1-2 期间）**: 仅做标记/清单化，不做删除
- **Phase B（Stage 3 Close 后）**: 建立索引 + 可选复制快照（不移动原文件，不更新引用）
- **Phase C（Stage 4 Close 后）**: 仅允许极少且可证明安全的物理删除

### 1.3 禁止清理项

**禁止**对以下内容进行任何清理动作：

- ❌ `docs/FULL_LAUNCH_GAP_REPORT.md` / `docs/FULL_LAUNCH_EXECUTION_PLAN.md` 中显式引用的任何文件或模块
- ❌ Stage 3/4 未来需要的占位结构或预留路径
- ❌ 任何在 `LAUNCH_STANDARD_V1.1.md` 中被引用的文档或脚本

---

## 二、按阶段拆分的清理计划

### Phase A：Stage 1-2 期间（零风险动作）

**目标**: 仅做标记/清单化，不做删除或迁移。

**允许动作**:

- ✅ 在文档中标注“历史档案 / 仅作参考”
- ✅ 更新 README 或索引文档，说明哪些为 legacy/demo
- ✅ 建立废弃项索引文档（`docs/DEPRECATION_INDEX.md`）

**禁止动作**:

- ❌ 在代码中添加 `@deprecated` 注释（Phase A 仅做文档标注）

**禁止动作**:

- ❌ 删除任何文件
- ❌ 移动任何文件
- ❌ 修改现有代码逻辑

---

### Phase B：Stage 3 Close 后（建立索引 + 可选复制快照）

**目标**: 建立 stage-history 索引 + 可选复制快照（不移动原文件），不删除。

**允许动作**:

- ✅ 建立 `docs/stage-history/` 索引文档，指向原文档路径
- ✅ 可选：复制历史文档快照到 `docs/stage-history/`（原文档保持不动）
- ✅ 可选：复制 Demo 脚本快照到 `tools/dev/_archive/`（原脚本保持不动）
- ✅ 可选：复制旧测试集快照到 `apps/api/tests/_archive/`（原测试集保持不动）
- ✅ 更新文档索引，指向原路径或快照位置

**禁止动作**:

- ❌ 移动任何原文件（原文件保持不动以维持证据链）
- ❌ 物理删除任何文件
- ❌ 删除任何代码或配置

---

### Phase C：Stage 4 Close 后（物理删除，仅限极少且可证明安全）

**目标**: 仅允许极少且可证明安全的物理删除。

**前置条件**:

- ✅ Stage 4 已 Close
- ✅ 所有 Gap 已修复
- ✅ 所有新能力已稳定
- ✅ 完成数据迁移与完整回归验证

**允许动作**:

- ✅ 删除已完全替代的 Demo 脚本（需证明无引用）
- ✅ 删除已迁移的旧测试集（需证明无引用）

**禁止动作**:

- ❌ 删除 Prisma `@deprecated` 关系（已从本计划剥离，见 `docs/DB_DEPRECATION_REMOVAL_RFC.md`）

**禁止动作**:

- ❌ 删除任何 Gate / Smoke / Audit / Risk / Health 相关脚本
- ❌ 删除任何文档历史证据（只能归档）

---

## 三、逐项清理计划（DEP-XXX）

### DEP-001 — 旧 ProjectEpisodes 关系（Prisma Schema 向下兼容）

**⚠️ 已从本清理计划剥离**

**说明**: DEP-001（Prisma `@deprecated` 关系删除）涉及数据库 Schema 变更，风险较高，已从本清理计划剥离。

**单独规划**: 见 `docs/DB_DEPRECATION_REMOVAL_RFC.md`（仅占位，不执行）

---

### DEP-002 — minimal-worker 示例 Worker

#### 拟处理时机

- **Phase A**: 保持现状，在文档中标注为“Stage2 验证 Demo Worker”
- **Phase B**: 不处理（保留作为历史验证 Demo）
- **Phase C**: 不处理（建议永久保留作为历史验证 Demo）

#### 动作类型

- **Phase A**: 标记为“Demo Worker”（在 README 或文档中说明）
- **Phase B**: 不适用
- **Phase C**: 保留（不建议删除）

#### 变更文件清单

- 无（仅文档标注）

#### 回滚方案

- 不适用（无变更）

#### 自动化验证

- 不适用（无变更）

#### 人工验证

- 不适用（无变更）

#### 删除前置证明

- **结论**: **不建议删除**，应永久保留作为 Stage2 验证 Demo Worker。

---

### DEP-003 — 旧 Studio 组件 `_legacy/studio/*`

#### 拟处理时机

- **Phase A**: 保持现状，确保 `_legacy` 目录在 lint 配置中标记为“冻结区域”
- **Phase B**: 建立索引 + 可选复制快照（不移动原文件，不更新引用）
- **Phase C**: 评估删除（需证明新版 Studio UI 已完全替代）

#### 动作类型

- **Phase A**: 标记为“冻结区域”（已在 lint 配置中）
- **Phase B**: 建立索引 + 可选复制快照（不移动原文件，不更新引用）
- **Phase C**: 删除（需证明无引用 + 新版 UI 已完全替代）

#### 变更文件清单

**Phase B（建立索引 + 可选复制快照）**:

- `docs/stage-history/components-index.md` - 新增索引文档，指向 `apps/web/src/components/_legacy/studio/*`
- 可选：`apps/web/src/components/_archive/studio/ProjectEmptyState.tsx` - 复制快照（原文件保持不动）
- 可选：`apps/web/src/components/_archive/studio/SemanticInfoPanel.tsx` - 复制快照（原文件保持不动）
- 可选：`apps/web/src/components/_archive/studio/QualityHintPanel.tsx` - 复制快照（原文件保持不动）
- 可选：`apps/web/src/components/_archive/studio/ShotPlanningPanel.tsx` - 复制快照（原文件保持不动）

**Phase C（删除）**:

- 删除 `apps/web/src/components/_legacy/studio/*` 目录（原路径，与 DEP 索引一致）
- 注意：若 Phase B 仅创建快照，则 Phase C 删除目标为原路径，快照目录仅作备份，不代表引用切换

#### 回滚方案

**Phase B 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 确认索引文档已删除（原文件未移动，无需恢复）

**Phase C 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 运行 `pnpm --filter web build` 确认回滚成功

#### 自动化验证

**Phase B（建立索引 + 可选复制快照）**:

- **脚本清单**:
  1. **文档链接验证**: 自定义脚本 - 验证索引文档链接有效，原文件路径仍有效
  2. **Lint 验证**: `pnpm --filter web lint`（确认原文件未修改）
  3. **Build 验证**: `pnpm --filter web build`（确认原文件未修改）
  4. **TypeCheck 验证**: `pnpm --filter web typecheck`（确认原文件未修改）
  5. **引用检查**: 确认无 import/引用被更新（原文件路径保持不变）

**Phase C（删除）**:

- **脚本清单**:
  1. **Lint 验证**: `pnpm --filter web lint`
  2. **Build 验证**: `pnpm --filter web build`
  3. **TypeCheck 验证**: `pnpm --filter web typecheck`
  4. **E2E 验证**: `pnpm --filter web test:e2e`

#### 人工验证

**Phase B（建立索引 + 可选复制快照）**:

- **Checklist 引用**: Stage 3 - UI 组件索引检查
- **关键检查项**:
  - [ ] 索引文档已创建，指向原组件路径
  - [ ] 原组件未移动（保持原路径）
  - [ ] 可选快照已创建（如选择复制）
  - [ ] 无构建错误

**Phase C（删除）**:

- **Checklist 引用**: Stage 4 - UI 组件清理检查
- **关键检查项**:
  - [ ] 新版 Studio UI 已完全替代旧版
  - [ ] 无代码引用旧组件
  - [ ] 前端 E2E 测试全部通过

#### 删除前置证明

**Phase C 必须证明**:

1. **无代码引用**:
   - 执行 `grep -r "_legacy/studio" apps/web/src` 确认无引用（原路径）
   - 执行 `grep -r "ProjectEmptyState\|SemanticInfoPanel\|QualityHintPanel\|ShotPlanningPanel" apps/web/src` 确认无引用（排除 `_archive` 快照目录，快照目录仅作备份，不代表引用切换）
2. **新版 UI 已替代**:
   - 确认新版 Studio UI 组件已实现所有旧组件功能
   - 确认前端 E2E 测试覆盖新版 UI
3. **无门禁依赖**:
   - 确认 `tools/gate/run_launch_gates.sh` 不依赖旧组件
   - 确认 `tools/smoke/*` 脚本不依赖旧组件

---

### DEP-010 — 旧版 API E2E 测试备份集 `apps/api_tests_backup`

#### 拟处理时机

- **Phase A**: 保持现状，在文档中标注为“历史 E2E 场景库”
- **Phase B**: 建立索引 + 可选复制快照（不移动原文件，不更新引用）
- **Phase C**: 评估删除（需证明有价值的场景已迁移到新测试框架）

#### 动作类型

- **Phase A**: 标记为“历史 E2E 场景库”（在 README 中说明）
- **Phase B**: 建立索引 + 可选复制快照（不移动原文件，不更新引用）
- **Phase C**: 删除（需证明有价值的场景已迁移）

#### 变更文件清单

**Phase B（建立索引 + 可选复制快照）**:

- `docs/stage-history/tests-index.md` - 新增索引文档，指向 `apps/api_tests_backup/`
- 可选：`apps/api/tests/_archive/` - 复制快照（原目录 `apps/api_tests_backup/` 保持不动）

**Phase C（删除）**:

- **默认删除目标**: `apps/api/tests/_archive/` 快照目录（若 Phase B 仅创建快照）
- **高风险删除目标**: `apps/api_tests_backup/` 原目录（需额外证明：有价值的场景已迁移到新测试框架，且原目录无任何引用）
- **注意**: 若 Phase B 只是复制快照，删除原目录 `apps/api_tests_backup/` 仍是高风险，需额外证明无引用且已替代

#### 回滚方案

**Phase B 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 确认索引文档已删除（原目录未移动，无需恢复）

**Phase C 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 运行 `pnpm --filter api test` 确认回滚成功

#### 自动化验证

**Phase B（建立索引 + 可选复制快照）**:

- **脚本清单**:
  1. **文档链接验证**: 自定义脚本 - 验证索引文档链接有效，原目录路径仍有效
  2. **Lint 验证**: `pnpm --filter api lint`（确认原目录未修改）
  3. **TypeCheck 验证**: `pnpm --filter api typecheck`（确认原目录未修改）
  4. **引用检查**: 确认无引用被更新（原目录路径保持不变）

**Phase C（删除）**:

- **脚本清单**:
  1. **Lint 验证**: `pnpm --filter api lint`
  2. **TypeCheck 验证**: `pnpm --filter api typecheck`
  3. **门禁验证**: `bash tools/gate/run_launch_gates.sh`

#### 人工验证

**Phase B（建立索引 + 可选复制快照）**:

- **Checklist 引用**: Stage 3 - 测试集索引检查
- **关键检查项**:
  - [ ] 索引文档已创建，指向原测试集路径
  - [ ] 原测试集未移动（保持原路径）
  - [ ] 可选快照已创建（如选择复制）
  - [ ] 无构建错误

**Phase C（删除）**:

- **Checklist 引用**: Stage 4 - 测试集清理检查
- **关键检查项**:
  - [ ] 有价值的场景已迁移到新测试框架（如 Phase B 仅创建快照，需额外证明原目录可安全删除）
  - [ ] 无代码引用旧测试集（原目录 `apps/api_tests_backup/`）
  - [ ] Gate/Smoke 测试全部通过

#### 删除前置证明

**Phase C 必须证明**:

1. **有价值的场景已迁移**:
   - 确认权限、组织隔离、Engine Adapter 等关键场景已在新测试框架中实现
   - 确认新测试框架覆盖度不低于旧测试集
   - **注意**: 若 Phase B 仅创建快照，删除原目录 `apps/api_tests_backup/` 需额外证明无引用且已替代
2. **无代码引用**:
   - 执行 `grep -r "api_tests_backup\|tests/_archive" apps/ packages/ tools/` 确认无引用（排除文档）
3. **无门禁依赖**:
   - 确认 `tools/gate/run_launch_gates.sh` 不依赖旧测试集
   - 确认 `tools/smoke/*` 脚本不依赖旧测试集

---

### DEP-020 — headless-worker 调试脚本

#### 拟处理时机

- **Phase A**: 保持现状，在文档中标注为“本地调试工具，禁止在 CI/Prod 使用（仅文档约束）”
- **Phase B**: 建立索引 + 可选复制快照到 `tools/dev/_archive/headless-worker.ts`（原文件保持不动）
- **Phase C**: 评估删除（需证明 Stage4 正式 Worker 流程已完全稳定）

#### 动作类型

- **Phase A**: 文档标注（不修改代码）
- **Phase B**: 建立索引 + 可选复制快照（不移动原文件）
- **Phase C**: 删除（需证明无引用 + 正式 Worker 已稳定）

#### 变更文件清单

**Phase A（标注）**:

- 无（仅文档标注，不修改代码）

**Phase B（建立索引 + 可选复制快照）**:

- `docs/stage-history/tools-index.md` - 新增索引文档，指向 `tools/headless-worker.ts`
- 可选：`tools/dev/_archive/headless-worker.ts` - 复制快照（原文件 `tools/headless-worker.ts` 保持不动）

**Phase C（删除）**:

- 删除 `tools/headless-worker.ts`（原路径，与 DEP 索引一致）
- 注意：若 Phase B 仅创建快照，则 Phase C 删除目标为原路径，快照目录仅作备份，不代表引用切换

#### 回滚方案

**Phase A 回滚**: 不适用（仅文档标注）

**Phase B 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 确认索引文档已删除（原文件未移动，无需恢复）

**Phase C 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 运行 `bash tools/gate/run_launch_gates.sh` 确认回滚成功

#### 自动化验证

**Phase B（建立索引 + 可选复制快照）**:

- **脚本清单**:
  1. **文档链接验证**: 自定义脚本 - 验证索引文档链接有效，原文件路径仍有效
  2. **Lint 验证**: `pnpm -r lint`（确认原文件未修改）
  3. **TypeCheck 验证**: `pnpm -r typecheck`（确认原文件未修改）
  4. **引用检查**: 确认无引用被更新（原文件路径保持不变）

**Phase C（删除）**:

- **脚本清单**:
  1. **Lint 验证**: `pnpm -r lint`
  2. **TypeCheck 验证**: `pnpm -r typecheck`
  3. **门禁验证**: `bash tools/gate/run_launch_gates.sh`

#### 人工验证

**Phase B（建立索引 + 可选复制快照）**:

- **Checklist 引用**: Stage 3 - 调试脚本索引检查
- **关键检查项**:
  - [ ] 索引文档已创建，指向原脚本路径
  - [ ] 原脚本未移动（保持原路径）
  - [ ] 可选快照已创建（如选择复制）
  - [ ] 无引用被更新（原文件路径保持不变）
  - [ ] 无构建错误

**Phase C（删除）**:

- **Checklist 引用**: Stage 4 - 调试脚本清理检查
- **关键检查项**:
  - [ ] Stage4 正式 Worker 流程已完全稳定
  - [ ] 无代码引用该脚本（原路径 `tools/headless-worker.ts`）
  - [ ] Gate/Smoke 测试全部通过

#### 删除前置证明

**Phase C 必须证明**:

1. **无代码引用**:
   - 执行 `grep -r "headless-worker" apps/ packages/ tools/` 确认无引用（排除文档和快照目录）
   - 注意：快照目录仅作备份，不代表引用切换
2. **正式 Worker 已稳定**:
   - 确认 `apps/workers/src/*` 已实现完整的 Worker 流程
   - 确认 Stage4 正式 Worker 已通过所有验证
3. **无门禁依赖**:
   - 确认 `tools/gate/run_launch_gates.sh` 不依赖该脚本
   - 确认 `tools/smoke/*` 脚本不依赖该脚本

---

### DEP-021 — mock-worker 调试脚本

#### 拟处理时机

- **Phase A**: 保持现状，在文档中标注为“本地调试工具，禁止在 CI/Prod 使用（仅文档约束）”
- **Phase B**: 建立索引 + 可选复制快照到 `tools/dev/_archive/mock-worker.ts`（原文件保持不动）
- **Phase C**: 评估删除（需证明无引用）

#### 动作类型

- **Phase A**: 文档标注（不修改代码）
- **Phase B**: 建立索引 + 可选复制快照（不移动原文件）
- **Phase C**: 删除（需证明无引用）

#### 变更文件清单

**Phase A（标注）**:

- 无（仅文档标注，不修改代码）

**Phase B（建立索引 + 可选复制快照）**:

- `docs/stage-history/tools-index.md` - 新增索引文档，指向 `tools/mock-worker.ts`
- 可选：`tools/dev/_archive/mock-worker.ts` - 复制快照（原文件 `tools/mock-worker.ts` 保持不动）

**Phase C（删除）**:

- 删除 `tools/mock-worker.ts`（原路径，与 DEP 索引一致）
- 注意：若 Phase B 仅创建快照，则 Phase C 删除目标为原路径，快照目录仅作备份，不代表引用切换

#### 回滚方案

**Phase A 回滚**: 不适用（仅文档标注）

**Phase B 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 确认索引文档已删除（原文件未移动，无需恢复）

**Phase C 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 运行 `bash tools/gate/run_launch_gates.sh` 确认回滚成功

#### 自动化验证

**Phase B（建立索引 + 可选复制快照）**:

- **脚本清单**:
  1. **文档链接验证**: 自定义脚本 - 验证索引文档链接有效，原文件路径仍有效
  2. **Lint 验证**: `pnpm -r lint`（确认原文件未修改）
  3. **TypeCheck 验证**: `pnpm -r typecheck`（确认原文件未修改）
  4. **引用检查**: 确认无引用被更新（原文件路径保持不变）

**Phase C（删除）**:

- **脚本清单**:
  1. **Lint 验证**: `pnpm -r lint`
  2. **TypeCheck 验证**: `pnpm -r typecheck`
  3. **门禁验证**: `bash tools/gate/run_launch_gates.sh`

#### 人工验证

**Phase B（建立索引 + 可选复制快照）**:

- **Checklist 引用**: Stage 3 - 调试脚本索引检查
- **关键检查项**:
  - [ ] 索引文档已创建，指向原脚本路径
  - [ ] 原脚本未移动（保持原路径）
  - [ ] 可选快照已创建（如选择复制）
  - [ ] 无引用被更新（原文件路径保持不变）
  - [ ] 无构建错误

**Phase C（删除）**:

- **Checklist 引用**: Stage 4 - 调试脚本清理检查
- **关键检查项**:
  - [ ] 无代码引用该脚本（原路径 `tools/mock-worker.ts`）
  - [ ] Gate/Smoke 测试全部通过

#### 删除前置证明

**Phase C 必须证明**:

1. **无代码引用**:
   - 执行 `grep -r "mock-worker" apps/ packages/ tools/` 确认无引用（排除文档和快照目录）
   - 注意：快照目录仅作备份，不代表引用切换
2. **无门禁依赖**:
   - 确认 `tools/gate/run_launch_gates.sh` 不依赖该脚本
   - 确认 `tools/smoke/*` 脚本不依赖该脚本

---

### DEP-022 — HMAC Replay Demo 脚本

#### 拟处理时机

- **Phase A**: 保持现状，在文档中标注为“安全 Demo 工具”
- **Phase B**: 不处理（保留作为安全 Demo 工具）
- **Phase C**: 不处理（建议永久保留作为安全 Demo 工具）

#### 动作类型

- **Phase A**: 标记为“安全 Demo 工具”（在 README 中说明）
- **Phase B**: 不适用
- **Phase C**: 保留（不建议删除）

#### 变更文件清单

- 无（仅文档标注）

#### 回滚方案

- 不适用（无变更）

#### 自动化验证

- 不适用（无变更）

#### 人工验证

- 不适用（无变更）

#### 删除前置证明

- **结论**: **不建议删除**，应永久保留作为安全 Demo 工具。

---

### DEP-030 — Stage1 早期差异与规划文档

#### 拟处理时机

- **Phase A**: 保持现状
- **Phase B**: 归档到 `docs/stage-history/stage1/`（不删除）
- **Phase C**: 不处理（建议永久保留作为历史档案）

#### 动作类型

- **Phase A**: 不处理
- **Phase B**: 建立索引 + 可选复制快照到 `docs/stage-history/stage1/`（原文档保持不动）
- **Phase C**: 保留（不建议删除）

#### 变更文件清单

**Phase B（建立索引 + 可选复制快照）**:

- `docs/stage-history/stage1-index.md` - 新增索引文档，指向原文档路径
- 可选：`docs/stage-history/stage1/stage1_gap_report.md` - 复制快照（原文件 `docs/stage1_gap_report.md` 保持不动）
- 可选：`docs/stage-history/stage1/STAGE1_DB_SCHEMA_DELTA_PLAN.md` - 复制快照（原文件保持不动）
- 可选：`docs/stage-history/stage1/STAGE1_DB_MIGRATION_SOP.md` - 复制快照（原文件保持不动）
- 可选：`docs/stage-history/stage1/STAGE1_EXECUTION_REPORT.md` - 复制快照（原文件保持不动）

#### 回滚方案

**Phase B 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 确认文档引用路径正确

#### 自动化验证

**Phase B（归档）**:

- **脚本清单**:
  1. **文档链接验证**: 自定义脚本 - 验证所有文档链接仍有效

#### 人工验证

**Phase B（归档）**:

- **Checklist 引用**: Stage 3 - 文档归档检查
- **关键检查项**:
  - [ ] 所有文档已迁移到 `stage-history` 目录
  - [ ] 文档引用路径已更新
  - [ ] 文档索引已更新

#### 删除前置证明

- **结论**: **不建议删除**，应永久保留作为历史档案。

---

### DEP-031 — Stage2 早期规划与执行文档

#### 拟处理时机

- **Phase A**: 保持现状
- **Phase B**: 归档到 `docs/stage-history/stage2/`（不删除）
- **Phase C**: 不处理（建议永久保留作为历史档案）

#### 动作类型

- **Phase A**: 不处理
- **Phase B**: 建立索引 + 可选复制快照到 `docs/stage-history/stage2/`（原文档保持不动）
- **Phase C**: 保留（不建议删除）

#### 变更文件清单

**Phase B（建立索引 + 可选复制快照）**:

- `docs/stage-history/stage2-index.md` - 新增索引文档，指向原文档路径
- 可选：复制快照到 `docs/stage-history/stage2/`（原文档保持不动）

#### 回滚方案

**Phase B 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 确认文档引用路径正确

#### 自动化验证

**Phase B（归档）**:

- **脚本清单**:
  1. **文档链接验证**: 自定义脚本 - 验证所有文档链接仍有效

#### 人工验证

**Phase B（归档）**:

- **Checklist 引用**: Stage 3 - 文档归档检查
- **关键检查项**:
  - [ ] 所有文档已迁移到 `stage-history` 目录
  - [ ] 文档引用路径已更新
  - [ ] 文档索引已更新

#### 删除前置证明

- **结论**: **不建议删除**，应永久保留作为历史档案。

---

### DEP-032 — Stage3 早期规划文档

#### 拟处理时机

- **Phase A**: 保持现状
- **Phase B**: 归档到 `docs/stage-history/stage3/`（不删除）
- **Phase C**: 不处理（建议永久保留作为历史档案）

#### 动作类型

- **Phase A**: 不处理
- **Phase B**: 建立索引 + 可选复制快照到 `docs/stage-history/stage3/`（原文档保持不动）
- **Phase C**: 保留（不建议删除）

#### 变更文件清单

**Phase B（建立索引 + 可选复制快照）**:

- `docs/stage-history/stage3-index.md` - 新增索引文档，指向原文档路径
- 可选：复制快照到 `docs/stage-history/stage3/`（原文档保持不动）

#### 回滚方案

**Phase B 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 确认索引文档已删除（原文档未移动，无需恢复）

#### 自动化验证

**Phase B（建立索引 + 可选复制快照）**:

- **脚本清单**:
  1. **文档链接验证**: 自定义脚本 - 验证索引文档链接有效，原文档路径仍有效

#### 人工验证

**Phase B（建立索引 + 可选复制快照）**:

- **Checklist 引用**: Stage 3 - 文档索引检查
- **关键检查项**:
  - [ ] 索引文档已创建，指向原文档路径
  - [ ] 原文档未移动（保持原路径以维持证据链）
  - [ ] 可选快照已创建（如选择复制）
  - [ ] 文档索引已更新

#### 删除前置证明

- **结论**: **不建议删除**，应永久保留作为历史档案。

---

### DEP-033 — Stage4 早期规划与 MVP Close 文档

#### 拟处理时机

- **Phase A**: 保持现状
- **Phase B**: 归档到 `docs/stage-history/stage4/`（不删除）
- **Phase C**: 不处理（建议永久保留作为历史档案）

#### 动作类型

- **Phase A**: 不处理
- **Phase B**: 建立索引 + 可选复制快照到 `docs/stage-history/stage4/`（原文档保持不动）
- **Phase C**: 保留（不建议删除）

#### 变更文件清单

**Phase B（建立索引 + 可选复制快照）**:

- `docs/stage-history/stage4-index.md` - 新增索引文档，指向原文档路径
- 可选：复制快照到 `docs/stage-history/stage4/`（原文档保持不动）

#### 回滚方案

**Phase B 回滚**:

1. **代码回滚**: `git revert <commit-hash>`
2. **验证回滚**: 确认文档引用路径正确

#### 自动化验证

**Phase B（归档）**:

- **脚本清单**:
  1. **文档链接验证**: 自定义脚本 - 验证所有文档链接仍有效

#### 人工验证

**Phase B（归档）**:

- **Checklist 引用**: Stage 3 - 文档归档检查
- **关键检查项**:
  - [ ] 所有文档已迁移到 `stage-history` 目录
  - [ ] 文档引用路径已更新
  - [ ] 文档索引已更新

#### 删除前置证明

- **结论**: **不建议删除**，应永久保留作为历史档案（特别是 FINAL_CLOSE_REPORT 与 CHECKLIST）。

---

### DEP-034 — Stage9 / Stage10 / Stage12 / Stage13 相关文档

#### 拟处理时机

- **Phase A**: 保持现状
- **Phase B**: 不处理（保留作为未来 Stage5+ / Stage9+ 的路线与证据）
- **Phase C**: 不处理（建议永久保留作为未来路线图）

#### 动作类型

- **Phase A**: 不处理
- **Phase B**: 不处理
- **Phase C**: 保留（不建议删除或归档）

#### 变更文件清单

- 无（不建议处理）

#### 回滚方案

- 不适用（无变更）

#### 自动化验证

- 不适用（无变更）

#### 人工验证

- 不适用（无变更）

#### 删除前置证明

- **结论**: **不建议删除或归档**，应保留作为未来 Stage5+ / Stage9+ 的路线与证据。

---

## 四、清理执行顺序（EXECUTION ORDER）

### Phase A：Stage 1-2 期间（零风险动作）

**执行顺序**:

0. **索引文件校验/生成**: 确认 `docs/DEPRECATION_INDEX.md` 已存在且包含全部 DEP-XXX（若缺失则补齐）
   - **预期输出**: 索引表存在且可查找（按类型/风险/Phase）
   - **判定标准**: ✅ PASS（索引完整） / ❌ FAIL（缺失或不完整）
   - **失败即停止**: 是

1. **DEP-002**: 在文档中标注 minimal-worker 为"Stage2 验证 Demo Worker，永久保留"
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

2. **DEP-010**: 在文档中标注 `apps/api_tests_backup` 为“历史 E2E 场景库，仅参考，不接入 gate”
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

3. **DEP-020**: 在文档中标注 `tools/headless-worker.ts` 为“本地调试工具，禁止在 CI/Prod 使用（仅文档约束）”
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

4. **DEP-021**: 在文档中标注 `tools/mock-worker.ts` 为“本地调试工具，禁止在 CI/Prod 使用（仅文档约束）”
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

5. **DEP-022**: 在文档中标注 `tools/dev/hmac-replay-demo.ts` 为“安全 Demo 工具，永久保留”
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

6. **DEP-030**: 在文档中标注 Stage1 早期文档为“历史证据文档，保留原路径；若需归档仅做复制快照，不移动”
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

7. **DEP-031**: 在文档中标注 Stage2 早期文档为“历史证据文档，保留原路径；若需归档仅做复制快照，不移动”
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

8. **DEP-032**: 在文档中标注 Stage3 早期文档为“历史证据文档，保留原路径；若需归档仅做复制快照，不移动”
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

9. **DEP-033**: 在文档中标注 Stage4 早期文档为“历史证据文档，保留原路径；若需归档仅做复制快照，不移动”
   - **预期输出**: 文档已更新
   - **判定标准**: ✅ PASS（文档已更新） / ❌ FAIL（文档未更新）
   - **失败即停止**: 否

**Phase A 总体判定**:

- ✅ **PASS**: 所有文档标注动作完成，索引文档已创建
- ❌ **FAIL**: 任一关键动作失败

---

### Phase B：Stage 3 Close 后（建立索引 + 可选复制快照）

**前置条件**:

- ✅ Stage 3 已 Close
- ✅ 自动化验证全部 PASS
- ✅ 人工验证全部 PASS

**执行顺序**:

1. **DEP-003**: 建立索引 `docs/stage-history/components-index.md` 指向原路径；可选复制快照到 `apps/web/src/components/_archive/studio/`（原文件保持不动）；不更新任何 import/引用
   - **预期输出**: 索引文档已创建，可选快照已创建，原文件未移动
   - **判定标准**: ✅ PASS（索引创建成功 + 文档链接验证通过 + lint/build/typecheck 通过 + 无引用被更新） / ❌ FAIL（索引创建失败或构建错误或引用被误更新）
   - **失败即停止**: 是

2. **DEP-010**: 建立索引 `docs/stage-history/tests-index.md` 指向原路径；可选复制快照到 `apps/api/tests/_archive/`（原目录 `apps/api_tests_backup/` 保持不动）；不更新引用
   - **预期输出**: 索引文档已创建，可选快照已创建，原目录未移动
   - **判定标准**: ✅ PASS（索引创建成功 + 文档链接验证通过 + lint/typecheck 通过 + 无引用被更新） / ❌ FAIL（索引创建失败或构建错误或引用被误更新）
   - **失败即停止**: 是

3. **DEP-020**: 建立索引 `docs/stage-history/tools-index.md` 指向原路径；可选复制快照到 `tools/dev/_archive/headless-worker.ts`（原文件 `tools/headless-worker.ts` 保持不动）；不更新引用
   - **预期输出**: 索引文档已创建，可选快照已创建，原文件未移动
   - **判定标准**: ✅ PASS（索引创建成功 + 文档链接验证通过 + lint/typecheck 通过 + 无引用被更新） / ❌ FAIL（索引创建失败或构建错误或引用被误更新）
   - **失败即停止**: 是

4. **DEP-021**: 建立索引 `docs/stage-history/tools-index.md` 指向原路径；可选复制快照到 `tools/dev/_archive/mock-worker.ts`（原文件 `tools/mock-worker.ts` 保持不动）；不更新引用
   - **预期输出**: 索引文档已创建，可选快照已创建，原文件未移动
   - **判定标准**: ✅ PASS（索引创建成功 + 文档链接验证通过 + lint/typecheck 通过 + 无引用被更新） / ❌ FAIL（索引创建失败或构建错误或引用被误更新）
   - **失败即停止**: 是

5. **DEP-030**: 建立索引 `docs/stage-history/stage1-index.md` 指向原路径；可选复制快照到 `docs/stage-history/stage1/`（原文档保持不动）
   - **预期输出**: 索引文档已创建，可选快照已创建，原文档未移动
   - **判定标准**: ✅ PASS（索引创建成功 + 文档链接验证通过） / ❌ FAIL（索引创建失败或链接失效）
   - **失败即停止**: 否

6. **DEP-031**: 建立索引 `docs/stage-history/stage2-index.md` 指向原路径；可选复制快照到 `docs/stage-history/stage2/`（原文档保持不动）
   - **预期输出**: 索引文档已创建，可选快照已创建，原文档未移动
   - **判定标准**: ✅ PASS（索引创建成功 + 文档链接验证通过） / ❌ FAIL（索引创建失败或链接失效）
   - **失败即停止**: 否

7. **DEP-032**: 建立索引 `docs/stage-history/stage3-index.md` 指向原路径；可选复制快照到 `docs/stage-history/stage3/`（原文档保持不动）
   - **预期输出**: 索引文档已创建，可选快照已创建，原文档未移动
   - **判定标准**: ✅ PASS（索引创建成功 + 文档链接验证通过） / ❌ FAIL（索引创建失败或链接失效）
   - **失败即停止**: 否

8. **DEP-033**: 建立索引 `docs/stage-history/stage4-index.md` 指向原路径；可选复制快照到 `docs/stage-history/stage4/`（原文档保持不动）
   - **预期输出**: 索引文档已创建，可选快照已创建，原文档未移动
   - **判定标准**: ✅ PASS（索引创建成功 + 文档链接验证通过） / ❌ FAIL（索引创建失败或链接失效）
   - **失败即停止**: 否

**Phase B 总体判定**:

- ✅ **PASS**: 所有索引/快照动作完成，所有验证通过，无引用被误更新
- ❌ **FAIL**: 任一关键动作失败（DEP-003, DEP-010, DEP-020, DEP-021 失败即停止）

---

### Phase C：Stage 4 Close 后（物理删除，仅限极少且可证明安全）

**前置条件**:

- ✅ Stage 4 已 Close
- ✅ 所有 Gap 已修复
- ✅ 所有新能力已稳定
- ✅ 完成数据迁移与完整回归验证
- ✅ Phase B 已完成（索引 + 可选快照已建立）

**删除目标原则**:

- ✅ 删除目标路径必须与 DEP 索引一致（原路径，不是快照路径）
- ✅ 若 Phase B 仅创建快照，则 Phase C 删除目标为原路径
- ✅ 快照目录仅作备份，不代表引用切换，删除时需明确区分

**执行顺序**:

1. **DEP-003**: 删除旧 Studio 组件（需证明新版 UI 已完全替代）
   - **删除目标**: `apps/web/src/components/_legacy/studio/*`（原路径，与 DEP 索引一致）
   - **预期输出**: 组件已删除，所有验证通过
   - **判定标准**: ✅ PASS（删除成功 + 无引用证明 + 所有 Gate/Smoke/E2E 通过） / ❌ FAIL（删除失败或验证失败）
   - **失败即停止**: 是

2. **DEP-010**: 删除旧版 API E2E 测试备份集（需证明有价值的场景已迁移）
   - **删除目标**: 默认删除 `apps/api/tests/_archive/` 快照目录；高风险删除 `apps/api_tests_backup/` 原目录需额外证明
   - **预期输出**: 测试集已删除，所有验证通过
   - **判定标准**: ✅ PASS（删除成功 + 场景迁移证明 + 所有 Gate/Smoke 通过） / ❌ FAIL（删除失败或验证失败）
   - **失败即停止**: 是

3. **DEP-020**: 删除 headless-worker 调试脚本（需证明无引用 + 正式 Worker 已稳定）
   - **删除目标**: `tools/headless-worker.ts`（原路径，与 DEP 索引一致）
   - **预期输出**: 脚本已删除，所有验证通过
   - **判定标准**: ✅ PASS（删除成功 + 无引用证明 + 所有 Gate/Smoke 通过） / ❌ FAIL（删除失败或验证失败）
   - **失败即停止**: 是

4. **DEP-021**: 删除 mock-worker 调试脚本（需证明无引用）
   - **删除目标**: `tools/mock-worker.ts`（原路径，与 DEP 索引一致）
   - **预期输出**: 脚本已删除，所有验证通过
   - **判定标准**: ✅ PASS（删除成功 + 无引用证明 + 所有 Gate/Smoke 通过） / ❌ FAIL（删除失败或验证失败）
   - **失败即停止**: 是

**Phase C 总体判定**:

- ✅ **PASS**: 所有删除动作完成，所有验证通过
- ❌ **FAIL**: 任一删除动作失败或验证失败（失败即停止）

---

## 五、清理计划总结

### 5.1 按阶段统计

| 阶段        | 动作数量 | 删除数量 | 索引/快照数量 | 标注数量 |
| :---------- | :------: | :------: | :-----------: | :------: |
| **Phase A** |    9     |    0     |       0       |    9     |
| **Phase B** |    8     |    0     |       8       |    0     |
| **Phase C** |    4     |    4     |       0       |    0     |

### 5.2 永久保留项

以下项**永久保留**，不建议删除或归档：

- ✅ **DEP-001**: Prisma `@deprecated` 关系（已从本计划剥离，见 `docs/DB_DEPRECATION_REMOVAL_RFC.md`）
- ✅ **DEP-002**: minimal-worker（Stage2 验证 Demo Worker）
- ✅ **DEP-022**: HMAC Replay Demo（安全 Demo 工具）
- ✅ **DEP-034**: Stage9-13 相关文档（未来路线图）

### 5.3 清理风险汇总

| 风险等级 | Phase A | Phase B | Phase C |
| :------- | :-----: | :-----: | :-----: |
| **P0**   |    0    |    0    |    0    |
| **P1**   |    0    |    4    |    5    |
| **P2**   |    7    |    4    |    0    |

---

## 六、执行前置条件检查清单

### Phase A 前置条件

- [ ] Stage 1 进行中或已 Close
- [ ] Stage 2 进行中或已 Close

### Phase B 前置条件

- [ ] Stage 3 已 Close
- [ ] 自动化验证全部 PASS
- [ ] 人工验证全部 PASS
- [ ] 已创建 `docs/stage-history/` 目录结构

### Phase C 前置条件

- [ ] Stage 4 已 Close
- [ ] 所有 Gap 已修复
- [ ] 所有新能力已稳定
- [ ] 完成数据迁移与完整回归验证
- [ ] 已完成 Phase B 所有归档动作

---

## 七、失败即停止规则

### 7.1 Phase A

- **任何关键动作失败**: 立即停止，修复后继续

### 7.2 Phase B

- **DEP-003 失败**: 立即停止，修复后继续
- **DEP-010 失败**: 立即停止，修复后继续
- **DEP-020 失败**: 立即停止，修复后继续
- **DEP-021 失败**: 立即停止，修复后继续

### 7.3 Phase C

- **任何删除动作失败**: 立即停止，修复后继续
- **任何验证失败**: 立即停止，修复后继续

---

**计划维护**: 每次 Phase 执行或 Stage Close 后必须更新本计划。

**重要声明**: 本计划仅用于规划，禁止在未获得明确批准前进入 EXECUTE 模式。
