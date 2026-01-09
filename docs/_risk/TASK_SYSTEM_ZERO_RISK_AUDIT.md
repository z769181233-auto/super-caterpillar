# 任务系统"0雷区/0脆弱"全面审计报告

## 模式声明

**MODE: RESEARCH** - 只分析，不改代码

## 审计范围

- Job/Task 状态写入点
- attempts/retryCount/maxRetry 口径一致性
- 状态转换规则验证覆盖度
- heartbeat timeout 硬编码
- 审计日志写入完整性
- 可观测性埋点完整性
- Health endpoints 存在性

---

## A. 状态写入点扫描结果

### A.1 Job 状态写入点

**已使用规则验证的位置：**

1. ✅ `apps/api/src/job/job.service.ts:446` - `getAndMarkNextPendingJob`: 使用 `assertTransition(PENDING -> RUNNING)`
2. ✅ `apps/api/src/job/job.service.ts:593` - `reportJobResult`: 使用 `assertTransition(RUNNING -> SUCCEEDED/FAILED)`
3. ✅ `apps/api/src/job/job.service.ts:781` - `retryJobIfPossible`: 使用 `assertTransition(RUNNING -> RETRYING/FAILED)`
4. ✅ `apps/api/src/job/job.retry.ts:92` - `markRetryOrFail`: 内部调用，但未直接验证（由调用方验证）

**潜在风险点：**

1. ⚠️ `apps/api/src/orchestrator/orchestrator.service.ts:233-243` - `processRetryJobs`: 使用 `updateMany` 直接更新 `RETRYING -> PENDING`，**未调用 `assertTransition`**
   - 证据：`updateMany` 直接设置 `status: JobStatusEnum.PENDING`
   - 影响：虽然符合规则（RETRYING -> PENDING 是允许的），但缺少显式验证，违反"所有状态转换必须被规则函数验证"原则

2. ⚠️ `apps/api/src/worker/worker.service.ts:294` - `startJob`: 直接更新 `status: JobStatus.RUNNING`，**未调用 `assertTransition`**
   - 证据：`update` 直接设置状态
   - 影响：可能绕过规则验证

### A.2 Task 状态写入点

- 未在本次审计范围内（聚焦 Job 系统）

---

## B. attempts/retryCount/maxRetry 口径扫描结果

### B.1 口径使用情况

**正确使用 retryCount 的位置：**

1. ✅ `apps/api/src/job/job.retry.ts:35` - `computeNextRetry`: 使用 `retryCount + 1`
2. ✅ `apps/api/src/job/job.service.ts:609` - `reportJobResult`: `retryCount: job.retryCount`（保持不变）
3. ✅ `apps/api/src/job/job.service.ts:779` - `retryJobIfPossible`: 使用 `computeNextRetry(job)`（基于 retryCount）
4. ✅ `apps/api/src/job/job-worker.service.ts:73` - `processJobs`: 过滤条件 `job.retryCount >= job.maxRetry`

**attempts 使用情况（仅作为统计）：**

1. ✅ `apps/api/src/job/job.service.ts:464` - `getAndMarkNextPendingJob`: `attempts: job.attempts + 1`（仅统计）
2. ✅ `apps/api/src/job/job.service.ts:608` - `reportJobResult`: `attempts: job.attempts + 1`（仅统计）
3. ✅ `apps/api/src/job/job.service.ts:298` - `worker.service.ts:startJob`: `attempts: job.attempts + 1`（仅统计）
4. ✅ `apps/api/src/job/job.service.ts:634,831` - 审计日志：`attempts: job.attempts`（仅统计）

**口径冲突风险：**

- ✅ **无冲突**：所有重试判断统一使用 `retryCount >= maxRetry`，`attempts` 仅用于统计

---

## C. 绕过规则验证的状态转换

### C.1 已发现的风险点

1. **P0 风险**：`apps/api/src/orchestrator/orchestrator.service.ts:233-243`
   - 位置：`processRetryJobs` 方法
   - 问题：使用 `updateMany` 直接更新状态，未调用 `assertTransition`
   - 触发条件：Orchestrator 定期调度时
   - 影响面：所有 RETRYING -> PENDING 转换
   - 修复原则：在 `updateMany` 前或后添加规则验证（或使用事务 + 逐条验证）

2. **P1 风险**：`apps/api/src/worker/worker.service.ts:294`
   - 位置：`startJob` 方法
   - 问题：直接更新状态，未调用 `assertTransition`
   - 触发条件：Worker 调用 `startJob` API
   - 影响面：PENDING -> RUNNING 转换（虽然逻辑上安全，但违反原则）
   - 修复原则：添加 `assertTransition` 验证

