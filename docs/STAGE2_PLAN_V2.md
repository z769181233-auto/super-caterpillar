# Stage2 执行计划 V2（基于文档规范）

## 一、Stage2 的正确范围定义

### 核心目标（必须引用文档说明）

**1. Orchestrator / WorkerPool 从 Stage1「可运行版本」升级为文档要求的「生产级版本」**

依据《毛毛虫宇宙_WorkerPool_Orchestrator_调度系统设计书_V1.0》第 2~5 章要求：
- **可观测（Observability）**：调度指标、性能监控、调度日志（第 3 章 §3.4）
- **可回滚（Rollback）**：任务状态回滚机制（第 4 章 §4.2）
- **可恢复（Recovery）**：故障恢复与重试机制（第 5 章 §5.1~5.3）
- **可扩展（Scalable）**：多 Worker 并行 & 负载均衡（第 2 章 §2.3）
- **调度稳定性**：事务 + 悲观锁保证一次分配不重复（第 3 章 §3.1~3.5）

**2. 引入 EngineAdapter V1（EngineSpec 第 3 章要求）**

依据《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 3 章：
- **统一调度引擎调用**：EngineAdapter 接口定义（§3.1）
- **支持多引擎注册**：EngineRegistry 注册机制（§3.2）
- **支持 HTTP Engine 与本地 Engine 的抽象**：HTTP EngineAdapter 实现（§3.6）
- **引擎版本（EngineVersioning）**：同一引擎多版本管理（§3.3）

**3. 打通 NOVEL_ANALYSIS → 结构生成 → CE 引擎（如 CE01/CE07/CE08）的基础链路**

依据《毛毛虫宇宙_引擎体系说明书_EngineSpec_V1.1》第 4 章和《毛毛虫宇宙_平台任务系统与异步执行机制说明书_TaskSystemAsyncExecutionSpec_V1.0》：
- NOVEL_ANALYSIS 完成后自动创建 EngineTask（TaskSpec §7）
- EngineTask 入队（Job Queue）为后续 CE 引擎调用做准备（EngineSpec §4.2）

**4. 建立基础任务中心（Task Monitoring）**

依据《毛毛虫宇宙_平台任务系统与异步执行机制说明书_TaskSystemAsyncExecutionSpec_V1.0》第 4、6 章：
- Worker 状态监控面板（§4.1）
- 调度统计与任务依赖可视化（§6.1~6.2）

**5. 基于《质量优化体系说明书》实现最小可行 MVP（非完整系统）**

依据《毛毛虫宇宙_质量评估与自动优化体系说明书_QualityOptimizationSpec_V1.1》：
- 质量评分字段自动记录（§3.1 MVP 算法）
- 简易闭环（任务 → 评分 → 更新）（§6.1 基础反馈）

### Stage2 明确不做

- ❌ 不做计费系统实现（BillingSpec）
- ❌ 不做复杂用户增长或多租户策略
- ❌ 不做 CE 全流程流水线
- ❌ 不建立最终的模型管理系统（ModelUniverse）

---

## 二、Stage2 分解为 5 个模块、共 12 个批次

### S2-A：Orchestrator / WorkerPool 强化（3 批）

#### ● S2-A.1：调度稳定性增强（必读文档：调度系统设计书 §3.1~3.5）

**文件清单：**
- **修改：**
  - `apps/api/src/orchestrator/orchestrator.service.ts` - 集成事务 + 悲观锁、Worker 状态判断
  - `apps/api/src/worker/worker.service.ts` - 增强 Worker 心跳、状态判断（Idle/Busy/Dead）、Disabled Worker 跳过逻辑
  - `apps/api/src/job/job.service.ts` - 确保 Job 分配的事务性
- **新增：**
  - `packages/shared-types/src/jobs.ts` - Job 相关类型定义（如果缺失）

**核心目标与不动边界：**
- **目标：** 
  - 增强 Worker 心跳机制（与文档一致，参考调度系统设计书 §3.2）
  - 增强 Worker 状态判断（Idle/Busy/Dead），参考调度系统设计书 §3.3
  - 改成"事务 + 悲观锁"保证一次分配不重复（调度系统设计书 §3.1~3.5）
  - 加入 Disabled Worker 自动跳过逻辑（调度系统设计书 §3.4）
