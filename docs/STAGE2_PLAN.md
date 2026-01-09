# Stage2 执行计划

## 一、Stage2 总体目标

**理解与范围边界：**

Stage2 是在 Stage1 基础能力（安全链路、RBAC、审计、五层级 CRUD、SceneGraph）之上的**调度与执行系统强化**阶段。核心目标是将 Orchestrator/WorkerPool 从“能跑”升级到“可观测 + 可扩展 + 稳定”的生产级版本，并建立初版 EngineAdapter 体系，打通 NOVEL_ANALYSIS 全链路，为后续 Creative Engine（CE）引擎接入做准备。

**Stage2 关注点：**

1. **Orchestrator / WorkerPool 强化**：从简单随机分配升级为支持优先级、负载均衡、故障恢复、可观测性的调度系统
2. **EngineAdapter V1**：建立引擎注册、调用、元数据管理的基础框架，支持 HTTP 引擎和后续 CE 引擎接入
3. **NOVEL_ANALYSIS 全链路**：确保从导入小说 → 分析 → 结构生成 → 后续 CE 引擎任务准备的完整链路打通
4. **任务中心 & 监控面板**：在现有 Jobs 页面基础上，增加 Worker 状态、调度统计、任务依赖关系等监控视图
5. **质量评估 & 自动优化 MVP**：实现最小可用的质量评分计算和基础优化建议，不做完整大系统

**Stage2 不做的事：**

- ❌ 不做完整商业化计费系统（只保留 BillingEvent 数据模型，不做计费策略引擎）
- ❌ 不做复杂多租户计费策略（只做基础组织隔离，不做细粒度配额管理）
- ❌ 不做复杂推荐算法（质量评估只做基础评分，不做个性化推荐）
- ❌ 不做完整模型训练/微调系统（只做模型注册和调用，不做训练流程）
- ❌ 不做复杂工作流编排（只做 Task → Job 的简单映射，不做复杂 DAG）

**文档引用：**

- 参考《毛毛虫宇宙*WorkerPool_Orchestrator*调度系统设计书\_V1.0》中的调度策略、负载均衡、故障恢复章节
- 参考《毛毛虫宇宙\_引擎体系说明书\_EngineSpec_V1.1》中的 EngineAdapter 接口定义和 CE 引擎接入规范
- 参考《毛毛虫宇宙\_平台任务系统与异步执行机制说明书\_TaskSystemAsyncExecutionSpec_V1.0》中的 Task/Job 关系、重试策略、优先级机制
- 参考《毛毛虫宇宙\_质量评估与自动优化体系说明书\_QualityOptimizationSpec_V1.1》中的 MVP 质量评分算法

---

## 二、按模块拆解 Stage2：模块 → 批次

### S2-A：Orchestrator / WorkerPool 强化

**模块目标：**
将当前 Orchestrator 的简单随机分配策略升级为支持优先级、负载均衡、故障恢复、可观测性的生产级调度系统。解决 Worker 心跳超时处理、Job 重试策略、调度统计等问题。对应《WorkerPool*Orchestrator*调度系统设计书\_V1.0》中的“调度策略优化”和“故障恢复机制”章节。

**批次：**

- **S2-A.1**：调度策略优化（优先级、负载均衡、Worker 选择算法）
- **S2-A.2**：故障恢复与重试机制（超时检测、自动重分配、死锁检测）
- **S2-A.3**：可观测性增强（调度指标、性能监控、调度日志）

---

### S2-B：EngineAdapter V1（引擎注册与调用）

**模块目标：**
建立完整的 EngineAdapter 体系，支持引擎注册、元数据管理、HTTP 调用、错误处理。为后续 CE 引擎接入提供统一接口。对应《引擎体系说明书\_EngineSpec_V1.1》中的“EngineAdapter 接口定义”和“HTTP 引擎适配器”章节。

**批次：**

- **S2-B.1**：EngineAdapter 接口完善与注册机制
- **S2-B.2**：HTTP 引擎适配器实现（调用真实 HTTP 引擎、错误处理、超时控制）
- **S2-B.3**：引擎元数据管理与版本控制

---

### S2-C：NOVEL_ANALYSIS 全链路（和后续 CE 引擎对接的准备）

