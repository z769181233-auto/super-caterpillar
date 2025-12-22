# Novel Analysis 审计日志与可观测性修复计划

**计划时间**: 2024-12-19  
**目标**: 修复验证报告 V2 中的 P1/P2 问题  
**模式**: PLAN

---

## 一、任务目标

### P1（最高优先）——补齐审计日志（Audit Log）
为以下接口新增符合规范的审计记录：
- `/api/projects/:projectId/novel/import-file`
- `/api/projects/:projectId/novel/import`
- `/api/projects/:projectId/novel/analyze`

### P2（次优先）——补齐可观测性（Observability）埋点
为 Novel Analysis 链路补齐结构化日志：
- 解析开始
- 解析结束
- 解析耗时
- 生成数量统计
- 失败原因（如有）

---

## 二、引用的规范文档

### 2.1 审计日志规范

**参考文档**：
- `docs/AUDIT_LOG_IMPLEMENTATION.md`（如存在）
- `apps/api/src/audit-log/audit-log.service.ts`（现有实现）
- `packages/database/prisma/schema.prisma`（AuditLog 模型）

**规范要点**：
- AuditLog 模型字段：`userId`, `apiKeyId`, `action`, `resourceType`, `resourceId`, `ip`, `userAgent`, `details`, `createdAt`
- `details` 字段为 JSON 类型，用于存储附加信息
- 审计日志写入失败不得影响主业务流程（已有 try-catch 保护）

### 2.2 可观测性规范

**参考文档**：
- 现有实现：`apps/api/src/job/job.service.ts`（使用 Logger）
- Worker 现有日志：`apps/workers/src/main.ts`（使用 console.log）

**规范要点**：
- 使用结构化日志（JSON 格式）
- 记录关键操作的时间点和耗时
- 记录操作结果和统计信息

---

## 三、文件修改清单

### 3.1 P1 - 审计日志修改

#### 文件 1: `apps/api/src/novel-import/novel-import.controller.ts`

**修改点**：
1. **导入 AuditLogService**（在文件顶部 import 区域）
   - 添加：`import { AuditLogService } from '../audit-log/audit-log.service';`

2. **注入 AuditLogService**（在 constructor 中）
   - 添加：`private readonly auditLogService: AuditLogService,`
   - 位置：在现有依赖注入之后

3. **importNovelFile 方法**（约第 86-237 行）
   - 在 `novelSource` 创建成功后，添加审计日志记录
   - 位置：在 `novelSource` 创建和章节保存完成后，返回响应之前
   - 记录内容：
     - `action`: `'NOVEL_IMPORT_FILE'`
     - `resourceType`: `'novel_source'`
     - `resourceId`: `novelSource.id`
     - `userId`: `user.userId`
     - `ip`: 从 `request` 对象提取（使用 `AuditLogService.extractRequestInfo`）
     - `userAgent`: 从 `request` 对象提取
     - `details`: JSON 对象，包含：
       - `projectId`: `projectId`
       - `fileName`: `file.originalname`
       - `fileSize`: `file.size`
       - `fileType`: `fileExt`
       - `characterCount`: `parsed.characterCount`
       - `chapterCount`: `parsed.chapterCount`
       - `novelTitle`: `novelTitle`
       - `novelAuthor`: `novelAuthor`

4. **importNovel 方法**（约第 241-335 行）
   - 在 `novelSource` 创建成功后，添加审计日志记录
   - 位置：在 `novelSource` 创建和章节保存完成后，返回响应之前
   - 记录内容：
     - `action`: `'NOVEL_IMPORT'`
     - `resourceType`: `'novel_source'`
     - `resourceId`: `novelSource.id`
     - `userId`: `user.userId`
     - `ip`: 从 `request` 对象提取
     - `userAgent`: 从 `request` 对象提取
     - `details`: JSON 对象，包含：
       - `projectId`: `projectId`
       - `novelTitle`: `importNovelDto.title`
       - `characterCount`: `rawText.length`
       - `chapterCount`: `savedChapters.length`
       - `importMode`: `'text'`（文本导入模式）

