# Director Layer Architecture

本文件定义当前仓库在不推翻现有稳定链路的前提下，如何引入 Director Layer。

## 1. 设计原则

- 先补协议层，再补智能层。
- 先接现有 `scene / shot / timeline / gate / publish / evidence`，不另起一套平行系统。
- 所有新增能力必须：
  - 可门禁
  - 可回滚
  - 可证据化
  - 可灰度
- 现有稳定链路只能扩展，不能重写：
  - `JobModule`
  - `Worker ack/report`
  - `CE DAG`
  - `Timeline / Publish`
  - `Launch Gates`

## 2. 目标调用链

```text
Novel / Script Ingestion
-> Scene Structuring
-> Film IR Planner
-> Shot Planner
-> Generator Router
-> Consistency State Engine
-> Timeline Composer
-> Judge / Content Gates
-> Publish / Evidence
```

## 3. 模块边界

### 3.1 Novel / Script Ingestion

复用：

- `apps/api/src/novel-import`
- `apps/api/src/project`

输出：

- `project / seasons / episodes / scenes`
- `scene.enriched_text`
- `graph_state_snapshot`

### 3.2 Film IR Planner

当前落点：

- `apps/api/src/film-ir`

职责：

- 将 `scene + context` 翻译成 `Film IR`
- 写 `film_ir`
- 写 evidence / audit

当前 job：

- `CE_FILM_IR_PLAN`

### 3.3 Shot Planner

建议落点：

- `apps/api/src/shot-planner`

职责：

- 把 `Film IR` 翻译成 shot-level directing plan
- 输出 `shot_plans`
- 作为 `CE11 / SHOT_RENDER` 上游

当前 job：

- `CE_SHOT_PLAN`

### 3.4 Generator Router

复用：

- `apps/api/src/job`
- `apps/api/src/engine`
- `apps/api/src/ce-pipeline`
- `apps/workers/src/processors`

职责：

- 按 shot plan / engine matrix / feature flag 路由生成任务

### 3.5 Consistency State Engine

建议落点：

- `apps/api/src/continuity-state`

当前最接近的现有能力：

- `continuity_states`
- `continuity_violations`
- `CE_CONSISTENCY_CHECK`
- continuity audit processor

职责：

- 维护 scene/shot 跨时间的一致性状态
- 生成 snapshot
- 检测 violation
- 提供 lock / override 机制

### 3.6 Judge / Content Gates

复用：

- `apps/api/src/quality`
- `tools/gate`

职责：

- 内容层评分
- 导演策略对齐评分
- 质量门禁结果写库
- 与现有 gate 共存

当前 job：

- `CE_CONTENT_JUDGE`

### 3.7 Timeline / Publish / Evidence

复用：

- `apps/api/src/timeline`
- `apps/api/src/publish`
- `tools/gate`

职责：

- 消费经 gate 放行的 shot/timeline 结果
- 生成 publish receipt
- 固化 director-layer evidence

## 4. 同步 / 异步原则

- API 创建导演层任务：同步入队
- Planner / shot planner / consistency / judge：异步执行
- Publish 前 gate：允许同步聚合查询，但评分计算本身仍以异步结果为主

## 5. 失败与降级

### 可降级

- `Film IR Planner` 失败
  - 可退回旧 CE11 直接规划
- `Shot Planner` 失败
  - 可退回旧 shot planning
- `Consistency` 失败
  - 先 warning，不直接阻断低等级项目
- `Judge` 失败
  - 先 advisory，不直接阻断非生产 gate

### 不应静默降级

- Publish 前 required gate
- `LOCKED` Film IR 被覆盖
- evidence 丢失
- state override 无审计

## 6. Feature Flag 策略

最少需要以下开关：

- `FILM_IR_ENABLED`
- `FILM_IR_PLANNER_ENABLED`
- `SHOT_PLAN_ENABLED`
- `CONSISTENCY_ENGINE_ENABLED`
- `CONTENT_JUDGE_ENABLED`
- `DIRECTOR_GATE_MODE=off|warn|block`

原则：

- 开关必须按模块拆开
- 不能一个总开关把所有 director-layer 逻辑绑死

## 7. Evidence 挂接规则

每个 director-layer 阶段都必须生成 evidence：

- `Film IR Planner`
- `Shot Planner`
- `Consistency State`
- `Judge`
- `Publish`

每次 evidence 至少包含：

- `trace_id`
- `planner_version / score_version`
- 输入摘要
- 输出摘要
- actor / system source
- created_at

## 8. 当前仓库里的“不要重写”

以下模块只能扩展：

- `apps/api/src/job`
- `apps/api/src/orchestrator`
- `apps/api/src/ce-pipeline`
- `apps/api/src/timeline`
- `apps/api/src/publish`
- `apps/workers/src/worker-app.ts`
- `tools/gate/run_launch_gates.sh`

## 9. 当前仓库里的“优先扩展点”

- `apps/api/src/film-ir`
- `apps/api/src/quality`
- `apps/api/src/project`
- `apps/workers/src/processors/film-ir-plan.processor.ts`
- `apps/workers/src/processors/content-judge.processor.ts`
- `apps/workers/src/processors/script-structure.processor.ts`

## 10. 当前阶段非目标

- 不从零训练超大基础模型
- 不做长片级端到端生成
- 不把现有 CE 链全部换掉
- 不用 Director Layer 直接覆盖已有 render/publish 主链