- **不动边界：**
  - 不修改 Job 协议（status 不允许新增字段）
  - 不改动 Worker 注册/心跳协议的核心接口
  - 不改动数据库 schema（只使用现有字段）

**关键设计点 / 风险点：**
1. **事务 + 悲观锁：** 参考调度系统设计书 §3.1，使用 Prisma `$transaction` + `SELECT ... FOR UPDATE` 确保 Job 分配原子性
2. **Worker 状态判断：** 参考调度系统设计书 §3.3，基于 `lastHeartbeat` 和 `status` 判断 Worker 状态（Idle/Busy/Dead）
3. **Disabled Worker 跳过：** 参考调度系统设计书 §3.4，在 `capabilities.disabled` 为 true 时自动跳过
4. **并发安全：** 确保多个 Orchestrator 实例并发调度时不会重复分配同一个 Job
5. **性能考虑：** 悲观锁可能影响并发性能，需要控制锁持有时间

**自检方式：**
- 并发 5 Worker 抢同一个 Job → 只能成功一个
- 模拟 Worker 心跳超时，验证状态正确更新为 Dead
- 验证 Disabled Worker 不会被选中
- 查看调度日志，确认事务和锁的使用

---

#### ● S2-A.2：故障恢复 & 重试（TaskSpec §5）

**文件清单：**
- **新增：**
  - `apps/api/src/orchestrator/retry.service.ts` - 重试服务（backoff 策略、重试队列）
- **修改：**
  - `apps/api/src/job/job.service.ts` - 集成故障恢复逻辑（Worker 异常退出处理、Job 重分配）
  - `apps/api/src/orchestrator/orchestrator.service.ts` - 集成重试服务
  - `apps/api/src/main.ts` - 添加定时任务（故障恢复、重试处理）

**核心目标与不动边界：**
- **目标：**
  - 失败任务自动进入 retry queue（按 backoff 策略），参考 TaskSpec §5.2
  - Worker 异常退出 → Job 进入 "ForceFailed" 或 "Re-Queue"，参考 TaskSpec §5.3
  - 死锁检测（长时间 PENDING 的 Job 自动重试），参考调度系统设计书 §5.1
- **不动边界：**
  - 不调整前端 UI
  - 不改动现有 Job 状态枚举（不新增状态）
  - 不改动 Worker 心跳协议

**关键设计点 / 风险点：**
1. **Backoff 策略：** 参考 TaskSpec §5.2，使用指数退避（1s, 2s, 4s, 8s...），最大重试次数由 `maxRetry` 控制
2. **Worker 异常退出处理：** 参考 TaskSpec §5.3，检测 `status=RUNNING && worker.status=offline` 的 Job，自动进入重试队列
3. **死锁检测：** 参考调度系统设计书 §5.1，检测 `status=PENDING && createdAt < now() - 1小时` 的 Job，自动增加 `retryCount` 并重新分配
4. **避免循环重试：** 检查 `retryCount >= maxRetry`，超过最大重试次数标记为 FAILED
5. **审计记录：** 所有自动恢复操作都要记录审计日志

**自检方式：**
- 人为 kill Worker → Job 正确转入 retry/backoff
- 模拟 Job 超时（手动设置 `startedAt` 为过去时间），验证是否自动标记为 FAILED
- 创建长时间 PENDING 的 Job，验证死锁检测是否生效
- 查看审计日志，确认所有恢复操作都有记录

---

#### ● S2-A.3：可观测性增强（ObservabilitySpec）

**文件清单：**
- **新增：**
  - `apps/api/src/monitoring/metrics.service.ts` - 指标服务（Worker 心跳数、队列长度、失败率、Job 排队时间）
  - `apps/api/src/monitoring/metrics.controller.ts` - 指标 API（Prometheus 友好格式）
  - `apps/api/src/monitoring/metrics.module.ts` - 监控模块