5. **analyzeNovel 方法**（约第 375-500 行）
   - 在 `analysisJob` 创建成功后，添加审计日志记录
   - 位置：在 `analysisJob` 创建和 Job 创建完成后，返回响应之前
   - 记录内容：
     - `action`: `'NOVEL_ANALYZE'`
     - `resourceType`: `'novel_analysis_job'`
     - `resourceId`: `analysisJob.id`
     - `userId`: `user.userId`
     - `ip`: 从 `request` 对象提取
     - `userAgent`: 从 `request` 对象提取
     - `details`: JSON 对象，包含：
       - `projectId`: `projectId`
       - `novelSourceId`: `novelSource.id`
       - `jobType`: `analysisJob.jobType`（'ANALYZE_ALL' 或 'ANALYZE_CHAPTER'）
       - `chapterId`: `body.chapterId`（如果存在）
       - `jobId`: `job.id`（如果创建了 Job）
       - `taskId`: `task.id`（如果创建了 Task）

#### 文件 2: `apps/api/src/novel-import/novel-import.module.ts`

**修改点**：
1. **导入 AuditLogModule**（如果尚未导入）
   - 检查是否已导入 `AuditLogModule`
   - 如果未导入，添加：`import { AuditLogModule } from '../audit-log/audit-log.module';`

2. **在 imports 数组中添加 AuditLogModule**（如果尚未添加）
   - 确保 `AuditLogModule` 在 `imports` 数组中

**验证方式**：
- 检查 `NovelImportModule` 是否正确导入 `AuditLogModule`
- 确保 `AuditLogService` 可以被注入到 `NovelImportController`

---

### 3.2 P2 - 可观测性埋点修改

#### 文件 1: `apps/workers/src/novel-analysis-processor.ts`

**修改点**：
1. **导入 Logger**（在文件顶部）
   - 添加：`import { Logger } from '@nestjs/common';`（如果 Worker 使用 NestJS Logger）
   - 或：创建自定义 Logger 实例（如果 Worker 不使用 NestJS）

2. **创建 Logger 实例**（在文件顶部，函数定义之前）
   - 添加：`const logger = new Logger('NovelAnalysisProcessor');`（如果使用 NestJS Logger）
   - 或：使用自定义 Logger（如 `console` 包装为结构化日志）

3. **processNovelAnalysisJob 函数**（约第 332-386 行）
   - **解析开始日志**（在函数开始处，读取 rawText 之后）
     - 记录：`action: 'NOVEL_ANALYSIS_START'`
     - 记录：`projectId`, `novelSourceId`, `rawTextLength`
     - 记录：`timestamp: new Date().toISOString()`
   
   - **解析结束日志**（在 `basicTextSegmentation` 调用之后）
     - 记录：`action: 'NOVEL_ANALYSIS_PARSED'`
     - 记录：`stats: structure.stats`（包含 seasonsCount, episodesCount, scenesCount, shotsCount）
     - 记录：`parsingDurationMs: Date.now() - startTime`
   
   - **写库开始日志**（在事务开始之前）
     - 记录：`action: 'NOVEL_ANALYSIS_WRITE_START'`
     - 记录：`stats: structure.stats`
   
   - **写库结束日志**（在事务提交之后）
     - 记录：`action: 'NOVEL_ANALYSIS_WRITE_COMPLETE'`
     - 记录：`writeDurationMs: Date.now() - writeStartTime`
     - 记录：`totalDurationMs: Date.now() - startTime`
   
   - **失败日志**（在 catch 块中，如果有错误处理）
     - 记录：`action: 'NOVEL_ANALYSIS_FAILED'`
     - 记录：`error: error.message`
     - 记录：`errorStack: error.stack`
     - 记录：`durationMs: Date.now() - startTime`

