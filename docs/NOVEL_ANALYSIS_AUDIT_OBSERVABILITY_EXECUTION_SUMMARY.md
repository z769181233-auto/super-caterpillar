# Novel Analysis 审计日志与可观测性修复执行总结

**执行时间**: 2024-12-19  
**模式**: EXECUTE  
**状态**: ✅ 已完成

---

## 一、修改文件清单

### P1 - 审计日志（2 个文件）

1. ✅ **`apps/api/src/novel-import/novel-import.module.ts`**
   - **状态**: 无需修改（已导入 `AuditLogModule`）

2. ✅ **`apps/api/src/novel-import/novel-import.controller.ts`**
   - **修改内容**:
     - 导入 `AuditLogService`
     - 在 constructor 中注入 `auditLogService`
     - 在 `importNovelFile` 方法中添加审计日志记录
     - 在 `importNovel` 方法中添加审计日志记录
     - 在 `analyzeNovel` 方法中添加审计日志记录（单章和全书分析）

### P2 - 可观测性（2 个文件）

3. ✅ **`apps/workers/src/novel-analysis-processor.ts`**
   - **修改内容**:
     - 添加 `logStructured` 函数（结构化日志输出）
     - 在 `processNovelAnalysisJob` 中添加结构化日志埋点

4. ✅ **`apps/workers/src/main.ts`**
   - **修改内容**:
     - 添加 `logStructured` 函数（结构化日志输出）
     - 在 `processJob` 中替换 `console.log` 为结构化日志

---

## 二、核心代码片段摘要

### 2.1 审计日志实现（API 层）

#### importNovelFile 审计日志

```typescript
// 记录审计日志：NOVEL_IMPORT_FILE
const requestInfo = AuditLogService.extractRequestInfo(request);
try {
  await this.auditLogService.record({
    userId: user.userId,
    action: 'NOVEL_IMPORT_FILE',
    resourceType: 'project',
    resourceId: projectId,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    details: {
      projectId,
      novelSourceId: novelSource.id,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: fileExt,
      mimeType: file.mimetype,
      characterCount: parsed.characterCount,
      chapterCount: parsed.chapterCount,
      novelTitle,
      novelAuthor,
    },
  });
} catch (auditError) {
  // 审计日志写入失败不影响主流程
  console.error('Failed to record audit log for NOVEL_IMPORT_FILE:', auditError);
}
```

#### importNovel 审计日志

```typescript
// 记录审计日志：NOVEL_IMPORT
const requestInfo = AuditLogService.extractRequestInfo(request);
try {
  await this.auditLogService.record({
    userId: user.userId,
    action: 'NOVEL_IMPORT',
    resourceType: 'project',
    resourceId: projectId,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    details: {
      projectId,
      novelSourceId: novelSource.id,
      novelTitle: importNovelDto.title,
      characterCount: rawText.length,
      chapterCount: savedChapters.length,
      importMode: 'text',
    },
  });
} catch (auditError) {
  // 审计日志写入失败不影响主流程
  console.error('Failed to record audit log for NOVEL_IMPORT:', auditError);
}
```

#### analyzeNovel 审计日志

```typescript
// 记录审计日志：NOVEL_ANALYZE
const requestInfo = AuditLogService.extractRequestInfo(request);
try {
  await this.auditLogService.record({
    userId: user.userId,
    action: 'NOVEL_ANALYZE',
    resourceType: 'novel_analysis_job',
    resourceId: analysisJob.id,
    ip: requestInfo.ip,
    userAgent: requestInfo.userAgent,
    details: {
      projectId,
      novelSourceId: novelSource.id,
      jobType: analysisJob.jobType,
      chapterId: body.chapterId || null,
      jobId: job.id,
      taskId: task.id,
    },
  });
} catch (auditError) {
  // 审计日志写入失败不影响主流程
  console.error('Failed to record audit log for NOVEL_ANALYZE:', auditError);
}
```

### 2.2 结构化日志实现（Worker 层）

#### logStructured 函数

```typescript
function logStructured(level: 'info' | 'warn' | 'error', data: Record<string, any>): void {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const logMessage = JSON.stringify(logEntry);
  if (level === 'error') {
    console.error(logMessage);
  } else if (level === 'warn') {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }
}
```

#### processNovelAnalysisJob 日志埋点

