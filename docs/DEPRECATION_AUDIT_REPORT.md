# 废弃项审计报告（Deprecation Audit Report）

**审计日期**: 2025-12-18  
**模式**: MODE: RESEARCH（只读审计；不改代码、不删文件）  
**审计范围**: 整个仓库（apps/_, packages/_, tools/_, docs/_, scripts/config/gates/smoke/test 等）

> 说明：本报告 **仅识别候选废弃项**，不做任何清理动作。  
> 任何实际删除 / 标记 `@deprecated` / 迁移动作，均应在后续 MODE: PLAN / EXECUTE 阶段由你确认后再实施。

---

## 一、审计原则与边界

- **禁止** 修改或删除任何代码、配置、脚本或现有文档内容。
- **只允许** 新增审计类文档（本文件）。
- **禁止** 将以下内容标记为“可安全删除”：
  - `docs/FULL_LAUNCH_GAP_REPORT.md` / `docs/FULL_LAUNCH_EXECUTION_PLAN.md` 中仍显式引用的任何文件或模块
  - 所有 Gate / Smoke / Audit / Risk / Health 相关脚本与文档
  - Stage 3 / Stage 4 未来需要的占位结构或预留路径
- 对每一个候选废弃项，仅给出 **风险评估 + 建议动作**，默认建议为“保留”或“延后到某 Stage 再评估”，**不做立即删除建议**。

---

## 二、候选废弃项总览

> 统计仅覆盖本次审计中识别出的 **主要** 候选项，不代表仓库中不存在更多需要后续补充的项。

| 类型 (Type)                 | 数量 | 说明                                                          |
| :-------------------------- | ---: | :------------------------------------------------------------ |
| Code（含 Generated Schema） |    3 | 主要是 Prisma 中标注为 `@deprecated` 的结构，以及向下兼容关系 |
| Test / Backup E2E           | 1 组 | `apps/api_tests_backup` 旧版 e2e 测试集                       |
| Script（工具 / Demo）       |    3 | worker/headless/mock 工具、HMAC Demo 等                       |
| Doc（历史 Stage / 旧规范）  | 9 组 | Stage2/3/4 旧规划文档、Stage9–13 历史执行与 UI 文档等         |

> 总体结论：**当前仓库中不存在“可立即安全删除”的核心代码或文档**。  
> 大部分候选项属于“历史执行证据 / Demo 工具 / 向下兼容结构”，建议在 Stage 3/4 Close 后再按计划清理。

---

## 三、按类型分类审计结果

### 3.1 Code / Schema 类（含 Generated 结构）

#### DEP-001 — 旧 ProjectEpisodes 关系（Prisma Schema 向下兼容）

- **类型**: Code / Schema
- **路径**: `packages/database/src/generated/prisma/schema.prisma`
- **定位**:
  - `episodes               Episode[]               @relation("ProjectEpisodes") // @deprecated 保留用于向下兼容`
  - 紧邻注释：`// @deprecated 根据 DBSpec V1.1，应使用四层结构（Project → Episode → Scene → Shot）`
- **当前状态**:
  - 明确标注为 `@deprecated`，用于兼容早期三层结构（Project → Season → Scene 或类似）。
  - 仍可能存在旧数据或旧代码路径依赖（未在本次 RESEARCH 中做静态引用图分析）。
- **最初用途（推断）**:
  - 早期 Project 与 Episode 的多对多或一对多关系，用于旧版内容结构。
- **是否被 Stage 1–4 使用**: 不确定（推断仍存在历史数据依赖）。
- **删除风险等级**: **P1**（数据兼容性风险，一个误删可能导致旧项目结构不可访问）。
- **建议动作**:
  - **短期（Stage 1–3）**: 保留，视为“兼容桥接层”；在代码中继续保持 `@deprecated` 标识即可。
  - **中期（Stage 4 Close 后）**:
    - 先执行一次 **结构与数据迁移审计**，确认所有项目均切换到新四层结构。
    - 迁移完成并通过自动化 + 人工验证后，再评估删除该关系。
  - **建议标注**: 若后续修改代码，可在业务层补充 `@deprecated` 注释与迁移路线说明。