---

## D. heartbeat timeout 硬编码扫描结果

### D.1 硬编码位置

1. **P0 风险**：`apps/api/src/worker/worker.service.ts:220`
   - 代码：`const timeoutThreshold = new Date(Date.now() - 30 * 1000);`
   - 位置：`isWorkerOnline` 方法
   - 问题：硬编码 30 秒，未使用环境变量

2. **P0 风险**：`apps/api/src/worker/worker.service.ts:383`
   - 代码：`const timeoutThreshold = new Date(Date.now() - 30 * 1000);`
   - 位置：`determineWorkerState` 私有方法
   - 问题：硬编码 30 秒，未使用环境变量

3. **P1 风险**：`apps/api/src/worker/worker.service.ts:409`
   - 代码：`const TIMEOUT = 30000;`
   - 位置：`getWorkerMonitorSnapshot` 方法
   - 问题：硬编码 30000ms，用于监控快照判断

**已使用环境变量的位置：**

- ✅ `apps/api/src/worker/worker.service.ts:323` - `markOfflineWorkers`: 使用 `env.workerHeartbeatTimeoutMs`
- ✅ `apps/api/src/orchestrator/orchestrator.service.ts:104` - `recoverJobsFromOfflineWorkers`: 使用 `env.workerHeartbeatTimeoutMs`

---

## E. 审计日志写入完整性

### E.1 已覆盖的审计点

1. ✅ Job 创建：`apps/api/src/job/job.service.ts:249`
2. ✅ Job 领取：`apps/api/src/job/job.service.ts:386`（内部，通过 `getAndMarkNextPendingJob`）
3. ✅ Job 上报：`apps/api/src/job/job.service.ts:570`
4. ✅ Job 成功：`apps/api/src/job/job.service.ts:620`
5. ✅ Job 重试/失败：`apps/api/src/job/job.service.ts:820`
6. ✅ Job 分发：`apps/api/src/orchestrator/orchestrator.service.ts:461`
7. ✅ Worker 注册：`apps/api/src/worker/worker.service.ts:73`

### E.2 缺失的审计点

1. ⚠️ **P2 风险**：`processRetryJobs` 释放 RETRYING -> PENDING 时，**未记录审计日志**
   - 位置：`apps/api/src/orchestrator/orchestrator.service.ts:196-264`
   - 影响：无法追溯重试 Job 的释放操作

2. ⚠️ **P2 风险**：`recoverJobsFromOfflineWorkers` 恢复 Job 时，**已有结构化日志，但未记录审计日志**
   - 位置：`apps/api/src/orchestrator/orchestrator.service.ts:100-188`
   - 影响：无法在审计表中追溯故障恢复操作

---

## F. 可观测性埋点完整性

### F.1 已覆盖的字段

1. ✅ `worker_id`: 在日志和审计中已记录
2. ✅ `duration`: 使用 `updatedAt - createdAt` 计算（见 `job.service.ts:635,794`）
3. ✅ `error_code`: 在重试/失败时已记录（见 `job.service.ts:814,834`）
4. ✅ `trace_id`: 在 Stage13 中已实现（见 `job.service.ts:503`）

### F.2 缺失的字段

1. **P1 风险**：`span_id` 缺失
   - 位置：所有日志和审计记录
   - 影响：无法进行分布式追踪
   - 文档要求：《平台日志监控与可观测性体系说明书\_ObservabilityMonitoringSpec_V1.0》

2. **P1 风险**：`model_used` 缺失
   - 位置：Job 执行日志和审计
   - 影响：无法追踪使用的模型/引擎
   - 文档要求：《平台日志监控与可观测性体系说明书\_ObservabilityMonitoringSpec_V1.0》

3. **P2 风险**：`duration` 口径不准确
   - 当前：`updatedAt - createdAt`（包含等待时间）
   - 理想：`finishedAt - startedAt`（仅执行时间）
   - 问题：Schema 中无 `startedAt`/`finishedAt` 字段
   - 影响：duration 包含队列等待时间，不准确
   - 修复建议：若不加字段，则在日志中明确标注口径

---

## G. Health Endpoints 扫描结果

### G.1 现有端点

- ❌ `/health/live` - **不存在**
- ❌ `/health/ready` - **不存在**
- ❌ `/health/gpu` - **不存在**

### G.2 文档要求