**模块目标：**
确保 NOVEL_ANALYSIS 从导入 → 分析 → 结构生成 → 后续 CE 引擎任务准备的完整链路打通，并建立 Task → EngineTask 的映射机制，为后续 CE 引擎接入做准备。对应《平台任务系统与异步执行机制说明书\_TaskSystemAsyncExecutionSpec_V1.0》中的“Task/Job 关系”和“引擎任务准备”章节。

**批次：**

- **S2-C.1**：NOVEL_ANALYSIS 链路验证与优化（确保全链路稳定运行）
- **S2-C.2**：Task → EngineTask 映射机制（为 CE 引擎任务准备数据）

---

### S2-D：任务中心 & 监控面板（Studio / Jobs + 监控）

**模块目标：**
在现有 Jobs 页面基础上，增加 Worker 状态监控、调度统计、任务依赖关系可视化、实时指标展示等功能。对应《平台任务系统与异步执行机制说明书\_TaskSystemAsyncExecutionSpec_V1.0》中的“任务监控”章节。

**批次：**

- **S2-D.1**：Worker 状态监控面板（Worker 列表、心跳状态、负载情况）
- **S2-D.2**：调度统计与任务依赖可视化（调度效率、任务关系图）

---

### S2-E：质量评估 & 自动优化的最小可行版本

**模块目标：**
实现最小可用的质量评分计算（基于现有 QualityScore 模型）和基础优化建议，不做完整大系统。对应《质量评估与自动优化体系说明书\_QualityOptimizationSpec_V1.1》中的“MVP 质量评分算法”章节。

**批次：**

- **S2-E.1**：质量评分计算服务（基于现有模型计算基础评分）
- **S2-E.2**：质量反馈闭环（评分结果写入、基础优化建议）

---

## 三、对每个批次给出「可执行级 PLAN」

### S2-A.1：调度策略优化（优先级、负载均衡、Worker 选择算法）

**文件清单：**

- **新增：**
  - `apps/api/src/orchestrator/scheduling-strategy.service.ts` - 调度策略服务（优先级、负载均衡）
  - `apps/api/src/orchestrator/worker-selector.service.ts` - Worker 选择算法服务
  - `apps/api/src/orchestrator/dto/scheduling-params.dto.ts` - 调度参数 DTO
- **修改：**
  - `apps/api/src/orchestrator/orchestrator.service.ts` - 集成调度策略和 Worker 选择
  - `apps/api/src/job/job.service.ts` - 添加优先级字段支持（如果 schema 已有则使用，否则只做应用层优先级）
  - `apps/api/src/worker/worker.service.ts` - 添加负载计算相关方法
  - `packages/shared-types/src/scheduling.ts` - 调度相关类型定义（新增）

**核心目标与不动边界：**

- **目标：** 将 Orchestrator 的随机分配策略升级为支持优先级排序、Worker 负载均衡、能力匹配的智能调度。优先级基于 Job 的 `priority` 字段和创建时间；负载均衡基于 Worker 的 `tasksRunning` 和 `capabilities`；Worker 选择考虑 GPU 资源、当前负载、历史成功率。
- **不动边界：**
  - 不改动现有 Job 状态机（PENDING → RUNNING → SUCCEEDED/FAILED）
  - 不改动 Worker 注册/心跳协议
  - 不改动 JobService 的 `reportJobResult` 接口
  - 不改动数据库 schema（只使用现有字段，不新增表或字段）

**关键设计点 / 风险点：**

1. **优先级策略：** 参考《TaskSystemAsyncExecutionSpec》中的优先级机制，使用 `priority` 字段（数值越大优先级越高）+ `createdAt`（FIFO）作为二级排序
2. **负载均衡：** 避免 Worker 过载，使用 `tasksRunning / maxBatchSize` 计算负载率，优先选择负载率低的 Worker
3. **能力匹配：** 确保 Worker 的 `capabilities.supportedJobTypes` 包含 Job 的 `type`
4. **并发安全：** 使用 Prisma 事务确保 Job 分配和状态更新的原子性，避免重复分配
5. **性能考虑：** 批量查询 Worker 和 Job，避免 N+1 查询问题