---

#### DEP-002 — minimal-worker 示例 Worker（Minimal Worker Demo）

- **类型**: Code / Worker Demo
- **路径**: `apps/workers/minimal-worker/index.ts`
- **证据**:
  - `docs/STAGE2_B_RUNTIME_VERIFY.md` 中多次引用：
    - Worker 进程：`apps/workers/minimal-worker/index.ts`
    - 启动命令：`cd apps/workers/minimal-worker` 等
  - `docs/ESLINT_OVERRIDE_AUDIT.md` 中也包含针对该文件的 lint override 审计。
- **当前状态**:
  - 作为 Stage2 Runtime Verify 的 **示例 Worker / 最小实现**，仍被文档引用。
  - 并非生产 Worker 主实现，但用于验证 Engine Hub 与 Orchestrator。
- **最初用途（推断）**:
  - 提供一个可控的 Minimal Worker，用于 Stage2 引擎调度 / Orchestrator 路径的 E2E 验证。
- **是否被 Stage 1–4 使用**:
  - **是**：Stage2 验证文档仍将其视为官方 Demo Worker。
- **删除风险等级**: **P2**（删除会影响历史验证文档与未来回归的可复现性）。
- **建议动作**:
  - **保留**，作为 Stage2 验证 Demo Worker 的标准实现。
  - 若未来引入新的标准 Worker Demo，可在文档中将其标记为“legacy demo”，但不建议在近期删除。

---

#### DEP-003 — 旧 Studio 组件 `_legacy/studio/*`

- **类型**: Code / 前端组件
- **路径**:
  - `apps/web/src/components/_legacy/studio/ProjectEmptyState.tsx`
  - `apps/web/src/components/_legacy/studio/SemanticInfoPanel.tsx`
  - `apps/web/src/components/_legacy/studio/QualityHintPanel.tsx`
  - `apps/web/src/components/_legacy/studio/ShotPlanningPanel.tsx`
- **证据**:
  - `docs/ENGINEERING_LINT_DEBT_REPORT.md` 第 58 行：
    - `src/app/**/studio/**/*.tsx` 标记为“旧版 Studio，随产品迭代逐步废弃”
    - `apps/web/src/_archive` 亦被视为归档区域
  - `_legacy` 命名本身即表明是旧版组件。
- **当前状态**:
  - 组件位于 `_legacy` 命名空间，**已被工程治理标记为“冻结/待逐步废弃”**。
  - 新的 Studio 结构与组件已经在其他目录中落地（如新版控制台 / 结构视图）。
- **最初用途（推断）**:
  - v0.x 时代的 Studio UI 组件，用于早期演示与右侧面板功能。
- **是否被 Stage 1–4 使用**:
  - 目前主要作为 **历史 UI 与 lint 治理对象**，不是 Stage1–4 核心上线能力的一部分。
- **删除风险等级**: **P2**（删除会影响历史截图/文档与可能残余的 UI 路径；对核心后端影响较小）。
- **建议动作**:
  - **短期**: 保留 `_legacy` 目录，作为旧版 UI 的归档，并在 lint 配置中继续将其视为“冻结区域”。
  - **中长期（Stage 4 Close 后）**:
    - 若新版 Studio UI 已完全替代旧版，且不再需要回溯旧 UI 行为，可考虑在单独的“UI 归档清理”任务中删除 / 单独归档到 `archive/` 仓库。

---

### 3.2 Test / Backup E2E

#### DEP-010 — 旧版 API E2E 测试备份集 `apps/api_tests_backup`