根据《平台日志监控与可观测性体系说明书\_ObservabilityMonitoringSpec_V1.0》：

- `/health/live`: 存活检查（不检查依赖）
- `/health/ready`: 就绪检查（检查 DB/Redis 等依赖）
- `/health/gpu`: GPU 可用性检查（可选，若无法实现需标注【假设】）

**P0 风险**：缺失健康检查端点，无法进行容器编排和监控集成。

---

## H. 与文档条目对照

### H.1 《平台任务系统与异步执行机制说明书\_TaskSystemAsyncExecutionSpec_V1.0》

| 要求                 | 状态    | 证据                                     |
| -------------------- | ------- | ---------------------------------------- |
| 状态转换必须明确定义 | ✅ 满足 | `job.rules.ts:ALLOWED_TRANSITIONS`       |
| 重试上限 ≤ 3         | ✅ 满足 | `schema.prisma:maxRetry Int @default(3)` |
| worker_id 字段       | ✅ 满足 | `schema.prisma:workerId String?`         |
| error_message 字段   | ✅ 满足 | `schema.prisma:lastError String?`        |
| result_url 字段      | ⚠️ 部分 | 存储在 `payload` JSON 中，非独立字段     |

### H.2 《平台日志监控与可观测性体系说明书\_ObservabilityMonitoringSpec_V1.0》

| 要求            | 状态    | 证据                                 |
| --------------- | ------- | ------------------------------------ |
| span_id 字段    | ❌ 缺失 | 所有日志/审计中无此字段              |
| worker_id 字段  | ✅ 满足 | 已记录                               |
| duration 字段   | ⚠️ 部分 | 使用 `updatedAt - createdAt`，不准确 |
| error_code 字段 | ✅ 满足 | 已记录                               |
| model_used 字段 | ❌ 缺失 | 未记录                               |
| /health/live    | ❌ 缺失 | 不存在                               |
| /health/ready   | ❌ 缺失 | 不存在                               |
| /health/gpu     | ❌ 缺失 | 不存在                               |

### H.3 《平台安全体系（SecuritySystemSpec）》

| 要求                                                        | 状态      | 证据                                    |
| ----------------------------------------------------------- | --------- | --------------------------------------- |
| 操作审计（user_id/action/resource/ip/ua/timestamp/details） | ✅ 满足   | `auditLogService.record` 已覆盖主要操作 |
| risk_score 字段                                             | ⚠️ 未验证 | 需检查 `audit_logs` 表结构              |

### H.4 《WorkerPool & Orchestrator 调度系统设计书》

| 要求                   | 状态    | 证据                                                                           |
| ---------------------- | ------- | ------------------------------------------------------------------------------ |
| 原子化领取（条件更新） | ✅ 满足 | `job.service.ts:455-466` 使用 `updateMany`                                     |
| 原子化释放（批量更新） | ✅ 满足 | `orchestrator.service.ts:233-243` 使用 `updateMany`                            |
| 二次验证 heartbeat     | ✅ 满足 | `orchestrator.service.ts:111-112`                                              |
| 可配置 timeout         | ⚠️ 部分 | `markOfflineWorkers` 已配置，但 `isWorkerOnline`/`determineWorkerState` 硬编码 |

---

## I. 风险清单汇总

### P0 风险（阻塞项）

1. **状态转换未验证**：`processRetryJobs` 直接更新状态，未调用 `assertTransition`
2. **硬编码 heartbeat timeout**：`isWorkerOnline` 和 `determineWorkerState` 使用硬编码 30 秒
3. **缺失 health endpoints**：`/health/live`, `/health/ready`, `/health/gpu` 不存在

### P1 风险（重要项）

1. **状态转换未验证**：`worker.service.ts:startJob` 直接更新状态
2. **可观测性字段缺失**：`span_id`, `model_used` 未记录
3. **duration 口径不准确**：使用 `updatedAt - createdAt`，包含等待时间

### P2 风险（改进项）

1. **审计日志缺失**：`processRetryJobs` 和 `recoverJobsFromOfflineWorkers` 未记录审计
2. **硬编码 timeout**：`getWorkerMonitorSnapshot` 使用硬编码 30000ms

---

## J. 修复原则（不越界）

1. **禁止修改 DB Schema**：除非文档明确要求且有证据
2. **禁止修改 API 接口**：除非文档明确要求
3. **最小改动**：只修复风险点，不重构
4. **必须验证**：所有修改后执行类型检查、语法检查、契约一致性验证

---

## K. 下一步

进入 **PLAN** 模式，制定修复计划。