```typescript
// 解析开始
logStructured('info', {
  action: 'NOVEL_ANALYSIS_START',
  jobId,
  projectId,
  novelSourceId: novelSource.id,
  rawTextLength: rawText.length,
});

// 解析完成
logStructured('info', {
  action: 'NOVEL_ANALYSIS_PARSED',
  jobId,
  projectId,
  stats: structure.stats,
  parsingDurationMs: parseDuration,
});

// 写库开始
logStructured('info', {
  action: 'NOVEL_ANALYSIS_WRITE_START',
  jobId,
  projectId,
  stats: structure.stats,
});

// 写库完成
logStructured('info', {
  action: 'NOVEL_ANALYSIS_WRITE_COMPLETE',
  jobId,
  projectId,
  writeDurationMs: writeDuration,
  totalDurationMs: totalDuration,
  stats: structure.stats,
});

// 失败处理
logStructured('error', {
  action: 'NOVEL_ANALYSIS_FAILED',
  jobId,
  projectId,
  error: error?.message || 'Unknown error',
  errorStack: error?.stack,
  durationMs: duration,
});
```

#### processJob 日志埋点

```typescript
// Job 处理开始
logStructured('info', {
  action: 'JOB_PROCESSING_START',
  jobId: job.id,
  jobType: job.type,
  workerId,
  projectId: job.projectId || job.payload?.projectId,
});

// Job 处理成功
logStructured('info', {
  action: 'JOB_PROCESSING_SUCCESS',
  jobId: job.id,
  jobType: job.type,
  workerId,
  durationMs: duration,
  result,
});

// Job 处理失败
logStructured('error', {
  action: 'JOB_PROCESSING_FAILED',
  jobId: job.id,
  jobType: job.type,
  workerId,
  error: error?.message || 'Unknown error',
  errorStack: error?.stack,
  durationMs: duration,
});
```

---

## 三、新增的审计事件类型

### 3.1 审计事件类型列表

1. **`NOVEL_IMPORT_FILE`**
   - **描述**: 用户上传小说文件
   - **resource_type**: `project`
   - **resource_id**: `projectId`
   - **details 包含**: `projectId`, `novelSourceId`, `fileName`, `fileSize`, `fileType`, `mimeType`, `characterCount`, `chapterCount`, `novelTitle`, `novelAuthor`

2. **`NOVEL_IMPORT`**
   - **描述**: 用户导入小说文本（文本导入模式）
   - **resource_type**: `project`
   - **resource_id**: `projectId`
   - **details 包含**: `projectId`, `novelSourceId`, `novelTitle`, `characterCount`, `chapterCount`, `importMode`

3. **`NOVEL_ANALYZE`**
   - **描述**: 用户触发小说分析
   - **resource_type**: `novel_analysis_job`
   - **resource_id**: `analysisJob.id`
   - **details 包含**: `projectId`, `novelSourceId`, `jobType`, `chapterId`, `jobId`, `taskId`

---

## 四、新增的日志埋点列表

### 4.1 Worker 日志埋点

1. **`NOVEL_ANALYSIS_START`**
   - **级别**: `info`
   - **字段**: `jobId`, `projectId`, `novelSourceId`, `rawTextLength`

2. **`NOVEL_ANALYSIS_PARSED`**
   - **级别**: `info`
   - **字段**: `jobId`, `projectId`, `stats`, `parsingDurationMs`

3. **`NOVEL_ANALYSIS_WRITE_START`**
   - **级别**: `info`
   - **字段**: `jobId`, `projectId`, `stats`

4. **`NOVEL_ANALYSIS_WRITE_COMPLETE`**
   - **级别**: `info`
   - **字段**: `jobId`, `projectId`, `writeDurationMs`, `totalDurationMs`, `stats`

5. **`NOVEL_ANALYSIS_FAILED`**
   - **级别**: `error`
   - **字段**: `jobId`, `projectId`, `error`, `errorStack`, `durationMs`

6. **`JOB_PROCESSING_START`**
   - **级别**: `info`
   - **字段**: `jobId`, `jobType`, `workerId`, `projectId`

7. **`JOB_PROCESSING_SUCCESS`**
   - **级别**: `info`
   - **字段**: `jobId`, `jobType`, `workerId`, `durationMs`, `result`

