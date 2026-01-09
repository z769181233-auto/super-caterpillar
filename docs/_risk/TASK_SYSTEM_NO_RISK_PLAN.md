# 任务系统 0 雷区分析报告

## 模式声明

**MODE: RESEARCH** - 只做研究与审查，不改代码

## 目标

分析任务系统的状态机、领取逻辑、重试机制、Worker 失联回收，确保所有规则明确且可验证。

## 执行内容

### 1. 全局扫描结果

#### 1.1 状态枚举扫描

- **JobStatus**: `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `RETRYING`
- **TaskStatus**: `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `RETRYING`
- **WorkerStatus**: `online`, `idle`, `busy`, `offline`

#### 1.2 状态流转扫描

- **领取逻辑**: `getAndMarkNextPendingJob` (apps/api/src/job/job.service.ts:402)
- **重试逻辑**: `retryJobIfPossible` (apps/api/src/job/job.service.ts:784)
- **Worker 失联**: `markOfflineWorkers` (apps/api/src/worker/worker.service.ts:320)
- **故障恢复**: `recoverJobsFromOfflineWorkers` (apps/api/src/orchestrator/orchestrator.service.ts:100)

#### 1.3 重试机制扫描

- **maxRetry**: 默认值 3（schema.prisma:497）
- **retryCount**: 当前重试次数（schema.prisma:498）
- **判断逻辑**: `nextRetryCount >= job.maxRetry` → FAILED

#### 1.4 Worker 心跳扫描

- **超时阈值**: 30 秒（worker.service.ts:321）
- **心跳接口**: `POST /api/workers/heartbeat` (worker.controller.ts:64)
- **Worker 状态判断**: `determineWorkerState` (worker.service.ts:379)

---

## 2. 状态机规则分析

### 2.1 Job 状态机

#### 状态定义

```typescript
enum JobStatus {
  PENDING    // 待处理
  RUNNING    // 执行中
  SUCCEEDED  // 成功（终态）
  FAILED     // 失败（终态）
  RETRYING   // 重试中（等待 backoff 时间）
}
```

#### 状态流转规则（必须明确）

**规则 1: PENDING → RUNNING**

- **触发条件**: Worker 调用 `getAndMarkNextPendingJob`
- **原子性保证**: 事务 + 条件更新
  ```typescript
  // 条件：status IN [PENDING, RETRYING] AND workerId = null
  await tx.shotJob.updateMany({
    where: {
      id: job.id,
      status: { in: [PENDING, RETRYING] },
      workerId: null,
    },
    data: {
      status: RUNNING,
      workerId: worker.id,
      attempts: job.attempts + 1,
    },
  });
  ```
- **验证方式**: `updated.count === 0` → 竞态失败，返回 null
- **文件位置**: `apps/api/src/job/job.service.ts:466-479`

**规则 2: RUNNING → SUCCEEDED**

- **触发条件**: Worker 调用 `reportJobResult(jobId, 'SUCCEEDED', result)`
- **前置条件**: `job.status === RUNNING`
- **验证方式**: 状态检查（job.service.ts:616）
- **文件位置**: `apps/api/src/job/job.service.ts:620-626`

**规则 3: RUNNING → RETRYING**

- **触发条件**: Worker 调用 `reportJobResult(jobId, 'FAILED', ...)` 且 `retryCount < maxRetry`
- **计算逻辑**: `nextRetryCount = job.retryCount + 1`, `shouldFail = nextRetryCount >= job.maxRetry`
- **Backoff 策略**: `backoffDelayMs = 1000 * Math.pow(2, nextRetryCount - 1)`
- **文件位置**: `apps/api/src/job/job.service.ts:784-876`

**规则 4: RUNNING → FAILED**

- **触发条件**: Worker 调用 `reportJobResult(jobId, 'FAILED', ...)` 且 `retryCount >= maxRetry`
- **判断逻辑**: `shouldFail = nextRetryCount >= job.maxRetry`
- **文件位置**: `apps/api/src/job/job.service.ts:794, 818`

**规则 5: RETRYING → PENDING**

- **触发条件**: Orchestrator 调用 `processRetryJobs()` 且 `nextRetryAt <= now`
- **检查逻辑**: `payload.nextRetryAt <= now` → 放回 PENDING
- **文件位置**: `apps/api/src/orchestrator/orchestrator.service.ts:188-245`

**规则 6: RETRYING → RUNNING**

- **触发条件**: Worker 调用 `getAndMarkNextPendingJob` 且 Job 状态为 RETRYING 且 `nextRetryAt <= now`
- **检查逻辑**: `job.status === RETRYING` → 检查 `payload.nextRetryAt`
- **文件位置**: `apps/api/src/job/job.service.ts:449-461`

#### 状态流转图

```
PENDING → RUNNING → SUCCEEDED (终态)
              ↓
           FAILED (终态，retryCount >= maxRetry)
              ↓
         RETRYING (retryCount < maxRetry)
              ↓
          PENDING (nextRetryAt <= now)
              ↓
          RUNNING (重新领取)
```