**自检方式：**

- 创建多个不同优先级的 Job，验证高优先级 Job 先被分配
- 创建多个 Worker，验证负载均衡（各 Worker 的 `tasksRunning` 分布均匀）
- 验证不支持特定 JobType 的 Worker 不会被选中
- 查看调度日志，确认调度决策过程可追溯

---

### S2-A.2：故障恢复与重试机制（超时检测、自动重分配、死锁检测）

**文件清单：**

- **新增：**
  - `apps/api/src/orchestrator/fault-recovery.service.ts` - 故障恢复服务
  - `apps/api/src/orchestrator/job-timeout.service.ts` - Job 超时检测服务
- **修改：**
  - `apps/api/src/orchestrator/orchestrator.service.ts` - 集成故障恢复逻辑
  - `apps/api/src/job/job.service.ts` - 添加超时检测和自动重分配方法
  - `apps/api/src/worker/worker.service.ts` - 增强 Worker 健康检查
  - `apps/api/src/main.ts` - 添加定时任务（超时检测、故障恢复）

**核心目标与不动边界：**

- **目标：** 实现 Job 超时检测（RUNNING 状态超过阈值自动标记为 FAILED）、Worker 故障时的自动重分配（将分配给离线 Worker 的 PENDING Job 重新分配）、死锁检测（长时间 PENDING 的 Job 自动重试）。
- **不动边界：**
  - 不改动现有 Job 状态枚举（不新增状态）
  - 不改动 Worker 心跳协议
  - 不改动 JobService 的核心 CRUD 方法签名

**关键设计点 / 风险点：**

1. **超时阈值：** 参考《WorkerPool*Orchestrator*调度系统设计书》中的超时配置，使用环境变量 `JOB_TIMEOUT_MS`（默认 30 分钟）
2. **重分配策略：** 只重分配 `status=PENDING && workerId!=null && worker.status=offline` 的 Job，避免重复分配正在执行的 Job
3. **死锁检测：** 检测 `status=PENDING && createdAt < now() - 1小时` 的 Job，自动增加 `retryCount` 并重新分配
4. **审计记录：** 所有自动恢复操作（超时、重分配、死锁解除）都要记录审计日志
5. **避免循环重试：** 检查 `retryCount >= maxRetry`，超过最大重试次数不再自动重分配

**自检方式：**

- 模拟 Worker 离线，验证分配给它的 Job 是否自动重分配
- 模拟 Job 超时（手动设置 `startedAt` 为过去时间），验证是否自动标记为 FAILED
- 创建长时间 PENDING 的 Job，验证死锁检测是否生效
- 查看审计日志，确认所有恢复操作都有记录

---

### S2-A.3：可观测性增强（调度指标、性能监控、调度日志）

**文件清单：**

- **新增：**
  - `apps/api/src/orchestrator/metrics.service.ts` - 调度指标服务
  - `apps/api/src/orchestrator/dto/metrics.dto.ts` - 指标 DTO
- **修改：**
  - `apps/api/src/orchestrator/orchestrator.controller.ts` - 添加指标查询接口
  - `apps/api/src/orchestrator/orchestrator.service.ts` - 集成指标收集
  - `apps/api/src/observability/observability.service.ts` - 添加调度相关指标
  - `apps/web/src/app/studio/jobs/page.tsx` - 添加调度统计展示（可选）

**核心目标与不动边界：**

- **目标：** 实现调度系统的可观测性，包括调度效率（平均等待时间、调度成功率）、Worker 利用率（平均负载、空闲时间）、Job 执行统计（成功率、平均耗时、失败原因分布）等指标。
- **不动边界：**
  - 不改动现有 Orchestrator 调度逻辑（只添加指标收集，不改变调度行为）
  - 不改动现有 Observability 模块的核心接口

**关键设计点 / 风险点：**

1. **指标计算：** 基于现有 Job/Worker 数据计算，不新增数据库表，使用聚合查询
2. **性能影响：** 指标计算异步进行，不阻塞调度流程
3. **数据时效性：** 指标数据可以缓存（Redis），TTL 设置为 1 分钟
4. **日志结构化：** 调度决策日志使用结构化格式（JSON），便于后续分析