- **类型**: Test / Backup E2E Suite
- **路径**:
  - 目录：`apps/api_tests_backup/`
  - 示例文件：
    - `apps/api_tests_backup/e2e/permissions-jobs.e2e-spec.ts`
    - `apps/api_tests_backup/e2e/organization-switch.e2e-spec.ts`
    - `apps/api_tests_backup/e2e/engine-adapter.e2e-spec.ts`
    - `apps/api_tests_backup/e2e/business-flow.e2e-spec.ts`
    - `apps/api_tests_backup/e2e/auth-flow.e2e.ts` / `.e2e-spec.ts`
    - `apps/api_tests_backup/unit/engine-registry.spec.ts`
- **证据**:
  - `apps/api_tests_backup` 未出现在主应用的 `package.json` 脚本或 CI pipeline 中（通过 grep 仅在 `docs/ESLINT_OVERRIDE_AUDIT.md` 被提及，作为 lint override 审计对象）。
- **当前状态**:
  - 早期 Nest E2E / 单元测试备份，**目前不参与主线 Gate / Smoke / Regression 流程**。
  - 仅在 ESLint 审计报告中被引用，用于记录历史 `any` 使用情况。
- **最初用途（推断）**:
  - 覆盖权限、组织隔离、Engine Adapter、Job Dashboard 等 API 流程的早期 E2E 套件。
- **是否被 Stage 1–4 使用**:
  - **否 / 不确定**：Stage1–4 当前 Gate 与 Smoke 已主要依赖 `tools/smoke/*`、`tools/gate/*`、`apps/api/test/*` 等路径。
- **删除风险等级**: **P1**（删除会丢失一份较完整的历史 E2E 场景参考；对当前 Gate/Smoke 不构成功能性破坏）。
- **建议动作**:
  - **短期**: 保留作为“历史 E2E 场景库”，特别是权限与组织隔离相关用例的参考。
  - **中长期（Stage 4 Close 后）**:
    - 若 FULL_LAUNCH_EXECUTION_PLAN 中为 E2E 测试定义了新的权威套件，可考虑：
      - 将该目录迁移到 `apps/api/tests/_archive` 并在文档中标记“仅作历史参考”，或
      - 拆分出仍有价值的场景，迁移到新测试框架，其余再评估删除。

---

### 3.3 Script / 工具类

#### DEP-020 — headless-worker 调试脚本

- **类型**: Script / Worker 调试工具
- **路径**: `tools/headless-worker.ts`
- **证据**:
  - `docs/ESLINT_OVERRIDE_AUDIT.md` 中多次引用该文件作为 lint debt 源。
  - `tools/trigger-stage4-draft.ts` 中有注释：
    - `// Wait, I can use the 'headless-worker' approach for Stage 4 too if I want to bypass API auth issues?`
- **当前状态**:
  - 用于本地/实验性地直接操作 Prisma 与结构树，绕过 API 层进行 Worker 级调试。
  - 不属于正式的 Worker 流程（`apps/workers/src/*`），但在 Stage4 草案 / Draft 工具中被提到。
- **最初用途（推断）**:
  - 在早期 Stage4 实验中，通过 headless Worker 方式直接对数据库进行结构操作，用于快速迭代与验证。
- **是否被 Stage 1–4 使用**:
  - **间接**：作为 Stage4 Draft 的调试工具被引用，但不是 Gate / Smoke / Launch 必要路径。
- **删除风险等级**: **P1**（删除会削弱 Stage4 调试手段；但不会直接破坏核心生产路径）。
- **建议动作**:
  - **短期**: 保留，并在后续代码治理中考虑显式标注为“仅供本地调试用、禁止在 CI / 生产调用”。
  - **中长期（Stage 4 Close 后）**:
    - 若 Stage4 正式 Worker 流程已经完全稳定，可考虑：
      - 将该脚本迁移到 `tools/dev/` 或 `tools/_archive/` 目录；
      - 或用新的官方调试工具替代，之后再评估删除。

---

#### DEP-021 — mock-worker 调试脚本

- **类型**: Script / Worker 调试工具
- **路径**: `tools/mock-worker.ts`
- **证据**:
  - `tools/clean-structure.ts` 中注释提到：
    - `// Also reset Job status to PENDING so mock-worker picks it up?`