- **修改：**
  - `apps/api/src/orchestrator/orchestrator.service.ts` - 集成指标收集
  - `apps/api/src/observability/observability.service.ts` - 添加调度相关指标（可选）

**核心目标与不动边界：**
- **目标：**
  - 输出 Worker 心跳数、队列长度、失败率、Job 排队时间（参考 ObservabilitySpec）
  - Prometheus 友好格式（`/metrics` 端点）
  - 调度决策日志（结构化 JSON 格式）
- **不动边界：**
  - 不加入 Grafana，可留 TODO
  - 不改动现有 Orchestrator 调度逻辑（只添加指标收集，不改变调度行为）
  - 不改动现有 Observability 模块的核心接口

**关键设计点 / 风险点：**
1. **指标计算：** 基于现有 Job/Worker 数据计算，不新增数据库表，使用聚合查询
2. **性能影响：** 指标计算异步进行，不阻塞调度流程
3. **数据时效性：** 指标数据可以缓存（Redis），TTL 设置为 1 分钟
4. **Prometheus 格式：** 参考 Prometheus 规范，输出 `metric_name{label="value"} value` 格式
5. **日志结构化：** 调度决策日志使用结构化格式（JSON），便于后续分析

**自检方式：**
- `curl /metrics` 返回指标（Prometheus 格式）
- 查看调度日志，确认决策过程可追溯
- 验证指标计算不影响调度性能（调度延迟 < 100ms）

---

### S2-B：EngineAdapter V1（3 批）

#### ● S2-B.1：EngineAdapter 抽象层搭建（EngineSpec 第3章）

**文件清单：**
- **新增：**
  - `apps/api/src/engines/engine.adapter.ts` - EngineAdapter 接口定义（init/configure/run）
  - `apps/api/src/engines/engine.registry.ts` - EngineRegistry 注册机制（支持多引擎注册、从数据库或配置加载引擎元数据）
  - `packages/shared-types/src/engine.ts` - 引擎相关类型定义（EngineInput、EngineOutput、EngineConfig）
- **修改：**
  - `apps/api/src/engine/engine-adapter.interface.ts` - 完善接口定义（如果已有）
  - `apps/api/src/engine/engine-registry.service.ts` - 重构为新的注册机制（如果已有）

**核心目标与不动边界：**
- **目标：**
  - 定义 EngineAdapter 接口（init/configure/run），参考 EngineSpec §3.1
  - 支持多引擎注册（registry），参考 EngineSpec §3.2
  - 支持从数据库或配置加载引擎元数据，参考 EngineSpec §3.3
- **不动边界：**
  - 不改动现有 MockEngineAdapter 和 HttpEngineAdapter 的基本结构（只要求实现新接口）
  - 不改动数据库 schema（使用现有 `ModelRegistry` 表或内存存储）

**关键设计点 / 风险点：**
1. **接口定义：** 参考 EngineSpec §3.1，定义 `init(config: EngineConfig): Promise<void>`、`configure(params: any): void`、`run(input: EngineInput): Promise<EngineOutput>` 方法
2. **EngineResponse 对齐：** EngineOutput 必须与 EngineSpec §3.1 中的响应格式对齐
3. **注册机制：** 参考 EngineSpec §3.2，支持动态注册引擎，使用 `engine:name` 作为唯一标识
4. **元数据加载：** 参考 EngineSpec §3.3，优先从配置加载，后续可迁移到数据库（ModelRegistry 表）

**自检方式：**
- 验证引擎注册/查询功能正常
- 验证接口调用符合类型定义
- 验证 EngineOutput 格式符合 EngineSpec

---

#### ● S2-B.2：HTTP EngineAdapter（EngineSpec 3.6）

**文件清单：**
- **新增：**
  - `apps/api/src/engines/http-engine.adapter.ts` - HTTP EngineAdapter 实现（支持基于 HTTP 的 LLM / Diffusion / Parsing 引擎）
- **修改：**
  - `apps/api/src/engine/adapters/http-engine.adapter.ts` - 重构为新的接口实现（如果已有）
  - `packages/config/src/env.ts` - 添加 HTTP 引擎配置（ENGINE_HTTP_TIMEOUT、ENGINE_HTTP_RETRY、ENGINE_HTTP_BASE_URL）

