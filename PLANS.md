## Task
Novel Import / Novel Analysis 稳定化修复

## Goal
先收口小说导入与分析主链路上的高优先级问题，确保“上传小说 -> 创建分析任务 -> worker 执行 -> 结构落库”稳定可运行，再决定是否恢复该模块的新功能开发。

## Why
当前仓库在小说导入与分析模块上存在已知、可复现的主链路 bug。继续叠加功能会放大不稳定基线，因此先按生产级要求完成稳定化修复。

## Scope
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/novel-analysis-processor.spec.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/workers/src/worker-app.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/worker/worker.service.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/scripts/create-test-novel-job.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/novel-import/novel-import.controller.ts`
- `/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/apps/api/src/novel-import/novel-import.service.ts`

## Non-goals
- 不推进 Director Layer / Timeline / Publish 新能力
- 不做无关重构
- 不修改小说导入以外的前端体验优化
- 不处理与当前主链路无关的低优先级历史问题

## Constraints
- 不改无关模块
- 不做无关重构
- 不破坏现有主流程
- 所有结果必须可验证
- 当前 milestone 未完成前不得进入下一 milestone

## Risks at start
- worker 多实例或旧进程残留会污染活体验证结果
- novel analysis 结构落库存在幂等与唯一约束风险
- 当前仓库已有大量未归因改动，必须严格控制本次 diff 边界

---

## Milestone M1 - Triage / Analysis
### Goal
- 做轻量分诊，确认问题边界和优先级

### Scope
- `apps/workers/src/novel-analysis-processor.ts`
- `apps/workers/src/worker-app.ts`
- `apps/api/src/worker/worker.service.ts`
- `apps/api/src/scripts/create-test-novel-job.ts`

### Deliverables
- 问题分类
- P0/P1/P2 列表
- 修复顺序建议
- 最小可行执行路径

### Acceptance criteria
- 已明确当前问题属于哪些模块
- 已明确哪些问题必须先修
- 已明确本轮不处理哪些问题

### Validation
- 阅读关键文件
- 复现已知问题
- 确认入口、调用链、影响范围

### Status
- done

### Notes
- 已重新完成轻量分诊并确认当前稳定化边界。
- 当前 P0/P1/P2 列表：
  - P0：`NOVEL_ANALYSIS` 执行器仍存在运行时兼容与落库脆弱点，一旦回归会直接阻断“上传小说 -> 分析任务 -> 结构落库”主链。
  - P1：重复导入/重复分析的幂等语义仍偏保守，当前是显式冲突而非替换导入；若调用端处理不当，用户会感知为“功能异常”。
  - P1：验证入口偏脚本化，真实 UI 到结构页的端到端 smoke 还不是固定基线，回归发现成本偏高。
  - P2：`AGENTS.md` 文件当前并不存在于仓库，仅有会话内规则；流程约束依赖人工遵守，存在协作偏差风险。
- 当前建议修复顺序：
  1. 先收口 `NOVEL_ANALYSIS` 主链执行稳定性与相关回归保护。
  2. 再收口重复导入/重复分析语义与幂等边界。
  3. 最后补强验证入口与 smoke 基线。
- 本轮明确不处理：
  - Director Layer / Timeline / Publish 新功能
  - 无关前端体验优化
  - 与 novel import / analysis 主链无关的历史问题

---

## Milestone M2 - Fix P0/P1 bugs
### Goal
- 修复当前主链路上的高优先级问题

### Scope
- `apps/workers/src/novel-analysis-processor.ts`
- `apps/workers/src/novel-analysis-processor.spec.ts`
- `apps/workers/src/worker-app.ts`
- `apps/api/src/worker/worker.service.ts`
- `apps/api/src/scripts/create-test-novel-job.ts`

### Deliverables
- bug 修复
- 新增/更新测试
- 最小必要代码改动

### Acceptance criteria
- 已知 bug 不再复现
- 相关测试覆盖到 bug 场景
- 关键流程可运行

### Validation
- lint
- typecheck
- unit test
- integration test
- build
- smoke test

### Status
- done

### Notes
- 已完成本轮 P0 修复：
  - 将 `NOVEL_ANALYSIS` 结构落库恢复为真实事务执行，避免失败时出现半写入状态。
  - 已补充事务入口回归测试，覆盖 `PrismaClient` 与 `TransactionClient` 两种执行路径。
  - 已完成 worker 活体验证，测试任务可从 `PENDING` 运行到 `SUCCEEDED`。

---

## Milestone M3 - Regression guard
### Goal
- 做关键回归防护，防止修复后引入新问题

### Scope
- `apps/api/src/novel-import/novel-import.controller.ts`
- `apps/api/src/novel-import/novel-import.controller.spec.ts`
- `apps/api/src/scripts/create-test-novel-job.ts`

### Deliverables
- 重复导入冲突语义收口
- 重复分析冲突语义收口
- controller 级回归测试补强
- 主流程验证
- 风险复查

### Acceptance criteria
- 关键流程 smoke test 通过
- 同项目重复导入返回明确冲突语义，不再被包成泛化 400
- 分析进行中时重复 analyze 返回明确冲突语义，不再重复创建 active analysis job
- 没有发现新的主链路回归
- 残余风险已记录

### Validation
- lint: `pnpm --filter api lint`
- typecheck: `pnpm --filter api typecheck`
- unit tests: `pnpm --filter api test -- --runInBand src/novel-import/novel-import.controller.spec.ts`
- integration tests: `pnpm --filter api exec ts-node src/scripts/create-test-novel-job.ts`
- build: `pnpm --filter api build`
- smoke test: 导入/分析接口重复请求语义检查 + worker test job 创建

### Status
- todo

### Notes
- 待执行。M2 完成后再补关键回归防护，不提前进入。

---

## Milestone M4 - Resume development decision
### Goal
- 判断是否可以恢复新功能开发

### Scope
- 当前任务涉及的整个活动模块

### Deliverables
- 继续开发 / 暂不继续开发 的结论
- 原因说明
- 风险说明

### Acceptance criteria
- P0/P1 已收口
- 验证通过
- `STATUS.md` 已更新
- 当前剩余风险明确可见

### Validation
- 检查 STATUS.md
- 检查主流程
- 检查验证结果汇总

### Status
- todo

### Notes
- 待 M2/M3 完成并验证通过后再判断是否允许恢复新功能开发。
