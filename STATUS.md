## Current task
Novel Import / Novel Analysis 稳定化修复

## Current phase
Stabilization / Bug Fix

## Overall summary
已完成 `M2` 的 P0 修复，`NOVEL_ANALYSIS` 主链重新具备事务落库与活体 smoke 通过的稳定基线，当前可进入 `M3`。

---

## Completed
- 已完成本轮 `M1 - Triage / Analysis`
- 已重新确认 novel import / analysis 主链请求流、数据流、状态流与修改边界
- 已完成当前问题分级与修复顺序建议
- 已在仓库根目录落库 `AGENTS.md`，将长期工程规则文件化
- 已完成 `M2 - Fix P0/P1 bugs` 中的 P0 修复：`NOVEL_ANALYSIS` 结构落库重新回到真实事务保护
- 已补 `NOVEL_ANALYSIS` 事务入口回归测试，并完成 worker 活体 smoke

## In progress
- `M3 - Regression guard` 待启动

## Not started
- `M4 - Resume development decision`

---

## Current risks
- `P1` 重复导入/重复分析目前是保守冲突语义：若调用端或产品预期为“可重导入”，用户仍会感知为功能受限
- `P1` 验证入口仍偏脚本化：真实 UI 到结构页的端到端 smoke 不是固定基线，回归发现成本较高
- `P2` 当前活体 smoke 仍依赖本地 worker 进程：环境状态会影响回归效率

## Known issues
- 同一项目重复导入当前为 `Conflict` 语义，不支持替换导入
- 真实 UI 主流程 smoke 仍未形成固定验证基线

## Deferred items
- Director Layer / Timeline / Publish 新能力扩展
- 与 novel import / analysis 主链无关的历史低优先级问题
- 非当前主链必需的前端体验优化

---

## Validation status
- lint: pass
- typecheck: pass
- unit tests: pass
- integration tests: pass
- build: pass
- smoke test: pass

## Last completed milestone
M2 - Fix P0/P1 bugs

## Current active milestone
M3 - Regression guard

## Next milestone
M3 - Regression guard

---

## Resume feature development?
- no

## Reason
- 虽然 P0 已收口并通过验证，但 P1 回归防护与恢复开发判断尚未完成，当前仍不应恢复新功能开发。

## Decision log
- 决策 1：本轮重新从稳定化分诊开始，先确认当前真实 bug 列表，再决定修复顺序
- 决策 2：先按 P0 -> P1 -> P2 推进，不在不稳定基线上继续叠加新功能
- 决策 3：当前只更新计划与状态文档，不提前进入代码修复
- 决策 4：先将长期工作规则正式落库到 `AGENTS.md`，降低后续协作偏差风险
- 决策 5：本轮 M2 先只修 P0，不扩散到重复导入语义和前端/UI 验证链