**核心目标与不动边界：**
- **目标：**
  - 支持基于 HTTP 的 LLM / Diffusion / Parsing 引擎，参考 EngineSpec §3.6
  - 支持超时 / 重试 / auditing，参考 EngineSpec §3.6.1~3.6.3
- **不动边界：**
  - 不改动现有 EngineRegistry 的注册机制
  - 不改动现有 MockEngineAdapter 的实现

**关键设计点 / 风险点：**
1. **HTTP 调用：** 使用 `fetch` 或 `axios` 调用 HTTP 引擎，支持 POST 请求，请求体为 `EngineInput` JSON
2. **超时控制：** 使用环境变量 `ENGINE_HTTP_TIMEOUT`（默认 30 秒），超时抛出 `TimeoutError`
3. **重试机制：** 网络错误自动重试 3 次，使用指数退避（1s, 2s, 4s）
4. **错误处理：** 区分网络错误、超时错误、业务错误（HTTP 4xx/5xx），返回统一的 `EngineOutput` 格式
5. **Auditing：** 所有 HTTP 引擎调用都要记录审计日志（EngineSpec §3.6.3）

**自检方式：**
- 配置真实 HTTP 引擎 URL，验证调用成功
- 模拟网络超时，验证超时处理
- 模拟 HTTP 错误（4xx/5xx），验证错误处理
- 验证重试机制正常工作
- 验证审计日志记录

---

#### ● S2-B.3：EngineVersion 管理

**文件清单：**
- **新增：**
  - `packages/shared-types/src/engine-version.ts` - 引擎版本相关类型定义
- **修改：**
  - `apps/api/src/engines/engine.registry.ts` - 支持引擎版本管理（同一 Engine 可有多个版本、选择策略：latest / fixed / pinned）
  - `apps/api/src/engines/engine.adapter.ts` - 接口支持版本参数（如果需要）

**核心目标与不动边界：**
- **目标：**
  - 同一 Engine 可有多个版本，参考 EngineSpec §3.3
  - 选择策略：latest / fixed / pinned，参考 EngineSpec §3.3.1
- **不动边界：**
  - 不改动现有 EngineAdapter 接口（只扩展注册机制）
  - 不改动现有引擎注册的核心逻辑

**关键设计点 / 风险点：**
1. **版本管理：** 参考 EngineSpec §3.3，支持语义化版本（semver），使用 `engine:name:version` 作为唯一标识
2. **选择策略：** 参考 EngineSpec §3.3.1，支持 `latest`（最新版本）、`fixed`（固定版本）、`pinned`（锁定版本）
3. **版本查询：** 支持根据引擎名称和版本策略查询对应的引擎适配器

**自检方式：**
- 验证同一引擎的多个版本可以共存
- 验证版本选择策略（latest / fixed / pinned）
- 验证版本查询功能

---

### S2-C：NOVEL_ANALYSIS 全链路（2 批）

#### ● S2-C.1：链路优化（TaskSpec §7）

**文件清单：**
- **修改：**
  - `apps/api/src/novel-import/novel-analysis.service.ts` - 优化小说分析逻辑（如果存在）
  - `apps/api/src/novel-import/novel-analysis-processor.service.ts` - 优化分析处理器
  - `apps/workers/src/novel-analysis-processor.ts` - 优化 Worker 侧处理逻辑（错误处理、结构回写、评估日志）
  - `apps/api/src/project/structure-generate.service.ts` - 优化结构生成逻辑

**核心目标与不动边界：**
- **目标：**
  - 优化小说分析、错误处理、结构回写，参考 TaskSpec §7.1~7.3
  - 增加评估日志，参考 TaskSpec §7.4
- **不动边界：**
  - 不改动现有 NOVEL_ANALYSIS 的核心业务逻辑
  - 不改动现有数据库结构（Project/Season/Episode/Scene/Shot）
  - 不改动现有 Worker 协议