8. **`JOB_PROCESSING_FAILED`**
   - **级别**: `error`
   - **字段**: `jobId`, `jobType`, `workerId`, `error`, `errorStack`, `durationMs`

---

## 五、验证设计

### 5.1 静态检查验证

**验证方式**:

- ✅ 执行 `pnpm --filter ./apps/api build` - **构建成功**
- ✅ 检查导入路径正确性 - **所有导入路径正确**
- ✅ 检查循环依赖 - **无循环依赖**

**结果**: ✅ **通过**

### 5.2 审计验证设计

#### 5.2.1 数据库查询验证

**查询位置**: `audit_logs` 表（Prisma model: `AuditLog`）

**验证 SQL 示例**:

```sql
-- 查询 NOVEL_IMPORT_FILE 审计记录
SELECT * FROM audit_logs
WHERE action = 'NOVEL_IMPORT_FILE'
ORDER BY "createdAt" DESC
LIMIT 10;

-- 查询特定项目的所有 Novel Analysis 相关审计记录
SELECT * FROM audit_logs
WHERE "resourceId" = 'project-uuid'
  AND action IN ('NOVEL_IMPORT_FILE', 'NOVEL_IMPORT', 'NOVEL_ANALYZE')
ORDER BY "createdAt" DESC;

-- 查询特定用户的所有 Novel Analysis 操作
SELECT * FROM audit_logs
WHERE "userId" = 'user-uuid'
  AND action IN ('NOVEL_IMPORT_FILE', 'NOVEL_IMPORT', 'NOVEL_ANALYZE')
ORDER BY "createdAt" DESC;

-- 查询特定分析任务的审计记录
SELECT * FROM audit_logs
WHERE action = 'NOVEL_ANALYZE'
  AND "resourceId" = 'analysis-job-uuid';
```

**使用 Prisma 查询**:

```typescript
// 查询 NOVEL_IMPORT_FILE 记录
const importFileLogs = await prisma.auditLog.findMany({
  where: {
    action: 'NOVEL_IMPORT_FILE',
  },
  orderBy: {
    createdAt: 'desc',
  },
  take: 10,
});

// 查询特定项目的所有 Novel Analysis 操作
const projectLogs = await prisma.auditLog.findMany({
  where: {
    resourceId: projectId,
    action: {
      in: ['NOVEL_IMPORT_FILE', 'NOVEL_IMPORT', 'NOVEL_ANALYZE'],
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

#### 5.2.2 过滤条件

**按 action_type 过滤**:

- `action = 'NOVEL_IMPORT_FILE'` - 上传文件操作
- `action = 'NOVEL_IMPORT'` - 文本导入操作
- `action = 'NOVEL_ANALYZE'` - 分析操作

**按 projectId 过滤**:

- `resourceId = projectId` AND `action IN ('NOVEL_IMPORT_FILE', 'NOVEL_IMPORT', 'NOVEL_ANALYZE')`
- 或通过 `details` JSON 字段查询：`details->>'projectId' = 'project-uuid'`

**按 userId 过滤**:

- `userId = 'user-uuid'` AND `action IN ('NOVEL_IMPORT_FILE', 'NOVEL_IMPORT', 'NOVEL_ANALYZE')`

**按时间范围过滤**:

- `createdAt >= '2024-12-19'` AND `createdAt < '2024-12-20'`

### 5.3 日志验证设计

#### 5.3.1 Worker 日志字段

**预期日志字段**（JSON 格式）:

```json
{
  "level": "info|warn|error",
  "timestamp": "2024-12-19T12:00:00.000Z",
  "action": "NOVEL_ANALYSIS_START|NOVEL_ANALYSIS_PARSED|...",
  "jobId": "job-uuid",
  "projectId": "project-uuid",
  "novelSourceId": "novel-source-uuid",
  "rawTextLength": 100000,
  "stats": {
    "seasonsCount": 1,
    "episodesCount": 5,
    "scenesCount": 20,
    "shotsCount": 100
  },
  "parsingDurationMs": 1500,
  "writeDurationMs": 800,
  "totalDurationMs": 2300,
  "error": "error message",
  "errorStack": "stack trace",
  "durationMs": 2300,
  "workerId": "worker-main",
  "jobType": "NOVEL_ANALYSIS",
  "result": {}
}
```

#### 5.3.2 日志查询方式

**使用 grep 查询**:

```bash
# 查询特定 Job 的所有日志
grep '"jobId":"job-uuid"' worker.log