4. **basicTextSegmentation 函数**（约第 16-254 行）
   - **可选**：在函数内部记录分段过程的详细信息（如果需要在调试时查看）
   - 记录：每个 Season/Episode/Scene/Shot 的创建过程（可选，仅在开发环境）

**日志格式**（结构化 JSON）：
```typescript
logger.log(JSON.stringify({
  level: 'info',
  action: 'NOVEL_ANALYSIS_START',
  timestamp: new Date().toISOString(),
  projectId: projectId,
  novelSourceId: novelSource?.id,
  rawTextLength: rawText.length,
}));
```

#### 文件 2: `apps/workers/src/main.ts`

**修改点**：
1. **导入 Logger**（如果尚未导入）
   - 检查是否已有 Logger 导入
   - 如果没有，添加 Logger 导入

2. **processJob 函数**（约第 102-159 行）
   - **Job 开始处理日志**（替换现有的 console.log）
     - 使用结构化日志记录：`action: 'JOB_PROCESSING_START'`
     - 记录：`jobId`, `jobType`, `projectId`
   
   - **Job 成功日志**（替换现有的 console.log）
     - 使用结构化日志记录：`action: 'JOB_PROCESSING_SUCCESS'`
     - 记录：`jobId`, `jobType`, `result`, `durationMs`
   
   - **Job 失败日志**（替换现有的 console.error）
     - 使用结构化日志记录：`action: 'JOB_PROCESSING_FAILED'`
     - 记录：`jobId`, `jobType`, `error`, `errorStack`, `durationMs`

**日志格式**（结构化 JSON）：
```typescript
logger.log(JSON.stringify({
  level: 'info',
  action: 'JOB_PROCESSING_START',
  timestamp: new Date().toISOString(),
  jobId: job.id,
  jobType: job.type,
  projectId: job.payload?.projectId,
}));
```

---

## 四、新增的审计事件类型列表

### 4.1 审计事件类型（action_type）

以下事件类型将在本次修复中新增：

1. **`NOVEL_IMPORT_FILE`**
   - **描述**: 用户上传小说文件
   - **触发位置**: `importNovelFile` 方法
   - **resource_type**: `novel_source`
   - **resource_id**: `novelSource.id`

2. **`NOVEL_IMPORT`**
   - **描述**: 用户导入小说文本（文本导入模式）
   - **触发位置**: `importNovel` 方法
   - **resource_type**: `novel_source`
   - **resource_id**: `novelSource.id`

3. **`NOVEL_ANALYZE`**
   - **描述**: 用户触发小说分析
   - **触发位置**: `analyzeNovel` 方法
   - **resource_type**: `novel_analysis_job`
   - **resource_id**: `analysisJob.id`

### 4.2 现有审计事件类型（参考）

以下事件类型已存在，作为参考：
- `JOB_CREATED` - Job 创建
- `JOB_SUCCEEDED` - Job 成功完成
- `JOB_FAILED` - Job 失败

---

## 五、新增的日志埋点列表

### 5.1 Worker 侧日志埋点

以下日志埋点将在本次修复中新增：

1. **`NOVEL_ANALYSIS_START`**
   - **描述**: 开始解析小说文本
   - **触发位置**: `processNovelAnalysisJob` 函数开始处
   - **记录字段**:
     - `projectId`: 项目 ID
     - `novelSourceId`: 小说源 ID
     - `rawTextLength`: 原始文本长度
     - `timestamp`: 开始时间

2. **`NOVEL_ANALYSIS_PARSED`**
   - **描述**: 解析完成，生成结构树
   - **触发位置**: `basicTextSegmentation` 调用之后
   - **记录字段**:
     - `stats`: 统计信息（seasonsCount, episodesCount, scenesCount, shotsCount）
     - `parsingDurationMs`: 解析耗时（毫秒）
     - `timestamp`: 完成时间

