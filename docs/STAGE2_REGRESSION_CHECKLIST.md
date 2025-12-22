# Stage2 回归检查清单

**生成时间**: 2024-12-11  
**检查模式**: 只读回归检查（无代码修改）  
**构建状态**: ✅ 通过  
**Lint 状态**: ⚠️ 265 个警告（无错误）

---

## 1. S2-A 调度与重试

### 检查项

- [x] **getAndMarkNextPendingJob 并发安全性**
  - **文件**: `apps/api/src/job/job.service.ts`
  - **方法**: `getAndMarkNextPendingJob(workerId: string, jobType?: string)`
  - **实现细节**:
    - 使用 `$transaction` 包裹整个流程
    - 使用 `updateMany` 配合条件 `status IN [PENDING, RETRYING] AND workerId = null` 实现原子性更新
    - 检查更新影响行数，如果为 0 则说明竞态失败，返回 null
    - 仅从 `PENDING` 或 `RETRYING` 且 `workerId = null` 的 Job 中领取

- [x] **RUNNING/RETRYING/PENDING 状态流转**
  - **文件**: `apps/api/src/job/job.service.ts`
  - **关键方法**:
    - `getAndMarkNextPendingJob`: PENDING/RETRYING → RUNNING
    - `markJobFailedAndMaybeRetry`: RUNNING → RETRYING/FAILED
    - `processRetryJobs` (Orchestrator): RETRYING → PENDING（当 nextRetryAt 到期）
  - **状态流转路径**:
    - PENDING → RUNNING (领取时)
    - RETRYING → RUNNING (领取时，如果 nextRetryAt 已到期)
    - RUNNING → RETRYING (失败且未达最大重试)
    - RUNNING → FAILED (失败且已达最大重试)

- [x] **Worker 离线恢复逻辑**
  - **文件**: `apps/api/src/orchestrator/orchestrator.service.ts`
  - **方法**: `recoverJobsFromOfflineWorkers()`
  - **实现细节**:
    - 扫描所有 `status = 'offline'` 的 Worker
    - 查找这些 Worker 的 `status = RUNNING` 的 Job
    - 调用 `markJobFailedAndMaybeRetry` 恢复 Job
    - 记录结构化日志 `JOB_RECOVERED_FROM_OFFLINE_WORKER`
  - **调用时机**: 在 `dispatchJobs()` 中定期执行

### 当前状态评估

**S2-A**: 适用于单项目中低并发负载，使用数据库事务和条件更新实现并发安全。Worker 采用拉取模式，避免了"先查后改"的竞态问题。故障恢复机制已实现，能够处理 Worker 异常退出场景。后续可扩展为多项目优先级队列和更细粒度的重试策略。

---

## 2. S2-B EngineAdapter

### 检查项

- [x] **EngineAdapter 接口唯一权威位置**
  - **文件**: `packages/shared-types/src/engines/engine-adapter.ts`
  - **接口定义**: `EngineAdapter` 接口包含 `name`, `supports(engineKey)`, `invoke(input)` 方法
  - **导出位置**: `packages/shared-types/src/engines/index.ts`
  - **验证**: 所有 Adapter 实现均引用此接口

- [x] **EngineRegistry 默认 engineKey 选择**
  - **文件**: `apps/api/src/engine/engine-registry.service.ts`
  - **方法**: `findAdapter(engineKey?, jobType?)`
  - **选择逻辑**:
    1. 如果指定了 `engineKey`，优先查找并验证 `supports(engineKey)`
    2. 如果未指定，根据 `jobType` 查找默认引擎（`getDefaultEngineKeyForJobType`）
    3. 回退到全局默认引擎（`default_novel_analysis`）
  - **默认映射**: 
    - `NOVEL_ANALYSIS` → `default_novel_analysis`
    - `SHOT_RENDER` → `default_shot_render`

- [x] **NOVEL_ANALYSIS 仍然使用本地适配器**
  - **文件**: `apps/api/src/engines/adapters/novel-analysis.local.adapter.ts`
  - **适配器名称**: `default_novel_analysis`
  - **注册位置**: `apps/api/src/engines/engine.module.ts`
  - **验证**: `EngineRegistry.getDefaultEngineKeyForJobType('NOVEL_ANALYSIS')` 返回 `'default_novel_analysis'`
  - **注释说明**: 代码中明确注释 "NOVEL_ANALYSIS 继续使用本地 Adapter，不切换到 HTTP"

### 当前状态评估

**S2-B**: EngineAdapter 接口定义清晰，位于 shared-types 包中，保证了前后端类型一致性。EngineRegistry 实现了灵活的引擎选择策略，支持显式指定、按 JobType 默认、全局默认三级回退。NOVEL_ANALYSIS 保持使用本地适配器，符合当前架构设计。

---

## 3. S2-C NOVEL_ANALYSIS 链路

### 检查项