- **当前状态**:
  - 为早期“模拟 Worker”场景提供辅助逻辑，目前主要以注释形式被提及。
- **最初用途（推断）**:
  - 在没有真实 Worker 的环境下，以脚本方式模拟 Job 领取与执行。
- **是否被 Stage 1–4 使用**:
  - **不确定**：未在官方 Gate / Smoke / Execution Plan 中直接引用。
- **删除风险等级**: **P2**（主要风险是丢失一类调试入口，对生产流程影响较低）。
- **建议动作**:
  - **短期**: 保留，作为调试脚本的一部分；可在未来将其文档化（说明使用场景与限制）。
  - **中长期（Stage 4 Close 后）**: 视 Worker 调试工具的统一规划，再决定是否归档或删除。

---

#### DEP-022 — HMAC Replay Demo 脚本

- **类型**: Script / Demo
- **路径**: `tools/dev/hmac-replay-demo.ts`
- **证据**:
  - 位于 `tools/dev/`，文件名明确为“replay demo”，不在 Gate / Smoke / CI 流程中使用。
- **当前状态**:
  - 用于演示/验证 HMAC 重放攻击场景，与 `tools/security/hmac-*.js` 相互补充。
- **最初用途（推断）**:
  - 作为安全团队的 PoC 工具，用于向内展示 HMAC Replay 风险与防护效果。
- **是否被 Stage 1–4 使用**:
  - **间接**：为 Stage1 安全规范提供演示支撑，但不属于核心验证脚本。
- **删除风险等级**: **P2**（删除会减少一个安全演示工具，对正式验证链路影响有限）。
- **建议动作**:
  - **保留**，作为安全工程的 Demo 工具。
  - 若未来有更系统化的安全演示与测试脚本，可以考虑将其迁移到 `security-demo/` 归档区。

---

### 3.4 Doc / 历史 Stage & 旧规范

> 本小节主要涵盖 **在 Stage 1–4 新标准（`LAUNCH_STANDARD_V1.1.md`）形成前** 的历史 Stage 文档。  
> 这些文档大多仍具有“历史证据 / 设计演进记录”的价值，**不建议当前删除**。

#### DEP-030 — Stage1 早期差异与规划文档

- **类型**: Doc
- **路径（示例）**:
  - `docs/stage1_gap_report.md`
  - `docs/STAGE1_DB_SCHEMA_DELTA_PLAN.md`
  - `docs/STAGE1_DB_MIGRATION_SOP.md`
  - `docs/STAGE1_EXECUTION_REPORT.md`
- **当前状态**:
  - 已被 `docs/LAUNCH_STANDARD_V1.1.md` 与 `docs/FULL_LAUNCH_GAP_REPORT.md` 中的新 Stage1 规范与差距报告所补充/覆盖。
  - 仍作为“Stage1 历史执行与审计记录”存在。
- **最初用途（推断）**:
  - 记录 Stage1 早期 DB 差异、迁移 SOP、执行过程与审计结果。
- **是否被 Stage 1–4 使用**:
  - **是（历史参考）**：在多个审计/报告中被引用，用于说明 Stage1 演进过程。
- **删除风险等级**: **P2**（删除会丢失历史背景与迁移依据）。
- **建议动作**:
  - **保留**，视为 Stage1 的“历史档案”。
  - 若未来需要精简文档，可在 Stage4 完全 Close 后，将其移动到 `docs/archive/`，而非直接删除。

---

#### DEP-031 — Stage2 早期规划与执行文档

- **类型**: Doc
- **路径（示例）**:
  - `docs/STAGE2_PLAN.md`
  - `docs/STAGE2_PLAN_V2.md`
  - `docs/STAGE2_ENGINE_HUB_PLAN.md`
  - `docs/STAGE2_A_IMPLEMENTATION_SUMMARY.md`
  - `docs/STAGE2_A_RUNTIME_VERIFY.md`
  - `docs/STAGE2_B_RUNTIME_VERIFY.md`
  - `docs/STAGE2_B_RUNTIME_EVIDENCE.md`