**自检方式：**

- 调用 `GET /api/orchestrator/metrics` 接口，验证指标数据正确性
- 查看调度日志，确认决策过程可追溯
- 验证指标计算不影响调度性能（调度延迟 < 100ms）

---

### S2-B.1：EngineAdapter 接口完善与注册机制

**文件清单：**

- **新增：**
  - `apps/api/src/engine/engine-adapter.interface.ts` - 完善接口定义（已有，需扩展）
  - `apps/api/src/engine/engine-metadata.service.ts` - 引擎元数据管理服务
  - `apps/api/src/engine/dto/engine-metadata.dto.ts` - 引擎元数据 DTO
- **修改：**
  - `apps/api/src/engine/engine-registry.service.ts` - 增强注册机制（支持元数据、版本管理）
  - `apps/api/src/engine/engine.module.ts` - 注册新服务
  - `packages/shared-types/src/engine.ts` - 引擎相关类型定义（新增）

**核心目标与不动边界：**

- **目标：** 完善 EngineAdapter 接口定义，支持 `execute(input, config)` 方法；建立引擎注册机制，支持引擎名称、版本、能力描述、配置参数等元数据管理。
- **不动边界：**
  - 不改动现有 `EngineRegistry` 的核心注册逻辑（只扩展，不重构）
  - 不改动现有 MockEngineAdapter 和 HttpEngineAdapter 的基本结构

**关键设计点 / 风险点：**

1. **接口定义：** 参考《EngineSpec_V1.1》中的 EngineAdapter 接口，定义 `execute(input: EngineInput, config?: EngineConfig): Promise<EngineOutput>` 方法
2. **元数据管理：** 引擎元数据存储在内存（Map），后续可迁移到数据库（ModelRegistry 表）
3. **版本控制：** 支持同一引擎的多个版本注册，使用 `engine:version` 作为唯一标识
4. **向后兼容：** 确保现有 MockEngineAdapter 和 HttpEngineAdapter 实现新接口

**自检方式：**

- 验证引擎注册/查询功能正常
- 验证同一引擎的多个版本可以共存
- 验证接口调用符合类型定义

---

### S2-B.2：HTTP 引擎适配器实现（调用真实 HTTP 引擎、错误处理、超时控制）

**文件清单：**

- **修改：**
  - `apps/api/src/engine/adapters/http-engine.adapter.ts` - 实现完整的 HTTP 引擎调用逻辑
  - `apps/api/src/engine/engine-adapter.interface.ts` - 完善接口定义（如果需要）
  - `packages/config/src/env.ts` - 添加 HTTP 引擎配置（ENGINE_HTTP_TIMEOUT、ENGINE_HTTP_RETRY）

**核心目标与不动边界：**

- **目标：** 实现完整的 HTTP 引擎适配器，支持调用真实 HTTP 引擎（基于 `ENGINE_REAL_HTTP_BASE_URL`），包括请求构建、响应解析、错误处理、超时控制、重试机制。
- **不动边界：**
  - 不改动现有 EngineRegistry 的注册机制
  - 不改动现有 MockEngineAdapter 的实现

**关键设计点 / 风险点：**

1. **HTTP 调用：** 使用 `fetch` 或 `axios` 调用 HTTP 引擎，支持 POST 请求，请求体为 `EngineInput` JSON
2. **超时控制：** 使用环境变量 `ENGINE_HTTP_TIMEOUT`（默认 30 秒），超时抛出 `TimeoutError`
3. **重试机制：** 网络错误自动重试 3 次，使用指数退避（1s, 2s, 4s）
4. **错误处理：** 区分网络错误、超时错误、业务错误（HTTP 4xx/5xx），返回统一的 `EngineOutput` 格式
5. **响应解析：** 解析 HTTP 响应为 `EngineOutput`，支持错误信息的提取

**自检方式：**

- 配置真实 HTTP 引擎 URL，验证调用成功
- 模拟网络超时，验证超时处理
- 模拟 HTTP 错误（4xx/5xx），验证错误处理
- 验证重试机制正常工作

---

### S2-B.3：引擎元数据管理与版本控制

**文件清单：**