**关键设计点 / 风险点：**
1. **链路验证：** 端到端测试：导入小说 → 创建 NOVEL_ANALYSIS Job → Worker 处理 → 生成结构 → 查询 SceneGraph
2. **错误处理：** 确保每个环节的错误都能正确传播和处理，不会导致数据不一致
3. **日志完善：** 关键节点添加结构化日志，便于问题排查（参考 TaskSpec §7.4）
4. **性能优化：** 确保大规模小说（>100 章节）的处理性能

**自检方式：**
- 执行端到端测试，验证全链路正常
- 模拟各种错误场景（文件格式错误、分析失败、结构生成失败），验证错误处理
- 查看日志，确认关键节点都有日志记录

---

#### ● S2-C.2：EngineTask 映射（EngineSpec 第4章）

**文件清单：**
- **新增：**
  - `apps/api/src/engines/engine-task.mapper.ts` - EngineTask 映射服务（NOVEL_ANALYSIS 结束后，生成 EngineTask（如 CE01）、EngineTask 入队（Job Queue））
- **修改：**
  - `apps/api/src/project/structure-generate.service.ts` - 在结构生成后调用 EngineTask 映射
  - `apps/api/src/task/task.service.ts` - 添加 EngineTask 创建方法（如果需要）

**核心目标与不动边界：**
- **目标：**
  - NOVEL_ANALYSIS 结束后，生成 EngineTask（如 CE01），参考 EngineSpec §4.1
  - EngineTask 入队（Job Queue），参考 EngineSpec §4.2
- **不动边界：**
  - 不改动现有 Task 和 EngineTask 的数据库结构
  - 不改动现有 NOVEL_ANALYSIS 的处理逻辑

**关键设计点 / 风险点：**
1. **映射时机：** 在 `structure-generate.service.ts` 的 `applyAnalyzedStructureToDatabase` 完成后，自动创建 EngineTask
2. **数据准备：** EngineTask 的 `input` 字段包含 Scene/Shot 的文本、上下文信息，格式参考 EngineSpec §4.1 中的 `EngineInput`
3. **任务类型：** 根据 Scene/Shot 的类型，创建不同类型的 EngineTask（例如：`scene_parse`、`shot_plan`），参考 EngineSpec §4.1
4. **批量创建：** 支持批量创建 EngineTask（一个 Scene 对应多个 Shot 的 EngineTask）

**自检方式：**
- 执行 NOVEL_ANALYSIS，验证 EngineTask 是否正确创建
- 验证 EngineTask 的 `input` 数据格式正确
- 验证批量创建性能（100+ EngineTask）

---

### S2-D：任务中心 + 监控面板（2 批）

#### ● S2-D.1：Worker 状态监控面板（Web）

**文件清单：**
- **新增：**
  - `apps/web/src/app/studio/workers/page.tsx` - Worker 监控页面
  - `apps/web/src/components/workers/WorkerList.tsx` - Worker 列表组件
  - `apps/web/src/components/workers/WorkerStatusCard.tsx` - Worker 状态卡片组件
- **修改：**
  - `apps/api/src/worker/worker.controller.ts` - 添加 Worker 监控 API（Worker 列表、状态、历史失败任务）
  - `apps/api/src/worker/worker.service.ts` - 添加监控相关方法（Worker 统计、健康检查）

**核心目标与不动边界：**
- **目标：**
  - 查看 Worker 列表、状态（Idle/Busy/Dead），参考 TaskSpec §4.1
  - 查看历史失败任务，参考 TaskSpec §4.2
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

#### ● S2-D.2：调度统计面板

**文件清单：**
- **新增：**
  - `apps/web/src/app/studio/scheduler/page.tsx` - 调度统计页面
  - `apps/web/src/components/scheduling/SchedulingStats.tsx` - 调度统计组件
  - `apps/web/src/components/scheduling/TaskDependencyGraph.tsx` - 任务依赖图组件（可选）
- **修改：**
  - `apps/api/src/orchestrator/orchestrator.controller.ts` - 添加调度统计 API（任务数量、失败率、排队时长）
  - `apps/api/src/orchestrator/orchestrator.service.ts` - 添加统计计算方法