#### ⚠️ 发现的问题

**问题 1: 状态流转规则未明确写成常量/枚举**

- **现状**: 状态流转逻辑分散在多个方法中，没有统一的规则定义
- **风险**: 修改代码时可能破坏状态流转规则
- **建议**: 创建状态流转规则常量，明确所有允许的转换

**问题 2: RETRYING 状态的 nextRetryAt 检查存在竞态**

- **现状**: `processRetryJobs()` 和 `getAndMarkNextPendingJob()` 都可能检查 `nextRetryAt`
- **风险**: 两个方法并发执行时可能重复处理
- **建议**: 使用事务 + 条件更新确保原子性

---

## 3. 领取逻辑原子性分析

### 3.1 当前实现

**方法**: `getAndMarkNextPendingJob` (job.service.ts:402)

**原子性保证**:

1. **事务包裹**: `this.prisma.$transaction(async (tx) => { ... })`
2. **条件更新**: `updateMany` 配合条件 `status IN [PENDING, RETRYING] AND workerId = null`
3. **验证更新结果**: `updated.count === 0` → 竞态失败

**代码位置**: `apps/api/src/job/job.service.ts:403-555`

### 3.2 原子性验证

**✅ 已实现**:

- 使用数据库事务确保原子性
- 使用条件更新防止重复领取
- 检查更新影响行数判断竞态

**⚠️ 潜在问题**:

**问题 1: SELECT ... FOR UPDATE 未使用**

- **现状**: 使用 `findFirst` + `updateMany` 组合
- **风险**: 在 `findFirst` 和 `updateMany` 之间，另一个事务可能已经更新了 Job
- **缓解措施**: 条件更新 `workerId = null` 确保只有未分配的 Job 才能被更新
- **验证**: `updated.count === 0` 可以检测到竞态失败

**问题 2: RETRYING Job 的 nextRetryAt 检查不在事务内**

- **现状**: 在事务内检查 `nextRetryAt`，但 `processRetryJobs()` 可能在另一个事务中同时处理
- **风险**: 两个方法可能同时处理同一个 RETRYING Job
- **建议**: 在 `processRetryJobs()` 中也使用条件更新，确保原子性

---

## 4. 重试上限验证

### 4.1 重试上限定义

**Schema 定义**:

```prisma
model ShotJob {
  maxRetry   Int @default(3)  // 最大重试次数
  retryCount Int @default(0)  // 当前重试次数
}
```

**默认值**: 3（schema.prisma:497）

### 4.2 重试上限检查

**检查位置 1**: `retryJobIfPossible` (job.service.ts:794)

```typescript
const nextRetryCount = job.retryCount + 1;
const shouldFail = nextRetryCount >= job.maxRetry;
```

**检查位置 2**: `recoverJobsFromOfflineWorkers` (orchestrator.service.ts:148)

- 调用 `markJobFailedAndMaybeRetry`，内部会检查 `maxRetry`

**检查位置 3**: `processJob` (job.service.ts:942)

```typescript
if (job.attempts >= job.maxRetry) {
  await this.prisma.shotJob.update({
    where: { id: jobId },
    data: { status: JobStatusEnum.FAILED, lastError: 'Max retry reached' },
  });
}
```

### 4.3 重试上限验证

**✅ 已实现**:

- `maxRetry` 字段在 schema 中定义
- 多个位置都检查 `retryCount >= maxRetry`
- 达到上限时标记为 FAILED

**⚠️ 发现的问题**:

**问题 1: attempts 和 retryCount 混用**

- **现状**: 有些地方用 `attempts >= maxRetry`，有些地方用 `retryCount >= maxRetry`
- **风险**: 两个字段可能不一致
- **建议**: 统一使用 `retryCount >= maxRetry`（因为 `retryCount` 是专门用于重试计数的）

**问题 2: 重试上限检查未明确写成规则**

- **现状**: 检查逻辑分散在多个方法中
- **风险**: 修改代码时可能遗漏检查
- **建议**: 创建统一的重试上限检查函数

---

## 5. Worker 失联回收路径分析

### 5.1 Worker 心跳超时检测

**方法**: `markOfflineWorkers` (worker.service.ts:320)

**超时阈值**: 30 秒

```typescript
const timeoutThreshold = new Date(Date.now() - 30 * 1000);
```

**检测逻辑**:

```typescript
await this.prisma.workerNode.updateMany({
  where: {
    lastHeartbeat: { lt: timeoutThreshold },
    status: { not: WorkerStatus.offline },
  },
  data: {
    status: WorkerStatus.offline,
  },
});
```

**文件位置**: `apps/api/src/worker/worker.service.ts:320-370`

### 5.2 Worker 失联 Job 恢复

**方法**: `recoverJobsFromOfflineWorkers` (orchestrator.service.ts:100)

**恢复逻辑**:

1. 查找所有 `status = 'offline'` 的 Worker
2. 查找这些 Worker 的 `status = RUNNING` 的 Job
3. 对每个 Job 调用 `markJobFailedAndMaybeRetry`
4. 如果 `retryCount < maxRetry` → 进入重试队列
5. 如果 `retryCount >= maxRetry` → 标记为 FAILED

**文件位置**: `apps/api/src/orchestrator/orchestrator.service.ts:100-179`

### 5.3 Worker 失联回收验证

**✅ 已实现**:

- Worker 心跳超时检测（30 秒）
- 自动标记 offline Worker
- 自动恢复 offline Worker 的 RUNNING Job
- 恢复时调用统一的重试逻辑

**⚠️ 发现的问题**:

**问题 1: 心跳超时阈值硬编码**

- **现状**: 30 秒硬编码在代码中
- **风险**: 无法根据环境调整
- **建议**: 使用环境变量或配置

**问题 2: Worker 失联回收未明确写成规则**

- **现状**: 回收逻辑在 `recoverJobsFromOfflineWorkers` 中，但调用时机不明确
- **风险**: 可能在某些情况下未触发回收
- **建议**: 明确回收触发时机（例如：在 `dispatchJobs()` 中定期执行）

**问题 3: 回收逻辑未验证 Worker 是否真的离线**

- **现状**: 只检查 `status = 'offline'`，不检查 `lastHeartbeat`
- **风险**: 如果 Worker 刚被标记为 offline，但实际还在运行，可能导致重复处理
- **建议**: 在恢复时再次检查 `lastHeartbeat`，确保 Worker 真的离线

---

## 6. 规则型正确性验证

### 6.1 状态机规则

**❌ 未明确写成规则**:

- 状态流转规则分散在多个方法中
- 没有统一的状态流转规则定义
- 修改代码时可能破坏状态流转规则

**建议**:

1. 创建状态流转规则常量
2. 所有状态转换都通过规则验证
3. 禁止直接修改状态，必须通过规则验证

### 6.2 领取逻辑原子性

**✅ 已实现原子性**:

- 使用事务 + 条件更新
- 检查更新影响行数判断竞态

**⚠️ 可改进**:

- 使用 `SELECT ... FOR UPDATE` 更明确
- RETRYING Job 的 `nextRetryAt` 检查需要原子性保证

### 6.3 重试上限

**✅ 已实现上限检查**:

- `maxRetry` 字段在 schema 中定义
- 多个位置都检查 `retryCount >= maxRetry`

**⚠️ 可改进**:

- 统一使用 `retryCount`（不要混用 `attempts`）
- 创建统一的重试上限检查函数

### 6.4 Worker 失联回收

**✅ 已实现回收路径**:

- Worker 心跳超时检测
- 自动恢复 offline Worker 的 RUNNING Job

**⚠️ 可改进**:

- 明确回收触发时机
- 回收时再次验证 Worker 是否真的离线

---

## 7. 结论与建议

### 7.1 必须满足的判定标准

#### ✅ 状态机被明确写成规则

- **现状**: ❌ 未明确写成规则
- **问题**: 状态流转规则分散在多个方法中
- **建议**: 创建状态流转规则常量，所有状态转换都通过规则验证

#### ✅ 领取逻辑被证明是原子性的

- **现状**: ✅ 已实现原子性（事务 + 条件更新）
- **验证**: `updated.count === 0` 可以检测到竞态失败
- **建议**: 使用 `SELECT ... FOR UPDATE` 更明确

#### ✅ Retry 上限被证明存在

- **现状**: ✅ 已实现上限检查
- **验证**: `retryCount >= maxRetry` → FAILED
- **建议**: 统一使用 `retryCount`（不要混用 `attempts`）

#### ✅ Worker 失联回收路径明确

- **现状**: ✅ 已实现回收路径
- **验证**: `markOfflineWorkers` + `recoverJobsFromOfflineWorkers`
- **建议**: 明确回收触发时机，回收时再次验证 Worker 是否真的离线

#### ❌ 没有"解释型正确"，只有规则型正确

- **现状**: ❌ 部分逻辑是"解释型正确"（通过注释说明，但未写成规则）
- **问题**: 状态流转规则、重试上限检查、Worker 失联回收都未明确写成规则
- **建议**: 创建规则常量/函数，所有逻辑都通过规则验证

### 7.2 下一步行动

**必须修复项**:

1. **状态机规则**: 创建状态流转规则常量，明确所有允许的转换
2. **重试上限检查**: 统一使用 `retryCount`，创建统一的重试上限检查函数
3. **Worker 失联回收**: 明确回收触发时机，回收时再次验证 Worker 是否真的离线

**建议改进项**:

1. 使用 `SELECT ... FOR UPDATE` 更明确地实现原子性
2. RETRYING Job 的 `nextRetryAt` 检查需要原子性保证
3. 心跳超时阈值使用环境变量或配置

---

**分析完成时间**: 2025-12-13
**分析人**: Cursor AI (RESEARCH 模式)
**结论**: 功能已实现，但规则未明确写成常量/函数，需要改进
