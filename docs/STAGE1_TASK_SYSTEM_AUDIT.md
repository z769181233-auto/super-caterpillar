# Stage1 任务体系字段审计

**生成时间**: 2025-12-11  
**审计范围**: Task / WorkerJob / ShotJob / EngineTask  
**审计模式**: 只读审计，不修改 Schema

---

## 摘要

本文档针对任务体系的 4 个核心模型进行字段级审计，识别与 DBSpec V1.1 规范和 TaskSystemAsyncExecutionSpec 的差异，分析修复必要性和冗余/缺失字段。

---

## 1. Task 模型审计

### 1.1 字段对比

| 字段名         | 文档规范      | 当前 Prisma                  | 差异                       | 修复必要性             |
| -------------- | ------------- | ---------------------------- | -------------------------- | ---------------------- |
| id             | String (UUID) | String @id @default(uuid())  | ✅ 符合                    | 保持                   |
| organizationId | String        | String                       | ⚠️ 规范未提及              | P2（Studio v0.8 扩展） |
| projectId      | String        | String                       | ⚠️ 规范未提及              | P2（Studio v0.8 扩展） |
| type           | Enum          | TaskType                     | ✅ 符合                    | 保持                   |
| status         | Enum          | TaskStatus @default(PENDING) | ✅ 符合                    | 保持                   |
| payload        | Json?         | Json?                        | ⚠️ 规范为 `input(json)`    | P2（功能等价）         |
| -              | -             | -                            | ⚠️ 规范要求 `output(json)` | **P1（缺失字段）**     |
| attempts       | Int           | Int @default(0)              | ⚠️ 规范为 `retries`        | **P1（字段名不一致）** |
| maxRetry       | Int           | Int @default(3)              | ⚠️ 规范未提及              | P2（扩展）             |
| retryCount     | Int           | Int @default(0)              | ⚠️ 规范未提及              | P2（扩展）             |
| error          | String?       | String?                      | ⚠️ 规范未提及              | P2（扩展）             |
| createdAt      | DateTime      | DateTime @default(now())     | ✅ 符合                    | 保持                   |
| updatedAt      | DateTime      | DateTime @updatedAt          | ⚠️ 规范未提及              | P2（扩展）             |
| workerId       | String?       | -                            | ⚠️ 规范要求 `worker_id`    | **P1（缺失字段）**     |

### 1.2 关系检查

- ✅ `jobs` → ShotJob[]（一对多，Task → Job 关系正确）
- ✅ `project` → Project（多对一，必填）
- ✅ `organization` → Organization（多对一，必填）

**关系正确性**: ✅ Task 与 Job 之间关系正确（一个 Task 可以产生多个 Job，用于重试）

### 1.3 索引检查

- ✅ `@@index([status, createdAt])`（符合规范 `tasks(status, created_at)`）

### 1.4 差异分析

**P1 级差异（必须修复）**:

1. **缺失 `output` 字段**: 规范要求 `output(json)`，当前实现只有 `payload`（对应 `input`）
2. **缺失 `workerId` 字段**: 规范要求 `worker_id`，当前实现无此字段
3. **字段名不一致**: `attempts` vs 规范 `retries`

**P2 级差异（可选修复）**:

- `organizationId`, `projectId`: Studio v0.8 扩展字段
- `maxRetry`, `retryCount`, `error`: 扩展字段，不影响核心功能
- `payload` vs `input`: 功能等价，但命名不一致

### 1.5 冗余字段分析

**无冗余字段**，所有字段均有用途。

### 1.6 缺失字段分析

**缺失字段**:

1. `output` (Json?): 规范要求，用于存储任务输出结果
2. `workerId` (String?): 规范要求，用于关联执行任务的 Worker

---

## 2. WorkerJob 模型审计

### 2.1 字段对比

| 字段名        | 文档规范      | 当前 Prisma                       | 差异          | 修复必要性         |
| ------------- | ------------- | --------------------------------- | ------------- | ------------------ |
| id            | String (UUID) | String @id @default(uuid())       | ✅ 符合       | 保持               |
| type          | Enum          | WorkerJobType                     | ✅ 符合       | 保持               |
| payload       | Json          | Json                              | ✅ 符合       | 保持               |
| status        | Enum          | WorkerJobStatus @default(pending) | ✅ 符合       | 保持               |
| workerId      | String?       | String?                           | ✅ 符合       | 保持               |
| retryCount    | Int           | Int @default(0)                   | ⚠️ 规范未提及 | P2（扩展）         |
| traceId       | String        | String                            | ⚠️ 规范未提及 | P2（扩展）         |
| jobId         | String        | String @unique                    | ⚠️ 规范未提及 | P2（扩展，BullMQ） |
| engineVersion | String?       | String?                           | ⚠️ 规范未提及 | P2（扩展）         |
| modelVersion  | String?       | String?                           | ⚠️ 规范未提及 | P2（扩展）         |
| createdAt     | DateTime      | DateTime @default(now())          | ✅ 符合       | 保持               |
| updatedAt     | DateTime      | DateTime @updatedAt               | ⚠️ 规范未提及 | P2（扩展）         |