**核心目标与不动边界：**
- **目标：**
  - 图表展示任务数量、失败率、排队时长，参考 TaskSpec §6.1
  - 依赖 S2-A.3 的 metrics API
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
- 验证任务依赖图正确展示 Task → Job 关系（如果实现）
- 验证过滤功能正常工作

---

### S2-E：质量评估 & 自动优化 MVP（2 批）

#### ● S2-E.1：质量评分记录（QualitySpec）

**文件清单：**
- **新增：**
  - `apps/api/src/modules/quality/quality.service.ts` - 质量评分服务（保存评分：score/dimension/engine）
  - `apps/api/src/modules/quality/quality.module.ts` - 质量模块
  - `packages/shared-types/src/quality.ts` - 质量相关类型定义
- **修改：**
  - `apps/api/src/job/job.service.ts` - 在 Job 完成后调用质量评分服务（如果需要）

**核心目标与不动边界：**
- **目标：**
  - 保存评分（score/dimension/engine），参考 QualitySpec §3.1
  - 基于现有 `QualityScore` 模型，参考 QualitySpec §3.1 MVP 算法
- **不动边界：**
  - 不改动现有 `QualityScore` 数据库结构
  - 不改动现有 Shot 的数据结构

**关键设计点 / 风险点：**
1. **评分算法：** MVP 阶段使用简单算法，参考 QualitySpec §3.1 MVP 算法，基于 Shot 的 `params`（如 `duration`、`complexity`）和现有 `qualityScore` 字段计算
2. **计算时机：** 在 Shot 创建或更新时自动计算质量评分，或通过 API 手动触发
3. **性能考虑：** 质量评分计算可以异步进行，不阻塞主流程
4. **数据来源：** 基于现有 Shot 数据，不新增数据源

**自检方式：**
- 创建/更新 Shot，验证质量评分自动计算
- 验证评分结果在合理范围内（0-1 或 0-100）
- 验证批量计算性能（100+ Shot）

---

#### ● S2-E.2：闭环（QualitySpec §6）

**文件清单：**
- **新增：**
  - `apps/api/src/modules/quality/quality-optimization.service.ts` - 质量优化建议服务
  - `apps/api/src/modules/quality/dto/optimization-suggestion.dto.ts` - 优化建议 DTO
- **修改：**
  - `apps/api/src/engines/engine-task.mapper.ts` - 将质量分数反馈到 EngineTask 参数中（微调规则）
  - `apps/api/src/modules/quality/quality.service.ts` - 集成优化建议生成

**核心目标与不动边界：**
- **目标：**
  - 将质量分数反馈到 EngineTask 参数中（微调规则），参考 QualitySpec §6.1
  - MVP 阶段只做基础建议，不做复杂优化算法
- **不动边界：**
  - 不改动现有 `QualityScore` 数据库结构
  - 不改动现有 Shot 的数据结构

**关键设计点 / 风险点：**
1. **优化建议：** MVP 阶段使用规则引擎（if-then 规则），不做机器学习优化（参考 QualitySpec §6.1）
2. **建议格式：** 优化建议包含 `field`（要优化的字段）、`suggestion`（建议内容）、`reason`（原因）
3. **反馈机制：** 质量评分计算完成后，自动更新 EngineTask 的 `engineConfig` 参数（参考 QualitySpec §6.1）

**自检方式：**
- 验证质量评分正确写入 `QualityScore` 表
- 验证优化建议生成逻辑（低分场景生成建议）
- 验证建议格式符合 DTO 定义
- 验证反馈机制（EngineTask 参数更新）

---

## 三、执行顺序与依赖

### 推荐执行顺序：

**第一阶段：基础调度能力（S2-A.1 → S2-A.2 → S2-A.3）**
- **S2-A.1**（调度稳定性增强）→ **S2-A.2**（故障恢复）→ **S2-A.3**（可观测性）
- **依赖关系：** 串行执行，每个批次依赖前一个批次的基础能力
- **风险等级：** 高（改动核心调度逻辑，涉及并发竞争，需要充分测试）