- **新增：**
  - `apps/api/src/engine/engine-metadata.controller.ts` - 引擎元数据管理 API
  - `apps/api/src/engine/dto/engine-metadata.dto.ts` - 完善 DTO（版本、能力描述等）
- **修改：**
  - `apps/api/src/engine/engine-metadata.service.ts` - 实现元数据 CRUD 和版本管理
  - `apps/api/src/engine/engine-registry.service.ts` - 集成元数据查询
  - `packages/database/prisma/schema.prisma` - 使用现有 `ModelRegistry` 表（如果适用）或扩展 EngineRegistry 内存存储

**核心目标与不动边界：**

- **目标：** 建立引擎元数据管理系统，支持引擎版本查询、能力描述、性能指标、兼容性信息等。为后续 CE 引擎接入提供元数据基础。
- **不动边界：**
  - 不改动现有 EngineAdapter 接口
  - 不改动现有引擎注册的核心逻辑

**关键设计点 / 风险点：**

1. **元数据存储：** 优先使用内存存储（Map），后续可迁移到 `ModelRegistry` 表
2. **版本管理：** 支持语义化版本（semver），使用 `engine:version` 作为唯一标识
3. **能力描述：** 元数据包含 `supportedTaskTypes`、`supportedInputFormats`、`supportedOutputFormats` 等
4. **性能指标：** 记录引擎的 `latency`、`throughput`、`cost` 等指标（可选，MVP 阶段可以占位）

**自检方式：**

- 验证引擎元数据的 CRUD 操作
- 验证版本查询功能
- 验证能力匹配逻辑（根据 TaskType 查找合适的引擎）

---

### S2-C.1：NOVEL_ANALYSIS 链路验证与优化（确保全链路稳定运行）

**文件清单：**

- **修改：**
  - `apps/workers/src/novel-analysis-processor.ts` - 优化错误处理和日志
  - `apps/api/src/novel-import/novel-import.service.ts` - 确保与 Orchestrator 集成
  - `apps/api/src/project/structure-generate.service.ts` - 优化结构生成逻辑
  - `apps/api/src/job/job.service.ts` - 确保 NOVEL_ANALYSIS Job 的正确处理

**核心目标与不动边界：**

- **目标：** 验证并优化 NOVEL_ANALYSIS 全链路（导入 → 创建 Job → Worker 处理 → 结构生成），确保链路稳定、错误处理完善、日志可追溯。
- **不动边界：**
  - 不改动现有 NOVEL_ANALYSIS 的核心业务逻辑
  - 不改动现有数据库结构（Project/Season/Episode/Scene/Shot）
  - 不改动现有 Worker 协议

**关键设计点 / 风险点：**

1. **链路验证：** 端到端测试：导入小说 → 创建 NOVEL_ANALYSIS Job → Worker 处理 → 生成结构 → 查询 SceneGraph
2. **错误处理：** 确保每个环节的错误都能正确传播和处理，不会导致数据不一致
3. **日志完善：** 关键节点添加结构化日志，便于问题排查
4. **性能优化：** 确保大规模小说（>100 章节）的处理性能

**自检方式：**

- 执行端到端测试，验证全链路正常
- 模拟各种错误场景（文件格式错误、分析失败、结构生成失败），验证错误处理
- 查看日志，确认关键节点都有日志记录

---

### S2-C.2：Task → EngineTask 映射机制（为 CE 引擎任务准备数据）

**文件清单：**

- **新增：**
  - `apps/api/src/task/engine-task-mapper.service.ts` - Task 到 EngineTask 的映射服务
  - `apps/api/src/task/dto/engine-task-mapper.dto.ts` - 映射参数 DTO
- **修改：**
  - `apps/api/src/task/task.service.ts` - 添加 EngineTask 创建方法
  - `apps/api/src/project/structure-generate.service.ts` - 在结构生成后创建 EngineTask
  - `packages/shared-types/src/engine-task.ts` - EngineTask 相关类型定义（新增）

**核心目标与不动边界：**

- **目标：** 建立 Task 到 EngineTask 的映射机制，当 NOVEL_ANALYSIS 完成后，自动创建对应的 EngineTask，为后续 CE 引擎调用准备数据（Scene/Shot 的文本、上下文等）。
- **不动边界：**
  - 不改动现有 Task 和 EngineTask 的数据库结构
  - 不改动现有 NOVEL_ANALYSIS 的处理逻辑