3. **`NOVEL_ANALYSIS_WRITE_START`**
   - **描述**: 开始写入数据库
   - **触发位置**: 事务开始之前
   - **记录字段**:
     - `stats`: 统计信息
     - `timestamp`: 开始时间

4. **`NOVEL_ANALYSIS_WRITE_COMPLETE`**
   - **描述**: 数据库写入完成
   - **触发位置**: 事务提交之后
   - **记录字段**:
     - `writeDurationMs`: 写库耗时（毫秒）
     - `totalDurationMs`: 总耗时（毫秒）
     - `timestamp`: 完成时间

5. **`NOVEL_ANALYSIS_FAILED`**
   - **描述**: 解析或写库失败
   - **触发位置**: catch 块中
   - **记录字段**:
     - `error`: 错误消息
     - `errorStack`: 错误堆栈
     - `durationMs`: 失败前耗时（毫秒）
     - `timestamp`: 失败时间

6. **`JOB_PROCESSING_START`**
   - **描述**: Worker 开始处理 Job
   - **触发位置**: `processJob` 函数开始处
   - **记录字段**:
     - `jobId`: Job ID
     - `jobType`: Job 类型
     - `projectId`: 项目 ID
     - `timestamp`: 开始时间

7. **`JOB_PROCESSING_SUCCESS`**
   - **描述**: Worker 成功处理 Job
   - **触发位置**: Job 处理成功后
   - **记录字段**:
     - `jobId`: Job ID
     - `jobType`: Job 类型
     - `result`: 处理结果
     - `durationMs`: 处理耗时（毫秒）
     - `timestamp`: 完成时间

8. **`JOB_PROCESSING_FAILED`**
   - **描述**: Worker 处理 Job 失败
   - **触发位置**: catch 块中
   - **记录字段**:
     - `jobId`: Job ID
     - `jobType`: Job 类型
     - `error`: 错误消息
     - `errorStack`: 错误堆栈
     - `durationMs`: 失败前耗时（毫秒）
     - `timestamp`: 失败时间

---

## 六、修改点详细说明

### 6.1 审计日志修改点

#### 修改点 1: 导入和注入 AuditLogService

**文件**: `apps/api/src/novel-import/novel-import.controller.ts`

**逻辑**：
1. 在文件顶部 import 区域添加 `AuditLogService` 导入
2. 在 constructor 参数中添加 `auditLogService` 注入
3. 确保 `NovelImportModule` 已导入 `AuditLogModule`

#### 修改点 2: importNovelFile 审计日志

**文件**: `apps/api/src/novel-import/novel-import.controller.ts`

**逻辑**：
1. 在 `novelSource` 创建成功后（约第 131 行之后）
2. 在章节保存完成后（约第 147 行之后）
3. 在返回响应之前（约第 149 行之前）
4. 调用 `auditLogService.record()` 记录审计日志
5. 使用 `AuditLogService.extractRequestInfo(request)` 提取 IP 和 UserAgent
6. 记录所有必要的字段和 details

#### 修改点 3: importNovel 审计日志

**文件**: `apps/api/src/novel-import/novel-import.controller.ts`

**逻辑**：
1. 在 `novelSource` 创建成功后（约第 262 行之后）
2. 在章节保存完成后（约第 288 行之后）
3. 在返回响应之前（约第 290 行之前）
4. 调用 `auditLogService.record()` 记录审计日志
5. 使用 `AuditLogService.extractRequestInfo(request)` 提取 IP 和 UserAgent
6. 记录所有必要的字段和 details

#### 修改点 4: analyzeNovel 审计日志

**文件**: `apps/api/src/novel-import/novel-import.controller.ts`