**第二阶段：引擎体系建立（S2-B.1 → S2-B.2 → S2-B.3）**
- **S2-B.1**（接口完善）→ **S2-B.2**（HTTP 适配器）→ **S2-B.3**（版本管理）
- **依赖关系：** 串行执行，接口定义是后续实现的基础
- **风险等级：** 低（主要是新增功能，不影响现有系统）

**第三阶段：NOVEL_ANALYSIS 链路（S2-C.1 → S2-C.2）**
- **S2-C.1**（链路优化）→ **S2-C.2**（EngineTask 映射）
- **依赖关系：** 串行执行，EngineTask 映射依赖链路稳定
- **风险等级：** 中等（涉及核心业务逻辑，需要回归测试）

**第四阶段：监控与可视化（S2-D.1 和 S2-D.2 可并行）**
- **S2-D.1**（Worker 监控）和 **S2-D.2**（调度统计）可以并行执行
- **依赖关系：** 都依赖 S2-A.3 的可观测性基础，但可以并行开发
- **风险等级：** 低（主要是前端展示，不影响后端逻辑）

**第五阶段：质量评估 MVP（S2-E.1 → S2-E.2）**
- **S2-E.1**（评分计算）→ **S2-E.2**（反馈闭环）
- **依赖关系：** 串行执行，反馈闭环依赖评分计算
- **风险等级：** 低（新增功能，不影响现有系统）

### 关键依赖关系：

1. **S2-A.3** 是 **S2-D.1** 和 **S2-D.2** 的基础（可观测性数据）
2. **S2-B.1** 是 **S2-B.2** 和 **S2-B.3** 的基础（接口定义）
3. **S2-C.1** 是 **S2-C.2** 的基础（链路稳定）
4. **S2-E.1** 是 **S2-E.2** 的基础（评分计算）

### 高风险批次（需要特别小心）：

- **S2-A.1** 和 **S2-A.2**：改动核心调度逻辑，涉及并发竞争，可能影响现有 Job 分配
- **S2-C.1**：涉及核心业务逻辑，需要充分回归测试

---

## 四、封顶约束

**Stage2 执行约束：**

1. **严格限定范围：** Stage2 的所有 MODE: EXECUTE 必须严格限定在上述批次（S2-A.1 至 S2-E.2）内，禁止修改未在批次 PLAN 中列出的模块/文件。禁止触碰：
   - Stage3 相关模块（完整计费系统、复杂推荐算法、模型训练系统等）
   - 数据库 schema 的破坏性变更（不执行 `prisma migrate`，只使用现有字段）
   - 现有安全链路（HMAC、RBAC、审计）的核心逻辑

2. **执行前必须阅读文档：** 在执行任一批次前，必须再次先阅读《AI开发文档规则》《开发执行顺序说明书》《Gemini 开发启动指令书》并引用对应约束。特别是：
   - 调度策略必须参考《WorkerPool_Orchestrator_调度系统设计书_V1.0》第 2~5 章
   - 引擎接口必须参考《引擎体系说明书_EngineSpec_V1.1》第 3~4 章
   - 任务系统必须参考《平台任务系统与异步执行机制说明书_TaskSystemAsyncExecutionSpec_V1.0》第 4~7 章
   - 质量评估必须参考《质量评估与自动优化体系说明书_QualityOptimizationSpec_V1.1》第 3、6 章

3. **禁止越界执行：** 在我没有明确说"执行 S2-X.Y"之前，你不得进入 MODE: EXECUTE，只能保持 MODE: PLAN 或 MODE: REVIEW。

4. **批次内最小改动原则：** 每个批次只做 PLAN 中列出的改动，不扩展功能，不重构未列出的模块。

5. **自检要求：** 每个批次完成后，必须执行 `pnpm build` 和 `pnpm lint`，确保无错误；必须执行对应的自检方式，验证功能正确性。

6. **禁止新增 API / DB 字段 / 前端 UI：** 除以上 PLAN 明确要求外，禁止新增 API 端点、数据库字段、前端 UI 组件。

---

**Stage2 PLAN V2 完成。等待用户确认后进入 MODE: EXECUTE。**