### 2.2 关系检查

- ✅ `worker` → WorkerNode?（多对一，可选）
- ✅ `billingEvents` → BillingEvent[]（一对多）

**关系正确性**: ✅ WorkerJob 与 Worker 关系正确

### 2.3 索引检查

- ⚠️ 规范未明确要求索引

### 2.4 差异分析

**无 P0/P1 级差异**，所有字段符合规范或为合理扩展。

**P2 级差异**:

- `retryCount`, `traceId`, `jobId`, `engineVersion`, `modelVersion`, `updatedAt`: 扩展字段，不影响核心功能

### 2.5 冗余字段分析

**无冗余字段**，所有字段均有用途。

### 2.6 缺失字段分析

**无缺失字段**，WorkerJob 模型符合规范。

---

## 3. ShotJob 模型审计

### 3.1 字段对比

| 字段名         | 文档规范      | 当前 Prisma                 | 差异          | 修复必要性             |
| -------------- | ------------- | --------------------------- | ------------- | ---------------------- |
| id             | String (UUID) | String @id @default(uuid()) | ✅ 符合       | 保持                   |
| organizationId | String        | String                      | ⚠️ 规范未提及 | P2（Studio v0.7 扩展） |
| projectId      | String        | String                      | ⚠️ 规范未提及 | P2（扩展）             |
| episodeId      | String        | String                      | ⚠️ 规范未提及 | P2（扩展）             |
| sceneId        | String        | String                      | ⚠️ 规范未提及 | P2（扩展）             |
| shotId         | String        | String                      | ⚠️ 规范未提及 | P2（扩展）             |
| taskId         | String?       | String?                     | ⚠️ 规范未提及 | P2（Studio v0.8 扩展） |
| workerId       | String?       | String?                     | ⚠️ 规范未提及 | P2（扩展）             |
| status         | Enum          | JobStatus @default(PENDING) | ✅ 符合       | 保持                   |
| type           | Enum          | JobType                     | ✅ 符合       | 保持                   |
| priority       | Int           | Int @default(0)             | ⚠️ 规范未提及 | P2（扩展）             |
| maxRetry       | Int           | Int @default(3)             | ⚠️ 规范未提及 | P2（扩展）             |
| retryCount     | Int           | Int @default(0)             | ⚠️ 规范未提及 | P2（扩展）             |
| attempts       | Int           | Int @default(0)             | ⚠️ 规范未提及 | P2（扩展）             |
| payload        | Json?         | Json?                       | ✅ 符合       | 保持                   |
| engineConfig   | Json?         | Json?                       | ⚠️ 规范未提及 | P2（扩展）             |
| lastError      | String?       | String?                     | ⚠️ 规范未提及 | P2（扩展）             |
| createdAt      | DateTime      | DateTime @default(now())    | ✅ 符合       | 保持                   |
| updatedAt      | DateTime      | DateTime @updatedAt         | ⚠️ 规范未提及 | P2（扩展）             |

### 3.2 关系检查

- ✅ `shot` → Shot（多对一，必填）
- ✅ `task` → Task?（多对一，可选，Task → Job 关系正确）
- ✅ `worker` → WorkerNode?（多对一，可选）
- ✅ `project` → Project（多对一，必填）
- ✅ `episode` → Episode（多对一，必填）
- ✅ `scene` → Scene（多对一，必填）
- ✅ `organization` → Organization（多对一，必填）

**关系正确性**: ✅ ShotJob 与 Task 之间关系正确（Job 属于某个 Task，一个 Task 可以产生多个 Job）

### 3.3 索引检查

- ⚠️ 规范未明确要求索引

### 3.4 差异分析

**无 P0/P1 级差异**，所有字段符合规范或为合理扩展。

**P2 级差异**:

- 大部分字段为扩展字段（organizationId, projectId, episodeId, sceneId, shotId, taskId, workerId, priority, maxRetry, retryCount, attempts, engineConfig, lastError, updatedAt），不影响核心功能

