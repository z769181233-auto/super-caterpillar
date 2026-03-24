# Director Layer Phase Roadmap

本文件固化 Director Layer 的实施顺序。默认顺序不可跳跃，除非出现明确生产阻塞。

## P0：现状审计与目标架构固化

### 目标

- 固化 Film IR v1 SSOT
- 固化 Director Layer 架构边界
- 冻结 feature flag / evidence / versioning 规则

### 非目标

- 不做大规模代码改造
- 不做 schema 大迁移

### 产物

- `FILM_IR_V1_SSOT.md`
- `DIRECTOR_LAYER_ARCHITECTURE.md`
- 本文档

### 验收

- 相关模块边界清晰
- 阶段顺序冻结
- feature flag 与 evidence 规则明确

## P1：Film IR schema 与数据持久化

### 目标

- 将 Film IR 作为正式持久化对象
- 明确 rerun / replan / approval / lock 语义
- 引入 append-only 运行证据

### 非目标

- 不追求 planner 质量最优

### 最小变更

- `film_ir`
- `film_ir_runs`
- `scenes.film_ir_id`
- 必要 evidence 记录

### Feature Flag

- `FILM_IR_ENABLED`
- `FILM_IR_PLANNER_ENABLED`

### 验收

- 单个 scene 能稳定生成并保存 Film IR
- rerun 不覆盖历史
- `APPROVED / LOCKED` 状态机可用

## P2：Script-to-Directing service

### 目标

- 将 scene 文本翻译成 Film IR
- 提供 dry-run / enqueue / evidence

### 非目标

- 不做多模型 ensemble

### 主要模块

- `apps/api/src/film-ir`
- `apps/workers/src/processors/film-ir-plan.processor.ts`

### 验收

- 至少 1 条样板链可稳定产出 Film IR

## P3：Shot Planner

### 目标

- 把 Film IR 转成 shot-level directing plan

### 非目标

- 不重写现有 CE11 执行器

### 主要模块

- `apps/api/src/shot-planner`
- `CE_SHOT_PLAN`

### 验收

- scene 能生成 shot plan
- 下游可消费

## P4：Consistency State Engine

### 目标

- 建立正式状态系统与 violation 模型

### 非目标

- 不做全自动修复

### 主要模块

- `continuity_states`
- `continuity_violations`
- `state snapshots`

### 验收

- 至少能生成 scene/shot 级 snapshot
- 能记录 violation

## P5：Judge / Content Gates

### 目标

- 引入导演层内容评分与门禁

### 非目标

- 不替换现有技术 gate

### 主要模块

- `content_gate_results`
- `quality`
- `tools/gate`

### 验收

- 评分可写库
- gate 可输出 pass/warn/block

## P6：训练数据接口 / 标注导出

### 目标

- 导出 Script -> Directing
- 导出 Directing -> Shot Plan
- 导出 Judge 样本

### 非目标

- 不开始训练超大模型

## P7：与 Timeline / Publish / Evidence 融合

### 目标

- 把 Director Layer 正式接入 publish 和 evidence

### 非目标

- 不重写 timeline/publish 主链

## P8：最小闭环试运行与 Gate 验收

### 目标

- 选定一条样板项目
- 跑通从 scene 到 publish 的 director-layer 闭环

### 非目标

- 不追求全题材泛化

## Feature Flag 总表

- `FILM_IR_ENABLED`
- `FILM_IR_PLANNER_ENABLED`
- `SHOT_PLAN_ENABLED`
- `CONSISTENCY_ENGINE_ENABLED`
- `CONTENT_JUDGE_ENABLED`
- `DIRECTOR_GATE_MODE=off|warn|block`

## 证据要求总表

每阶段至少产出：

- 输入摘要
- 输出摘要
- 版本号
- trace id
- actor / source
- created_at

## 回滚原则

- 每个阶段必须可单独关闭
- 关闭后恢复到现有 `scene / shot / timeline / publish / gate` 主链
- append-only 证据不删除，只停止消费