**关键设计点 / 风险点：**

1. **映射时机：** 在 `structure-generate.service.ts` 的 `applyAnalyzedStructureToDatabase` 完成后，自动创建 EngineTask
2. **数据准备：** EngineTask 的 `input` 字段包含 Scene/Shot 的文本、上下文信息，格式参考《EngineSpec_V1.1》中的 `EngineInput`
3. **任务类型：** 根据 Scene/Shot 的类型，创建不同类型的 EngineTask（例如：`SCENE_SUMMARY`、`SHOT_PLAN`）
4. **批量创建：** 支持批量创建 EngineTask（一个 Scene 对应多个 Shot 的 EngineTask）

**自检方式：**

- 执行 NOVEL_ANALYSIS，验证 EngineTask 是否正确创建
- 验证 EngineTask 的 `input` 数据格式正确
- 验证批量创建性能（100+ EngineTask）

---

### S2-D.1：Worker 状态监控面板（Worker 列表、心跳状态、负载情况）

**文件清单：**

- **新增：**
  - `apps/api/src/worker/worker-monitoring.controller.ts` - Worker 监控 API
  - `apps/api/src/worker/dto/worker-monitoring.dto.ts` - Worker 监控 DTO
- **修改：**
  - `apps/api/src/worker/worker.service.ts` - 添加监控相关方法（Worker 统计、健康检查）
  - `apps/web/src/app/studio/workers/page.tsx` - Worker 监控页面（新增）
  - `apps/web/src/components/workers/WorkerList.tsx` - Worker 列表组件（新增）
  - `apps/web/src/components/workers/WorkerStatusCard.tsx` - Worker 状态卡片组件（新增）

**核心目标与不动边界：**

- **目标：** 实现 Worker 状态监控面板，展示 Worker 列表、心跳状态、当前负载、GPU 使用情况、历史统计等信息。
- **不动边界：**
  - 不改动现有 Worker 注册/心跳协议
  - 不改动现有 WorkerService 的核心方法

**关键设计点 / 风险点：**

1. **数据来源：** 基于现有 `WorkerNode` 表数据，不新增数据库表
2. **实时性：** Worker 状态数据可以缓存（Redis），TTL 设置为 10 秒
3. **健康检查：** 基于 `lastHeartbeat` 判断 Worker 是否在线（超时阈值 30 秒）
4. **负载计算：** 使用 `tasksRunning / maxBatchSize` 计算负载率

**自检方式：**

- 访问 Worker 监控页面，验证数据展示正确
- 模拟 Worker 离线，验证状态更新
- 验证负载计算准确性

---

### S2-D.2：调度统计与任务依赖可视化（调度效率、任务关系图）

**文件清单：**

- **新增：**
  - `apps/api/src/orchestrator/scheduling-stats.controller.ts` - 调度统计 API
  - `apps/api/src/orchestrator/dto/scheduling-stats.dto.ts` - 调度统计 DTO
  - `apps/web/src/components/scheduling/SchedulingStats.tsx` - 调度统计组件（新增）
  - `apps/web/src/components/scheduling/TaskDependencyGraph.tsx` - 任务依赖图组件（新增）
- **修改：**
  - `apps/api/src/orchestrator/orchestrator.service.ts` - 添加统计计算方法
  - `apps/web/src/app/studio/jobs/page.tsx` - 集成调度统计展示

**核心目标与不动边界：**

- **目标：** 实现调度统计展示（平均等待时间、调度成功率、Worker 利用率）和任务依赖关系可视化（Task → Job 关系图）。
- **不动边界：**
  - 不改动现有调度逻辑
  - 不改动现有 Task/Job 数据结构

**关键设计点 / 风险点：**

1. **统计计算：** 基于现有 Job/Task 数据计算，使用聚合查询，不新增数据库表
2. **依赖关系：** 基于 `Task.jobs` 关系构建依赖图，使用前端图表库（如 `react-flow` 或 `vis.js`）
3. **性能考虑：** 统计计算可以缓存（Redis），TTL 设置为 1 分钟
4. **数据范围：** 支持按时间范围、项目、任务类型过滤统计