- **当前状态**:
  - 新的统一标准与执行计划已经由 `LAUNCH_STANDARD_V1.1` / `FULL_LAUNCH_EXECUTION_PLAN` 承接。
  - Stage2 文档更多作为 Engine Hub / Runtime Verify 的历史设计与执行证据存在。
- **最初用途（推断）**:
  - 规划并落实 Engine Hub、Runtime Verify、Stage2 引擎集成等。
- **是否被 Stage 1–4 使用**:
  - **是（参考资料）**，仍对理解 Engine Hub 架构与 Stage2 落地过程有价值。
- **删除风险等级**: **P2**。
- **建议动作**:
  - **保留**，作为 Stage2 的设计与执行记录。
  - 后续若需要，可在 Stage4 Close 后统一归档至 `docs/stage-history/`，但不建议直接删除。

---

#### DEP-032 — Stage3 早期规划文档

- **类型**: Doc
- **路径（示例）**:
  - `docs/STAGE3_OVERVIEW.md`
  - `docs/STAGE3_OVERVIEW_PLAN.md`
  - `docs/STAGE3_PLAN.md`
- **当前状态**:
  - 结构分析引擎（CE06）与 Scene Graph 能力现在主要由：
    - `docs/NOVEL_ANALYSIS_VERIFICATION_REPORT*.md`
    - `docs/LAUNCH_STANDARD_V1.1.md` 中 Stage3 部分
    - `docs/FULL_LAUNCH_EXECUTION_PLAN.md` 中 S3 任务包  
      进行规范与跟踪。
  - 这些 Stage3 文档更多是早期规划与讨论稿。
- **最初用途（推断）**:
  - 规划 CE06 / 结构分析引擎架构与前后端集成方案。
- **是否被 Stage 1–4 使用**:
  - **间接**，作为 Stage3 背景资料；不再是唯一权威规范。
- **删除风险等级**: **P2**。
- **建议动作**:
  - **保留**，用于追溯 CE06 设计演进。
  - 后续可考虑将关键结论迁移到统一规范后，把原文档移动到历史归档区。

---

#### DEP-033 — Stage4 早期规划与 MVP Close 文档

- **类型**: Doc
- **路径（示例）**:
  - `docs/STAGE4_OVERVIEW_PLAN.md`
  - `docs/STAGE4_PLAN.md`
  - `docs/STAGE4_FREEZE_DECLARATION.md`
  - `docs/STAGE4_CLOSE_MVP_CHECKLIST.md`
  - `docs/STAGE4_CLOSE_MVP_FINAL_CLOSE_REPORT.md`
  - `docs/STAGE4_CLOSE_MVP_FIX_REPORT.md`
  - `docs/STAGE4_CLOSE_MVP_DOC_ALIGNMENT_REPORT.md`
- **当前状态**:
  - 面向 “MVP Close” 阶段的 Stage4 文档，时间早于当前的 **全量上线 Standard V1.1**。
  - 现有 Stage4 规划更多由 `LAUNCH_STANDARD_V1.1` / `FULL_LAUNCH_EXECUTION_PLAN` 承接。
- **最初用途（推断）**:
  - 为 MVP 阶段的质量、安全、治理能力设定 DoD 并完成 Close。
- **是否被 Stage 1–4 使用**:
  - **是（历史 Close 证据）**，用于证明早期 MVP 阶段已达成的质量/安全门槛。
- **删除风险等级**: **P2**。
- **建议动作**:
  - **保留**，特别是 FINAL_CLOSE_REPORT 与 CHECKLIST，作为历史 Close 证据。
  - 不建议删除，仅可在未来将其移动到“历史 Close 档案”目录。

---

#### DEP-034 — Stage9 / Stage10 / Stage12 / Stage13 相关文档