**逻辑**：
1. 在 `analysisJob` 创建成功后（约第 409 行之后）
2. 在 Job 和 Task 创建完成后（约第 471 行之后）
3. 在返回响应之前（约第 486 行之前）
4. 调用 `auditLogService.record()` 记录审计日志
5. 使用 `AuditLogService.extractRequestInfo(request)` 提取 IP 和 UserAgent
6. 记录所有必要的字段和 details

### 6.2 可观测性埋点修改点

#### 修改点 1: 创建 Logger 实例

**文件**: `apps/workers/src/novel-analysis-processor.ts`

**逻辑**：
1. 在文件顶部导入 Logger（如果使用 NestJS Logger）
2. 或在文件顶部创建自定义 Logger 实例
3. 创建结构化日志输出函数（JSON.stringify 包装）

#### 修改点 2: processNovelAnalysisJob 日志埋点

**文件**: `apps/workers/src/novel-analysis-processor.ts`

**逻辑**：
1. 在函数开始处记录开始时间：`const startTime = Date.now();`
2. 在读取 rawText 后记录 `NOVEL_ANALYSIS_START` 日志
3. 在 `basicTextSegmentation` 调用前记录解析开始时间
4. 在 `basicTextSegmentation` 调用后记录 `NOVEL_ANALYSIS_PARSED` 日志和解析耗时
5. 在事务开始前记录 `NOVEL_ANALYSIS_WRITE_START` 日志和写库开始时间
6. 在事务提交后记录 `NOVEL_ANALYSIS_WRITE_COMPLETE` 日志和写库耗时
7. 在 catch 块中记录 `NOVEL_ANALYSIS_FAILED` 日志和错误信息

#### 修改点 3: processJob 日志埋点

**文件**: `apps/workers/src/main.ts`

**逻辑**：
1. 替换现有的 `console.log` 为结构化日志
2. 在 Job 开始处理时记录 `JOB_PROCESSING_START` 日志
3. 在 Job 成功时记录 `JOB_PROCESSING_SUCCESS` 日志和耗时
4. 在 Job 失败时记录 `JOB_PROCESSING_FAILED` 日志和错误信息

---

## 七、REVIEW 阶段的验证方式

### 7.1 审计日志验证

#### 验证方式 1: 代码审查
- ✅ 检查 `NovelImportController` 是否注入 `AuditLogService`
- ✅ 检查三个接口方法是否都调用了 `auditLogService.record()`
- ✅ 检查审计日志记录的字段是否完整（action, resourceType, resourceId, userId, ip, userAgent, details）
- ✅ 检查 `details` 字段是否包含必要的元数据

#### 验证方式 2: 数据库验证
- ✅ 执行导入操作后，查询 `audit_logs` 表
- ✅ 验证是否有 `NOVEL_IMPORT_FILE` / `NOVEL_IMPORT` / `NOVEL_ANALYZE` 记录
- ✅ 验证记录的字段是否正确填充
- ✅ 验证 `details` JSON 字段是否包含预期数据

#### 验证方式 3: 功能测试
- ✅ 执行完整的导入 → 分析流程
- ✅ 检查审计日志是否正确记录每个步骤
- ✅ 验证审计日志不影响主业务流程（即使写入失败也不影响功能）

### 7.2 可观测性埋点验证

#### 验证方式 1: 代码审查
- ✅ 检查是否使用结构化日志（JSON 格式）
- ✅ 检查是否记录了开始时间、结束时间、耗时
- ✅ 检查是否记录了统计信息（seasonsCount, episodesCount, scenesCount, shotsCount）
- ✅ 检查是否记录了错误信息（如有）

#### 验证方式 2: 日志输出验证
- ✅ 启动 Worker，执行 Novel Analysis Job
- ✅ 检查控制台输出是否为结构化 JSON 格式
- ✅ 验证日志包含所有预期的字段
- ✅ 验证耗时计算是否正确

#### 验证方式 3: 性能验证
- ✅ 执行多次分析操作
- ✅ 检查日志中的耗时数据是否合理
- ✅ 验证日志输出不影响性能（异步或非阻塞）

