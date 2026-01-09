# 任务系统"0雷区"修复计划（最小变更集）

## 模式声明

**MODE: PLAN** - 只允许"最小变更集"

## 一、修复目标

在"已验收基线"上做 0雷区审计修复，但变更范围只允许以下文件：

## 二、允许修改的文件清单

### 2.1 核心规则文件（已存在，可能需微调）

1. ✅ `apps/api/src/job/job.rules.ts` - 状态机规则（已存在）
2. ✅ `apps/api/src/job/job.retry.ts` - 重试规则（已存在）

### 2.2 任务系统服务文件

3. ✅ `apps/api/src/job/job.service.ts` - Job 服务
4. ✅ `apps/api/src/orchestrator/orchestrator.service.ts` - 调度器服务
5. ✅ `apps/api/src/worker/worker.service.ts` - Worker 服务
6. ✅ `apps/api/src/job/job-worker.service.ts` - Job Worker 服务

### 2.3 配置文件

7. ✅ `packages/config/src/env.ts` - 环境变量配置（已包含 `workerHeartbeatTimeoutMs`）

### 2.4 文档文件

8. ✅ `docs/_risk/TASK_SYSTEM_ZERO_RISK_ACCEPTANCE.md` - 验收报告

## 三、禁止项（硬约束）

### 3.1 禁止新增

- ❌ 禁止新增任何业务模块/Controller/Module（包括 health 模块）
- ❌ 禁止新增任何 API 端点

### 3.2 禁止修改

- ❌ 禁止改 DB schema
- ❌ 禁止改接口契约
- ❌ 禁止修改非任务系统目录（auth/audit/engine 等）

### 3.3 禁止优化

- ❌ 禁止"顺手优化"
- ❌ 禁止重构

## 四、修复内容（最小集）

### 4.1 状态转换验证（P0）

**目标**: 确保所有状态转换都经过 `assertTransition` 验证

**修复点**:

1. `apps/api/src/orchestrator/orchestrator.service.ts:processRetryJobs`
   - 在 `updateMany` 前添加 `assertTransition(RETRYING -> PENDING)` 验证

2. `apps/api/src/worker/worker.service.ts:startJob`
   - 在更新状态前添加 `assertTransition(PENDING -> RUNNING)` 验证

### 4.2 硬编码 timeout 修复（P0）

**目标**: 所有 heartbeat timeout 使用环境变量

**修复点**:

1. `apps/api/src/worker/worker.service.ts:isWorkerOnline`
   - 将 `30 * 1000` 改为 `env.workerHeartbeatTimeoutMs`

2. `apps/api/src/worker/worker.service.ts:determineWorkerState`
   - 将 `30 * 1000` 改为 `env.workerHeartbeatTimeoutMs`

3. `apps/api/src/worker/worker.service.ts:getWorkerMonitorSnapshot`
   - 将 `TIMEOUT = 30000` 改为 `env.workerHeartbeatTimeoutMs`

**注意**: `packages/config/src/env.ts` 已包含 `workerHeartbeatTimeoutMs`，无需修改

### 4.3 审计日志补齐（P2）

**目标**: 关键操作记录审计日志

**修复点**:

1. `apps/api/src/orchestrator/orchestrator.service.ts:processRetryJobs`
   - 在批量更新后，对每个释放的 Job 记录审计日志

2. `apps/api/src/orchestrator/orchestrator.service.ts:recoverJobsFromOfflineWorkers`
   - 在恢复 Job 时记录审计日志（已有结构化日志，补充审计）

### 4.4 可观测性字段补齐（P1）

**目标**: 在任务系统相关日志/审计中补齐 `spanId`, `modelUsed`

**修复点**:

1. `apps/api/src/job/job.service.ts:reportJobResult`
   - 添加 `spanId`（使用 `traceId`）和 `modelUsed` 到审计日志

2. `apps/api/src/job/job.service.ts:retryJobIfPossible`
   - 添加 `spanId` 和 `modelUsed` 到日志和审计
   - 添加 `duration` 注释说明口径

## 五、验证方式

### 5.1 静态验证

```bash
# 类型检查
pnpm -w --filter api build

# 语法检查
pnpm -w lint

# 变更范围检查
git diff --name-only | sort
# 必须只包含 PLAN 列出的 8 个文件
```

### 5.2 规则验证

```bash
# 检查所有状态更新是否调用 assertTransition
rg -n "status.*=.*(PENDING|RUNNING|SUCCEEDED|FAILED|RETRYING)" apps/api/src/job apps/api/src/orchestrator apps/api/src/worker | grep -v "assertTransition\|JobStatus\|JobStatusEnum"
# 必须无结果（除规则文件外）
```

### 5.3 硬编码检查

```bash
# 检查是否仍有硬编码 timeout
rg -n "30\s*\*\s*1000|30000" apps/api/src/worker/worker.service.ts
# 必须无结果（除 env.ts 默认值外）
```

## 六、回滚策略

如果验证失败：

```bash
git reset --hard HEAD  # 如果未提交
git revert <commit-hash>  # 如果已提交
```

## 七、本模式产出物

1. ✅ `docs/_risk/TASK_SYSTEM_ZERO_RISK_PLAN.md`（本文档）
2. ✅ 允许修改的文件清单（8 个文件）
3. ✅ 修复内容详细说明
4. ✅ 验证方式清单

---

## 八、下一步

进入 **EXECUTE** 模式，严格按照 PLAN 执行修复。