- **类型**: Doc
- **路径（示例）**:
  - Stage9 UI：
    - `docs/STAGE9_UI_STUDIO_SELF_TEST.md`
    - `docs/STAGE9_UI_PROJECTS_SELF_TEST.md`
    - `docs/STAGE9_UI_JOBS_TASKS_SELF_TEST.md`
    - `docs/STAGE9_UI_STUDIO_EXECUTION_REPORT.md` 等
  - Stage10 UI Freeze：`docs/STAGE10_UI_FREEZE_DECLARATION.md`
  - Stage12 Research：`docs/STAGE12_RESEARCH_REPORT.md`
  - Stage13 Core Layer：
    - `docs/STAGE13_CE_CORE_LAYER_PLAN.md`
    - `docs/STAGE13_VERIFY_REPORT.md`
- **当前状态**:
  - 面向 **更高 Stage（9–13）** 的 UI 优化、Freeze、核心引擎层设计与验证文档。
  - 当前 “全量上线” 标准主要聚焦 Stage 1–4，但这些文档记录了更深一层的演进路线。
- **最初用途（推断）**:
  - 作为 Stage9–13 阶段的规划与执行记录，为未来扩展能力提供路线图。
- **是否被 Stage 1–4 使用**:
  - **否（直接） / 是（间接参考）**：对当前上线标准并非硬性依赖，但对长期演进有重要参考价值。
- **删除风险等级**: **P2**。
- **建议动作**:
  - **保留**，作为未来 Stage5+ / Stage9+ 的路线与证据。
  - 不建议在“全量上线 Stage1–4”阶段删除或移动。

---

## 四、清理建议与 Stage 协调

> 本节只给出 **高层次建议**，不包含任何立即删除动作。

### 4.1 Stage 1–2 期间

- 不执行任何删除，仅进行：
  - 补充文档标注（例如在相关规范中说明哪些为 `_legacy` / Demo / 历史档案）。
  - 在新标准文档中引用本报告，提醒后续执行阶段关注这些候选项。

### 4.2 Stage 3 Close 之后

- 可考虑的动作（需 PLAN + EXECUTE 明确确认）：
  - 为 `_legacy` Studio 组件增加更显式的 `@deprecated` 注释，并在新 UI 方案完全替代后，规划迁移/归档。
  - 对 `apps/api_tests_backup` 中仍有价值的场景进行迁移（例如移入统一的 smoke/e2e 体系），其余标记为历史档案。

### 4.3 Stage 4 Close 之后

- 在确保 **所有 Gap 已修复、所有新能力已稳定** 的前提下，按以下顺序评估清理：
  1. **最外围 Demo/调试脚本**（如 `hmac-replay-demo.ts` 等），前提是已有更完备的验证脚本与文档。
  2. **旧 Stage 规划文档**：在保证关键信息已融入新标准后，将其归档到专门的历史目录，而不是物理删除。
  3. **向下兼容 Schema / 关系**：仅在完成数据迁移 + 完整回归后，才允许删除 `@deprecated` 关系（如 `ProjectEpisodes`）。

---

## 五、结论

- 本次审计 **未发现** 可以在当前阶段直接“安全删除”的核心代码或文档。
- 识别出若干 **候选废弃项**，主要集中在：
  - 旧 Schema 关系（`@deprecated` 但仍在兼容路径中）
  - 早期 E2E Backup 测试集
  - Demo / 调试脚本
  - Stage2–Stage13 的历史规划与执行文档
- 建议在 **Stage 3 / Stage 4 Close 之后**，结合 FULL_LAUNCH_GAP_REPORT 与 FULL_LAUNCH_EXECUTION_PLAN，发起一次 **“Deprecation Cleanup Plan”**（新的 PLAN + EXECUTE 阶段），届时再根据本报告逐项处理。

> 当前模式为 MODE: RESEARCH，本报告仅用于支持后续决策，不触发任何实际清理动作。