### 7.3 集成验证

#### 验证方式 1: 端到端测试
- ✅ 执行完整的导入 → 分析流程
- ✅ 检查审计日志和结构化日志是否都正确记录
- ✅ 验证日志记录的时间顺序是否正确

#### 验证方式 2: 错误场景测试
- ✅ 模拟解析失败场景
- ✅ 验证错误日志是否正确记录
- ✅ 验证审计日志是否记录失败操作（如有）

---

## 八、注意事项

### 8.1 审计日志注意事项

1. **不阻塞主流程**：
   - 审计日志写入失败不应影响主业务流程
   - 已有 try-catch 保护，但需要确保错误处理正确

2. **IP 和 UserAgent 提取**：
   - 使用 `AuditLogService.extractRequestInfo(request)` 提取
   - 确保正确处理代理场景（X-Forwarded-For）

3. **details 字段**：
   - 确保 details 中的敏感信息不泄露（如有）
   - 确保 details 字段大小合理（避免过大）

### 8.2 可观测性注意事项

1. **日志格式**：
   - 使用 JSON 格式，便于后续解析和分析
   - 确保日志级别正确（info/warn/error）

2. **性能影响**：
   - 日志输出不应显著影响性能
   - 考虑使用异步日志或批量写入（如需要）

3. **日志大小**：
   - 避免记录过大的数据（如完整的 rawText）
   - 只记录必要的统计信息和摘要

---

## 九、预期结果

### 9.1 审计日志预期结果

修复后，以下操作将产生审计日志：
- ✅ 用户上传小说文件 → `NOVEL_IMPORT_FILE` 记录
- ✅ 用户导入小说文本 → `NOVEL_IMPORT` 记录
- ✅ 用户触发分析 → `NOVEL_ANALYZE` 记录

所有审计日志包含完整的追溯信息，可以通过 user_id、project_id、resource_id 等字段进行查询和分析。

### 9.2 可观测性预期结果

修复后，Worker 将输出结构化日志：
- ✅ 解析开始/结束时间点
- ✅ 解析耗时（毫秒）
- ✅ 生成的结构统计（seasonsCount, episodesCount, scenesCount, shotsCount）
- ✅ 失败原因（如有）

所有日志为 JSON 格式，便于后续集成到日志分析系统（如 ELK、Loki 等）。

---

## 十、总结

### 10.1 修改文件清单

**P1 - 审计日志**：
1. `apps/api/src/novel-import/novel-import.controller.ts` - 添加审计日志记录
2. `apps/api/src/novel-import/novel-import.module.ts` - 确保导入 AuditLogModule（如需要）

**P2 - 可观测性**：
1. `apps/workers/src/novel-analysis-processor.ts` - 添加结构化日志
2. `apps/workers/src/main.ts` - 替换 console.log 为结构化日志

### 10.2 新增事件类型

**审计事件**（3 个）：
- `NOVEL_IMPORT_FILE`
- `NOVEL_IMPORT`
- `NOVEL_ANALYZE`

**日志事件**（8 个）：
- `NOVEL_ANALYSIS_START`
- `NOVEL_ANALYSIS_PARSED`
- `NOVEL_ANALYSIS_WRITE_START`
- `NOVEL_ANALYSIS_WRITE_COMPLETE`
- `NOVEL_ANALYSIS_FAILED`
- `JOB_PROCESSING_START`
- `JOB_PROCESSING_SUCCESS`
- `JOB_PROCESSING_FAILED`

### 10.3 验证方式

- ✅ 代码审查
- ✅ 数据库验证
- ✅ 功能测试
- ✅ 日志输出验证
- ✅ 性能验证
- ✅ 端到端测试
- ✅ 错误场景测试

---

**计划完成时间**: 待确认后执行  
**下一步**: 等待用户确认 PLAN，然后进入 MODE: EXECUTE