# 查询所有 NOVEL_ANALYSIS_START 日志
grep '"action":"NOVEL_ANALYSIS_START"' worker.log

# 查询所有错误日志
grep '"level":"error"' worker.log

# 查询特定项目的日志
grep '"projectId":"project-uuid"' worker.log

# 查询耗时超过 5 秒的日志
grep '"totalDurationMs":[5-9][0-9][0-9][0-9]' worker.log
```

**使用 jq 查询**（如果日志文件为 JSON Lines）:

```bash
# 查询特定 Job 的日志
cat worker.log | jq 'select(.jobId == "job-uuid")'

# 查询所有解析完成的日志
cat worker.log | jq 'select(.action == "NOVEL_ANALYSIS_PARSED")'

# 查询耗时统计
cat worker.log | jq 'select(.action == "NOVEL_ANALYSIS_WRITE_COMPLETE") | .totalDurationMs'
```

**使用日志系统查询**（如 ELK、Loki）:

```
# 查询特定 Job 的所有日志
{jobId="job-uuid"}

# 查询所有 NOVEL_ANALYSIS 相关日志
{action=~"NOVEL_ANALYSIS.*"}

# 查询错误日志
{level="error"}

# 查询特定项目的日志
{projectId="project-uuid"}

# 查询耗时超过阈值的日志
{totalDurationMs>5000}
```

---

## 六、验证结果

### 6.1 静态检查结果

✅ **构建验证**: `pnpm --filter ./apps/api build` - **成功**

- webpack 5.97.1 compiled successfully in 5273 ms

✅ **导入路径**: 所有导入路径正确

- `AuditLogService` 正确导入
- `AuditLogModule` 已在 module 中导入

✅ **循环依赖**: 无循环依赖

### 6.2 代码审查结果

✅ **审计日志实现**:

- 三个接口都已添加审计日志记录
- 使用统一的 `AuditLogService.record()` 方法
- 使用 `AuditLogService.extractRequestInfo()` 提取 IP 和 UserAgent
- 审计日志写入失败不影响主流程（有 try-catch 保护）

✅ **结构化日志实现**:

- Worker 侧使用统一的 `logStructured` 函数
- 所有日志为 JSON 格式
- 包含必要的字段（action, jobId, projectId, timestamp 等）
- 记录耗时和统计信息

### 6.3 功能验证（待执行）

⚠️ **待执行验证**:

- 数据库审计日志查询验证
- Worker 日志输出验证
- 端到端功能测试

---

## 七、注意事项

### 7.1 【假设】标记

⚠️ **Worker ID 假设**:

- 在 `apps/workers/src/main.ts` 中，`workerId` 当前硬编码为 `'worker-main'`
- **假设**: Worker ID 应从环境变量或配置获取，但当前实现使用硬编码值
- **后续建议**: 从 Worker 注册信息中获取真实的 Worker ID

### 7.2 审计日志 resource_type

⚠️ **resource_type 选择**:

- `NOVEL_IMPORT_FILE` 和 `NOVEL_IMPORT` 使用 `resource_type: 'project'`
- `NOVEL_ANALYZE` 使用 `resource_type: 'novel_analysis_job'`
- **原因**: 按照操作的主要资源类型选择，符合现有审计日志规范

---

## 八、总结

### 8.1 完成情况

✅ **P1 - 审计日志**: 已完成

- 3 个接口都已添加审计日志记录
- 3 个新的审计事件类型已实现

✅ **P2 - 可观测性**: 已完成

- Worker 侧结构化日志已实现
- 8 个日志埋点已添加

### 8.2 修改文件统计

- **修改文件数**: 3 个（1 个文件无需修改）
- **新增代码行数**: 约 200 行
- **新增审计事件**: 3 个
- **新增日志埋点**: 8 个

### 8.3 下一步建议

1. **执行功能验证**:
   - 执行完整的导入 → 分析流程
   - 查询 `audit_logs` 表验证审计日志记录
   - 检查 Worker 日志输出格式

2. **优化建议**:
   - Worker ID 应从环境变量或配置获取
   - 考虑添加日志聚合和分析功能

---

**执行完成时间**: 2024-12-19  
**状态**: ✅ **已完成，等待验证**