- [x] **导入 → NovelSource → Task → ShotJob → Worker → SceneGraph 的完整路径**
  - **导入入口**: `apps/api/src/novel-import/novel-import.controller.ts`
    - `POST /api/novels/import-file`: 上传文件
    - `POST /api/novels/import`: 导入文本
    - `POST /api/novels/analyze`: 触发分析
  - **Task 创建**: `apps/api/src/task/task.service.ts`
    - `createTask()` 创建 NOVEL_ANALYSIS 类型 Task
  - **Job 创建**: `apps/api/src/job/job.service.ts`
    - `create()` 创建关联的 ShotJob
  - **Worker 处理**: `apps/workers/src/novel-analysis-processor.ts`
    - Worker 拉取 Job 并执行分析
  - **SceneGraph 生成**: `apps/api/src/project/scene-graph.service.ts`
    - 分析完成后更新 SceneGraph

- [x] **EngineTaskSummary & EngineTaskService 的只读聚合逻辑**
  - **文件**: `apps/api/src/task/engine-task.service.ts`
  - **方法**: 
    - `findEngineTaskByTaskId(taskId)`: 根据 TaskId 查找
    - `findEngineTasksByProject(projectId, taskType?)`: 根据 ProjectId 查找列表
  - **聚合逻辑**:
    - 查询 Task 及其关联的 NOVEL_ANALYSIS 类型 Jobs
    - 从 Task/Job payload 中提取 `engineKey`
    - 通过 EngineRegistry 解析 `adapterName`
    - 构建 `EngineTaskSummary` 和 `EngineJobSummary` 视图
  - **只读验证**: 所有方法均为查询操作，无数据库写入

### 当前状态评估

**S2-C**: NOVEL_ANALYSIS 链路完整，从导入到分析到 SceneGraph 生成的流程已打通。EngineTaskService 提供了只读的 Task → EngineTask 视图聚合，便于前端展示引擎执行情况。链路中各个环节的职责清晰，符合异步执行架构。

---

## 4. S2-D 监控与可视化

### 检查项

- [x] **/api/workers/monitor/stats 返回结构**
  - **文件**: `apps/api/src/worker/worker-monitor.controller.ts`
  - **路由**: `GET /api/workers/monitor/stats`
  - **返回格式**:
    ```typescript
    {
      success: true,
      data: WorkerMonitorSnapshot,
      timestamp: string (ISO)
    }
    ```
  - **数据来源**: `WorkerService.getWorkerMonitorSnapshot()`

- [x] **/api/orchestrator/monitor/stats 返回结构**
  - **文件**: `apps/api/src/orchestrator/orchestrator-monitor.controller.ts`
  - **路由**: `GET /api/orchestrator/monitor/stats`
  - **返回格式**:
    ```typescript
    {
      success: true,
      data: {
        timestamp: string (ISO),
        jobs: { pending, running, retrying, failed, succeeded, total },
        workers: { total, online, offline, idle, busy },
        retries: { recent24h: { total, byType } },
        queue: { avgWaitTimeMs, avgWaitTimeSeconds },
        recovery: { recent1h: { recoveredJobs } }
      },
      requestId: string,
      timestamp: string (ISO)
    }
    ```
  - **数据来源**: `OrchestratorService.getStats()`

- [x] **/api/tasks/:taskId/graph 返回结构**
  - **文件**: `apps/api/src/task/task-graph.controller.ts`
  - **路由**: `GET /api/tasks/:taskId/graph`
  - **返回格式**:
    ```typescript
    {
      success: true,
      data: {
        taskId: string,
        projectId: string,
        taskType: string,
        status: string,
        jobs: TaskGraphJobNode[],
        qualityScores: QualityScoreRecord[],
        qualityFeedback: QualityFeedbackResult
      },
      requestId: string,
      timestamp: string (ISO)
    }
    ```
  - **数据来源**: `TaskGraphService.findTaskGraph()` + `QualityScoreService` + `QualityFeedbackService`

- [x] **/monitor/workers 与 /monitor/scheduler 页面基础渲染**
  - **文件**: 
    - `apps/web/src/app/monitor/workers/page.tsx`
    - `apps/web/src/app/monitor/scheduler/page.tsx`
  - **功能**: 
    - Workers 页面显示 Worker 状态统计
    - Scheduler 页面显示 Job 状态统计、重试分布、队列等待时间、故障恢复统计
  - **刷新机制**: Scheduler 页面每 5 秒自动刷新，使用 `cancelled` 标志防止内存泄漏

### 当前状态评估

**S2-D**: 监控 API 返回结构统一，包含 `success`, `data`, `requestId`, `timestamp` 字段。前端监控页面已实现基础渲染，能够展示调度统计和 Worker 状态。所有时间字段均为 ISO 格式字符串。前端页面已实现内存泄漏防护机制。

---

## 5. S2-E 质量记录与反馈

### 检查项

- [x] **QualityScoreRecord 定义位置与字段含义**
  - **文件**: `packages/shared-types/src/quality/quality-score.dto.ts`
  - **接口定义**:
    ```typescript
    {
      taskId: string;
      jobId: string;
      engineKey: string;
      adapterName: string;
      modelInfo?: { modelName?, version? };
      metrics: { durationMs?, tokens?, costUsd? };
      quality: { confidence?, score? };
      timestamp: string;
    }
    ```
  - **导出位置**: `packages/shared-types/src/quality/index.ts` → `packages/shared-types/src/index.ts`