**自检方式：**

- 访问调度统计页面，验证统计数据正确性
- 验证任务依赖图正确展示 Task → Job 关系
- 验证过滤功能正常工作

---

### S2-E.1：质量评分计算服务（基于现有模型计算基础评分）

**文件清单：**

- **新增：**
  - `apps/api/src/quality/quality-scoring.service.ts` - 质量评分计算服务
  - `apps/api/src/quality/dto/quality-score.dto.ts` - 质量评分 DTO
- **修改：**
  - `apps/api/src/quality/quality.module.ts` - 质量模块（新增）
  - `packages/shared-types/src/quality.ts` - 质量相关类型定义（新增）

**核心目标与不动边界：**

- **目标：** 实现基础质量评分计算服务，基于现有 `QualityScore` 模型计算 `visualDensityScore`、`consistencyScore`、`motionScore`、`clarityScore`、`aestheticScore`、`overallScore`。MVP 阶段使用简单算法（例如：基于 Shot 的 `params` 和 `qualityScore` 字段计算）。
- **不动边界：**
  - 不改动现有 `QualityScore` 数据库结构
  - 不改动现有 Shot 的数据结构

**关键设计点 / 风险点：**

1. **评分算法：** MVP 阶段使用简单算法，参考《QualityOptimizationSpec_V1.1》中的 MVP 算法，基于 Shot 的 `params`（如 `duration`、`complexity`）和现有 `qualityScore` 字段计算
2. **计算时机：** 在 Shot 创建或更新时自动计算质量评分，或通过 API 手动触发
3. **性能考虑：** 质量评分计算可以异步进行，不阻塞主流程
4. **数据来源：** 基于现有 Shot 数据，不新增数据源

**自检方式：**

- 创建/更新 Shot，验证质量评分自动计算
- 验证评分结果在合理范围内（0-1 或 0-100）
- 验证批量计算性能（100+ Shot）

---

### S2-E.2：质量反馈闭环（评分结果写入、基础优化建议）

**文件清单：**

- **新增：**
  - `apps/api/src/quality/quality-optimization.service.ts` - 质量优化建议服务
  - `apps/api/src/quality/dto/optimization-suggestion.dto.ts` - 优化建议 DTO
- **修改：**
  - `apps/api/src/quality/quality-scoring.service.ts` - 集成优化建议生成
  - `apps/api/src/shot/shot.controller.ts` - 添加质量评分查询接口（如果 Shot 模块存在）
  - `apps/web/src/components/quality/QualityScoreCard.tsx` - 质量评分展示组件（新增）

**核心目标与不动边界：**

- **目标：** 实现质量反馈闭环，将质量评分结果写入 `QualityScore` 表，并生成基础优化建议（例如：如果 `clarityScore` 低，建议调整 `params.clarity`）。MVP 阶段只做基础建议，不做复杂优化算法。
- **不动边界：**
  - 不改动现有 `QualityScore` 数据库结构
  - 不改动现有 Shot 的数据结构

**关键设计点 / 风险点：**

1. **优化建议：** MVP 阶段使用规则引擎（if-then 规则），不做机器学习优化
2. **建议格式：** 优化建议包含 `field`（要优化的字段）、`suggestion`（建议内容）、`reason`（原因）
3. **写入时机：** 质量评分计算完成后，自动写入 `QualityScore` 表
4. **性能考虑：** 优化建议生成可以异步进行，不阻塞主流程

**自检方式：**

- 验证质量评分正确写入 `QualityScore` 表
- 验证优化建议生成逻辑（低分场景生成建议）
- 验证建议格式符合 DTO 定义

---

## 四、Stage2 计划的执行顺序与依赖

### 推荐执行顺序：

**第一阶段：基础调度能力（S2-A.1 → S2-A.2 → S2-A.3）**

- **S2-A.1**（调度策略优化）→ **S2-A.2**（故障恢复）→ **S2-A.3**（可观测性）
- **依赖关系：** 串行执行，每个批次依赖前一个批次的基础能力
- **风险等级：** 中等（改动核心调度逻辑，需要充分测试）

