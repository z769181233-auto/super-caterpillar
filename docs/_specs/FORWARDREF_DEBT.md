# ForwardRef Technical Debt Registry

本文档记录项目中由于架构历史原因引入的 `forwardRef` 循环依赖清单，并定义 Stage 4 的清理路径。

## 现存债务清单 (Stage 3 封板状态)

下列模块之间存在 `forwardRef`：

1. **OrchestratorModule ⇄ WorkerModule**
   - 原因：Orchestrator 需要分发 Job 给 Worker，Worker 完成后需要通知 Orchestrator 更新流水线状态。
   - 实现：`@Inject(forwardRef(() => WorkerService))`

2. **OrchestratorModule ⇄ JobModule**
   - 原因：Orchestrator 依赖 JobService 创建 Job，JobService 内部某些逻辑需要引用 Orchestrator 的状态判定。
   - 实现：`@Inject(forwardRef(() => JobService))`

3. **OrchestratorModule ⇄ ProjectModule**
   - 原因：Orchestrator 自动创建/关联项目，项目服务某些回调涉及流水线。

## 治理原则

> [!IMPORTANT]
> **禁止新增 forwardRef**：除非经过架构委员会评审，否则严禁在任何新模块中引入 `forwardRef`。

## 清理路径 (Stage 4)

1. **引入 NestJS EventEmitter**：
   - 采用事件驱动架构。Orchestrator 只需发布 `PIPELINE_EVENT`（如 `STAGE_COMPLETED`）。
   - Worker 只需发布 `JOB_EVENT`（如 `JOB_SUCCEEDED`）。
2. **状态机解耦**：
   - 将流水线状态判定逻辑下沉到独立的 `PipelineService`，不依赖具体的业务分发模块。
3. **彻底去除直接引用**：
   - 目标：Stage 4 结束时，`WorkerModule` 与 `JobModule` 不得感知 `OrchestratorModule` 的存在。

---

**登记人**: Antigravity
**日期**: 2026-01-14