- [x] **QualityScoreService 的只读构建逻辑**
  - **文件**: `apps/api/src/quality/quality-score.service.ts`
  - **方法**: `buildQualityScoreFromJob(job, adapter, taskId)`
  - **提取逻辑**:
    - `engineKey`: 从 `job.payload.engineKey` 或按 jobType 默认值
    - `adapterName`: 从 `adapter.name` 或 `engineKey`
    - `metrics`: 从 `job.payload.result.metrics`
    - `quality`: 从 `job.payload.result.quality` 或 `job.payload.result`
    - `modelInfo`: 从 `job.payload.result.modelInfo`
  - **只读验证**: 仅读取数据，无数据库写入

- [x] **QualityFeedbackService 的只读聚合逻辑**
  - **文件**: `apps/api/src/quality/quality-feedback.service.ts`
  - **方法**: `evaluateQualityScores(records: QualityScoreRecord[])`
  - **聚合逻辑**:
    - 遍历所有记录，统计有效 `score` 和 `confidence` 值
    - 计算平均值（`avgScore`, `avgConfidence`）
    - 返回总数（`total`）
  - **返回类型**: `{ avgScore: number | null, avgConfidence: number | null, total: number }`
  - **只读验证**: 仅计算聚合值，无数据库写入

- [x] **TaskGraphController 中 qualityScores + qualityFeedback 的挂载方式**
  - **文件**: `apps/api/src/task/task-graph.controller.ts`
  - **挂载逻辑**:
    1. 调用 `buildQualityScores(taskId, graph.jobs)` 构建质量评分记录列表
    2. 调用 `qualityFeedbackService.evaluateQualityScores(qualityScores)` 评估聚合结果
    3. 在返回 JSON 的 `data` 中追加 `qualityScores` 和 `qualityFeedback` 字段
  - **实现细节**:
    - 查询原始 Job 数据（包含 payload）
    - 对每个 Job 提取 engineKey，获取 adapter
    - 调用 `QualityScoreService.buildQualityScoreFromJob` 构建记录
    - 所有操作均为只读聚合，不修改数据库

### 当前状态评估

**S2-E**: 质量记录与反馈系统已实现只读聚合功能。QualityScoreRecord 定义清晰，字段含义明确。QualityScoreService 能够从 Job payload 中提取质量相关数据。QualityFeedbackService 提供了简单的聚合分析功能。所有逻辑均为只读，不涉及数据库写入，符合当前阶段的设计要求。

---

## 全局风险点 / 注意事项

### 并发与性能

1. **Job 领取并发安全**: 当前使用 `updateMany` + 条件更新实现原子性，在高并发场景下可能存在轻微的性能瓶颈。建议后续考虑使用数据库级别的 SELECT FOR UPDATE（如果数据库支持）。

2. **Worker 离线检测**: 当前使用心跳超时机制检测离线 Worker，如果 Worker 网络抖动可能导致误判。建议后续增加更细粒度的健康检查机制。

3. **重试策略**: 当前重试时间存储在 `payload.nextRetryAt`，如果 payload 结构变化可能影响重试逻辑。建议后续考虑在 schema 中增加 `nextRetryAt` 字段。

### 架构扩展性

4. **EngineAdapter 接口**: 当前接口较为简单，如果后续需要支持更复杂的引擎特性（如流式输出、取消操作等），可能需要扩展接口。

5. **多项目优先级**: 当前 Job 优先级为单项目内优先级，如果后续需要跨项目优先级队列，需要重新设计优先级字段和查询逻辑。

6. **质量评分持久化**: 当前 QualityScoreRecord 仅在 API 响应中返回，未持久化到数据库。如果后续需要历史质量分析，需要设计质量评分表。

### 监控与可观测性

7. **结构化日志**: 当前部分关键操作已记录结构化日志，但覆盖范围可能不够全面。建议后续统一所有关键操作的日志格式。

8. **指标采集**: 当前监控 API 提供的是快照数据，如果后续需要时间序列分析，可能需要引入指标采集系统（如 Prometheus）。

### 前端集成

9. **类型安全**: 前端使用 `any` 类型较多，建议后续逐步替换为从 shared-types 导入的具体类型。

10. **错误处理**: 前端监控页面的错误处理较为简单，建议后续增加更友好的错误提示和重试机制。

---

## 总结

**构建状态**: ✅ 通过  
**Lint 状态**: ⚠️ 265 个警告（无错误，主要为 `@typescript-eslint/no-explicit-any` 警告）  
**功能完整性**: ✅ 所有 Stage2 模块均已实现  
**代码质量**: ✅ 符合只读聚合设计原则，无数据库写入逻辑  
**架构合理性**: ✅ 符合异步执行架构，职责划分清晰  

**总体评估**: Stage2 实现完整，各模块功能正常，符合设计文档要求。当前实现适用于单项目中低并发负载场景，为后续扩展预留了接口和架构空间。