**第二阶段：引擎体系建立（S2-B.1 → S2-B.2 → S2-B.3）**

- **S2-B.1**（接口完善）→ **S2-B.2**（HTTP 适配器）→ **S2-B.3**（元数据管理）
- **依赖关系：** 串行执行，接口定义是后续实现的基础
- **风险等级：** 低（主要是新增功能，不影响现有系统）

**第三阶段：NOVEL_ANALYSIS 链路（S2-C.1 → S2-C.2）**

- **S2-C.1**（链路验证）→ **S2-C.2**（EngineTask 映射）
- **依赖关系：** 串行执行，EngineTask 映射依赖链路稳定
- **风险等级：** 中等（涉及核心业务逻辑，需要回归测试）

**第四阶段：监控与可视化（S2-D.1 → S2-D.2）**

- **S2-D.1**（Worker 监控）和 **S2-D.2**（调度统计）可以并行执行
- **依赖关系：** 都依赖 S2-A.3 的可观测性基础，但可以并行开发
- **风险等级：** 低（主要是前端展示，不影响后端逻辑）

**第五阶段：质量评估 MVP（S2-E.1 → S2-E.2）**

- **S2-E.1**（评分计算）→ **S2-E.2**（反馈闭环）
- **依赖关系：** 串行执行，反馈闭环依赖评分计算
- **风险等级：** 低（新增功能，不影响现有系统）

### 并行执行建议：

- **S2-D.1** 和 **S2-D.2** 可以并行开发（前端和后端可以分开开发）
- **S2-B.2** 和 **S2-B.3** 可以部分并行（HTTP 适配器实现和元数据管理可以分开开发）

### 关键依赖关系：

1. **S2-A.3** 是 **S2-D.1** 和 **S2-D.2** 的基础（可观测性数据）
2. **S2-B.1** 是 **S2-B.2** 和 **S2-B.3** 的基础（接口定义）
3. **S2-C.1** 是 **S2-C.2** 的基础（链路稳定）
4. **S2-E.1** 是 **S2-E.2** 的基础（评分计算）

### 高风险批次（需要特别小心）：

- **S2-A.1** 和 **S2-A.2**：改动核心调度逻辑，可能影响现有 Job 分配
- **S2-C.1**：涉及核心业务逻辑，需要充分回归测试

---

## 五、封顶语（禁止越界）

**Stage2 执行约束：**

1. **严格限定范围：** Stage2 的所有 MODE: EXECUTE 必须严格限定在上述批次（S2-A.1 至 S2-E.2）内，禁止修改未在批次 PLAN 中列出的模块/文件。禁止触碰：
   - Stage3 相关模块（完整计费系统、复杂推荐算法、模型训练系统等）
   - 数据库 schema 的破坏性变更（不执行 `prisma migrate`，只使用现有字段）
   - 现有安全链路（HMAC、RBAC、审计）的核心逻辑

2. **执行前必须阅读文档：** 在执行任一批次前，必须再次先阅读《AI开发文档规则》《开发执行顺序说明书》《Gemini 开发启动指令书》并引用对应约束。特别是：
   - 调度策略必须参考《WorkerPool*Orchestrator*调度系统设计书\_V1.0》
   - 引擎接口必须参考《引擎体系说明书\_EngineSpec_V1.1》
   - 任务系统必须参考《平台任务系统与异步执行机制说明书\_TaskSystemAsyncExecutionSpec_V1.0》
   - 质量评估必须参考《质量评估与自动优化体系说明书\_QualityOptimizationSpec_V1.1》

3. **禁止越界执行：** 在我没有明确说"执行 S2-X.Y"之前，你不得进入 MODE: EXECUTE，只能保持 MODE: PLAN 或 MODE: REVIEW。

4. **批次内最小改动原则：** 每个批次只做 PLAN 中列出的改动，不扩展功能，不重构未列出的模块。

5. **自检要求：** 每个批次完成后，必须执行 `pnpm build` 和 `pnpm lint`，确保无错误；必须执行对应的自检方式，验证功能正确性。

---

**Stage2 PLAN 完成。等待用户确认后进入 MODE: EXECUTE。**