### 3.5 冗余字段分析

**无冗余字段**，所有字段均有用途。

### 3.6 缺失字段分析

**无缺失字段**，ShotJob 模型符合规范。

---

## 4. EngineTask 模型审计

### 4.1 字段对比

| 字段名        | 文档规范      | 当前 Prisma                        | 差异          | 修复必要性 |
| ------------- | ------------- | ---------------------------------- | ------------- | ---------- |
| id            | String (UUID) | String @id @default(uuid())        | ✅ 符合       | 保持       |
| type          | Enum          | EngineTaskType                     | ✅ 符合       | 保持       |
| projectId     | String        | String                             | ✅ 符合       | 保持       |
| sceneId       | String?       | String?                            | ✅ 符合       | 保持       |
| shotId        | String?       | String?                            | ✅ 符合       | 保持       |
| input         | Json          | Json                               | ✅ 符合       | 保持       |
| output        | Json?         | Json?                              | ✅ 符合       | 保持       |
| engineVersion | String        | String                             | ⚠️ 规范未提及 | P2（扩展） |
| status        | Enum          | EngineTaskStatus @default(pending) | ✅ 符合       | 保持       |
| createdAt     | DateTime      | DateTime @default(now())           | ✅ 符合       | 保持       |
| updatedAt     | DateTime      | DateTime @updatedAt                | ⚠️ 规范未提及 | P2（扩展） |

### 4.2 关系检查

- ✅ `project` → Project（多对一，必填）
- ✅ `scene` → Scene?（多对一，可选）
- ✅ `shot` → Shot?（多对一，可选）

**关系正确性**: ✅ EngineTask 关系正确

### 4.3 索引检查

- ⚠️ 规范未明确要求索引

### 4.4 差异分析

**无 P0/P1 级差异**，所有字段符合规范或为合理扩展。

**P2 级差异**:

- `engineVersion`, `updatedAt`: 扩展字段，不影响核心功能

### 4.5 冗余字段分析

**无冗余字段**，所有字段均有用途。

### 4.6 缺失字段分析

**无缺失字段**，EngineTask 模型符合规范。

---

## 总结

### 字段差异统计

| 模型       | P0    | P1    | P2     | 保持   | 总计   |
| ---------- | ----- | ----- | ------ | ------ | ------ |
| Task       | 0     | 3     | 6      | 4      | 13     |
| WorkerJob  | 0     | 0     | 6      | 5      | 11     |
| ShotJob    | 0     | 0     | 15     | 4      | 19     |
| EngineTask | 0     | 0     | 2      | 8      | 10     |
| **总计**   | **0** | **3** | **29** | **21** | **53** |

### 关系差异统计

- **符合规范**: 100%（所有关系定义正确）
- **Task → Job 关系**: ✅ 正确（一个 Task 可以产生多个 Job，用于重试）

### 索引差异统计

- **符合规范**: 100%（Task 模型索引符合规范 `tasks(status, created_at)`）

### P1 级修复项清单

1. **Task 缺失 `output` 字段**: 规范要求 `output(json)`，用于存储任务输出结果
2. **Task 缺失 `workerId` 字段**: 规范要求 `worker_id`，用于关联执行任务的 Worker
3. **Task.attempts vs 规范 retries**: 字段名不一致，建议统一为 `retries`

### 冗余字段分析

**无冗余字段**，所有字段均有用途。

### 缺失字段分析

**缺失字段**:

1. `Task.output` (Json?): 规范要求，用于存储任务输出结果
2. `Task.workerId` (String?): 规范要求，用于关联执行任务的 Worker

---

## 修复建议

### Task 模型修复建议

1. **添加 `output` 字段**:

   ```prisma
   output Json? // 任务输出结果
   ```

2. **添加 `workerId` 字段**:

   ```prisma
   workerId String?
   worker   WorkerNode? @relation("TaskWorker", fields: [workerId], references: [id])
   ```

3. **重命名 `attempts` 为 `retries`**（可选，影响较大）:
   ```prisma
   retries Int @default(0) // 重试次数
   ```

### 迁移风险分析

**Task 模型修复迁移风险**:

- **低风险**: 添加 `output` 和 `workerId` 字段（可选字段，不影响现有数据）
- **中风险**: 重命名 `attempts` 为 `retries`（需要数据迁移和代码更新）

**建议**:

- 优先修复 `output` 和 `workerId` 字段（P1）
- `attempts` vs `retries` 重命名可延后处理（P2）

---

**文档状态**: ✅ 审计完成，待下一批次修复
