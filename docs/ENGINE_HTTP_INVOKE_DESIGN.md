# HTTP 引擎调用路径设计文档

**文档版本**: V1.0  
**生成时间**: 2024-12-11  
**对应批次**: S3-A.2 (PLAN-only)  
**实现模式**: 本批次仅产出设计文档，不进行任何 .ts/.json 代码实现，所有实现工作统一放在后续 S3-A.3 EXECUTE 批次。  
**前置文档**: [ENGINE_HTTP_CONFIG.md](./ENGINE_HTTP_CONFIG.md) (S3-A.1)  
**规划文档**: [STAGE3_PLAN.md](./STAGE3_PLAN.md)

---

## 1. 目标与范围

### 1.1 设计目标

在 S3-A.1 完成 HTTP 引擎配置与安全设计的基础上，设计 HTTP 引擎的**调用路径**，包括：

1. **JobType 与 engineKey 的映射策略**：如何将新的 HTTP 引擎接入到现有 Job 系统
2. **HTTP 请求 payload 结构**：Worker → HttpEngineAdapter → 外部 HTTP 服务的请求格式
3. **HTTP 响应结构与 EngineInvokeResult 的映射**：外部服务响应 → EngineInvokeResult 的转换规则
4. **完整调用时序**：从 Worker 拉取 Job 到回写 Job 状态的完整流程
5. **与 S3-A.1 的边界**：明确哪些可以扩展，哪些绝对不能改

### 1.2 设计范围

- ✅ **包含**：
  - JobType 与 engineKey 的映射设计（新增实验性 JobType 或 feature flag）
  - HTTP 请求 payload 的构造规则
  - HTTP 响应到 `EngineInvokeResult` 的映射规则
  - Worker → EngineRegistry → HttpEngineAdapter → 外部服务的调用时序
  - 与现有 NOVEL_ANALYSIS 链路的隔离策略

- ❌ **不包含**：
  - HTTP 引擎配置读取（由 S3-A.1 负责，已封板）
  - 认证 Header 拼装（由 S3-A.1 负责，已封板）
  - 错误分类规则（由 S3-A.1 负责，已封板）
  - Engine 管理 API（由 S3-B.1 负责）
  - 前端 Studio/Import 页面联动（由 S3-C.1 负责）

### 1.3 不动边界（引用 STAGE3_PLAN 和 ENGINE_HTTP_CONFIG）

本设计严格遵循以下约束：

1. **禁止修改 NOVEL_ANALYSIS 现有执行链路**：
   - ❌ 禁止修改 `apps/api/src/novel-import/novel-import.controller.ts` 的核心导入逻辑
   - ❌ 禁止修改 `apps/workers/src/novel-analysis-processor.ts` 的分析处理逻辑
   - ❌ 禁止修改 NOVEL_ANALYSIS 的默认引擎绑定（仍使用 `default_novel_analysis` 本地适配器）

2. **HTTP 引擎接入仅允许通过以下两种方式**：
   - **方式 1**: 新增实验性 JobType（例如 `NOVEL_ANALYSIS_HTTP`、`SHOT_RENDER_HTTP`）
   - **方式 2**: 通过显式 feature flag（例如 `useHttpEngine: true`），且**默认关闭**

3. **Feature Flag 生效位置**：
   - Feature flag 在**创建 Job 时决定**（Task/Job payload 中设置）
   - **执行过程中不自动切换**引擎（Job 的 engineKey 已固化在 payload 中）

4. **S3-A.1 已封板的实现**（禁止修改）：
   - ❌ `apps/api/src/config/engine.config.ts` - 配置读取逻辑
   - ❌ `apps/api/src/engine/adapters/http-engine.adapter.ts` - 认证和错误处理逻辑
   - ❌ `apps/api/config/engines.json` - 引擎配置文件结构

---

## 2. JobType 与 engineKey 的映射策略

### 2.1 现有 JobType 与引擎映射

**当前状态**（Stage2 已实现）：

| JobType | 默认 engineKey | 适配器类型 | 是否允许 HTTP | 备注 |
|---------|---------------|-----------|-------------|------|
| `NOVEL_ANALYSIS` | `default_novel_analysis` | `local` | ❌ **禁止** | 使用本地适配器，禁止切换到 HTTP |
| `SHOT_RENDER` | `default_shot_render` | `local` 或 `http` | ✅ 允许 | 可通过 feature flag 使用 HTTP 引擎 |

**映射逻辑**（`EngineRegistry.getDefaultEngineKeyForJobType()`）：
```typescript
const jobTypeToEngineKey: Record<string, string> = {
  NOVEL_ANALYSIS: 'default_novel_analysis', // 本地 Adapter
  SHOT_RENDER: 'default_shot_render',
};
```

### 2.2 方案 A：新增实验性 JobType（推荐）

**设计思路**：为需要 HTTP 引擎的 JobType 创建对应的 `*_HTTP` 变体。

#### 2.2.1 新增 JobType 列表

| 新 JobType | 对应原始 JobType | 默认 engineKey | 适配器类型 | 用途 |
|-----------|----------------|---------------|-----------|------|
| `NOVEL_ANALYSIS_HTTP` | `NOVEL_ANALYSIS` | `http_gemini_v1` | `http` | 实验性：使用 HTTP 引擎进行小说分析 |
| `SHOT_RENDER_HTTP` | `SHOT_RENDER` | `http_gemini_v1` | `http` | 实验性：使用 HTTP 引擎进行镜头渲染 |

**注意**：
- `NOVEL_ANALYSIS_HTTP` 与 `NOVEL_ANALYSIS` **完全隔离**，不会影响现有 NOVEL_ANALYSIS 链路
- 这些 JobType 仅用于**实验性测试**，不接入现有业务流程

#### 2.2.2 EngineRegistry 映射扩展

**修改位置**：`apps/api/src/engine/engine-registry.service.ts`

**修改内容**：
```typescript
private getDefaultEngineKeyForJobType(jobType: string): string | null {
  const jobTypeToEngineKey: Record<string, string> = {
    // 现有 JobType（保持不变）
    NOVEL_ANALYSIS: 'default_novel_analysis', // 本地 Adapter
    SHOT_RENDER: 'default_shot_render',
    
    // 新增实验性 HTTP JobType
    NOVEL_ANALYSIS_HTTP: 'http_gemini_v1', // HTTP 引擎
    SHOT_RENDER_HTTP: 'http_gemini_v1',    // HTTP 引擎
  };

  return jobTypeToEngineKey[jobType] || null;
}
```

**约束**：
- ✅ 允许新增 `*_HTTP` JobType
- ❌ 禁止修改 `NOVEL_ANALYSIS` 的映射（仍指向 `default_novel_analysis`）

### 2.3 方案 B：Feature Flag（可选，需明确设计）

**设计思路**：在 Task/Job payload 中添加 `useHttpEngine: true` flag，强制使用 HTTP 引擎。

#### 2.3.1 Feature Flag 结构

**Task/Job payload 扩展**：
```typescript
interface TaskPayload {
  // 现有字段...
  projectId: string;
  novelSourceId?: string;
  // ...
  
  // 新增字段（可选）
  useHttpEngine?: boolean;        // 是否使用 HTTP 引擎（默认 false）
  engineKey?: string;              // 显式指定 engineKey（可选）
}
```

#### 2.3.2 EngineRegistry 扩展

**修改位置**：`apps/api/src/engine/engine-registry.service.ts`

**修改内容**：
```typescript
findAdapter(engineKey?: string, jobType?: string, payload?: any): EngineAdapter {
  // 1. 如果 payload 中有 useHttpEngine=true，强制使用 HTTP 引擎
  if (payload?.useHttpEngine === true) {
    const httpEngineKey = payload?.engineKey || 'http_gemini_v1';
    const adapter = this.getAdapter(httpEngineKey);
    if (adapter && adapter.supports(httpEngineKey)) {
      return adapter;
    }
  }
  
  // 2. 原有逻辑（保持不变）
  if (engineKey) {
    // ...
  }
  
  // ...
}
```

**约束**：
- ✅ 允许在 payload 中添加 `useHttpEngine` flag
- ❌ 禁止修改 `NOVEL_ANALYSIS` 的默认行为（除非显式设置 flag）
- ⚠️ 需要确保 flag 在创建 Job 时设置，执行过程中不自动切换

### 2.4 推荐方案

**推荐使用方案 A（新增实验性 JobType）**，原因：

1. **完全隔离**：新 JobType 与现有 JobType 完全隔离，不会影响现有业务流程
2. **易于测试**：可以独立测试 HTTP 引擎，不影响现有功能
3. **易于回滚**：如果出现问题，只需禁用新 JobType，不影响现有功能
4. **符合约束**：不修改 NOVEL_ANALYSIS 现有链路

**方案 B（Feature Flag）可作为补充**，用于：
- 在现有 JobType 中临时启用 HTTP 引擎（需谨慎）
- 支持按项目/租户配置不同的引擎（后续扩展）

---

## 3. HTTP 请求 payload 结构

### 3.1 HttpEngineAdapter.invoke() 输入

**输入结构**（`EngineInvokeInput`）：
```typescript
interface EngineInvokeInput {
  jobType: string;              // 如 'NOVEL_ANALYSIS_HTTP'
  engineKey: string;            // 如 'http_gemini_v1'
  payload: Record<string, any>; // Job 负载数据
  context: {
    projectId?: string;
    sceneId?: string;
    shotId?: string;
    episodeId?: string;
    seasonId?: string;
    [key: string]: any;
  };
}
```

### 3.2 HTTP 请求构造规则

**HttpEngineAdapter 内部构造的 HTTP 请求**（参考 S3-A.1 实现）：

```typescript
// HttpEngineAdapter.invoke() 内部逻辑
const config = this.engineConfigService.getHttpEngineConfig(engineKey);
const url = `${config.baseUrl}${config.path || '/invoke'}`;

const requestBody = {
  jobType,        // 从 EngineInvokeInput 传入
  engineKey,      // 从 EngineInvokeInput 传入
  payload,        // 从 EngineInvokeInput 传入（Job 负载数据）
  context,        // 从 EngineInvokeInput 传入（上下文信息）
};

// 构造认证 Header（由 S3-A.1 实现）
const headers = this.buildAuthHeaders(config, requestBody);

// 发送 HTTP 请求
const response = await httpClient.post(url, requestBody, { headers });
```

### 3.3 HTTP 请求示例

#### 示例 1：NOVEL_ANALYSIS_HTTP

**请求 URL**：`POST https://api.gemini.com/v1/invoke`

**请求 Headers**：
```
Authorization: Bearer sk-xxx...
Content-Type: application/json
```

**请求 Body**：
```json
{
  "jobType": "NOVEL_ANALYSIS_HTTP",
  "engineKey": "http_gemini_v1",
  "payload": {
    "novelSourceId": "novel_123",
    "rawText": "第一章：...",
    "projectId": "project_456"
  },
  "context": {
    "projectId": "project_456",
    "novelSourceId": "novel_123"
  }
}
```

#### 示例 2：SHOT_RENDER_HTTP

**请求 URL**：`POST https://api.gemini.com/v1/invoke`

**请求 Headers**：
```
Authorization: Bearer sk-xxx...
Content-Type: application/json
```

**请求 Body**：
```json
{
  "jobType": "SHOT_RENDER_HTTP",
  "engineKey": "http_gemini_v1",
  "payload": {
    "shotId": "shot_789",
    "sceneId": "scene_456",
    "shotText": "镜头描述：...",
    "projectId": "project_456"
  },
  "context": {
    "projectId": "project_456",
    "sceneId": "scene_456",
    "shotId": "shot_789"
  }
}
```

### 3.4 与 S3-A.1 的边界

**S3-A.1 已实现**（禁止修改）：
- ✅ `buildAuthHeaders()` - 认证 Header 拼装
- ✅ `getHttpEngineConfig()` - 配置读取
- ✅ URL 构造逻辑（`baseUrl + path`）

**S3-A.2 需要实现**（允许扩展）：
- ✅ HTTP 请求 Body 的构造（将 `EngineInvokeInput` 转换为 HTTP 请求）
- ✅ 支持不同 JobType 的 payload 结构（不修改 S3-A.1 的认证逻辑）

---

## 4. HTTP 响应结构与 EngineInvokeResult 的映射

### 4.1 外部 HTTP 服务响应格式

**标准响应格式**（参考 S3-A.1 设计）：
```typescript
interface HttpEngineResponse {
  success: boolean;              // 业务层成功标志
  status?: 'SUCCESS' | 'FAILED';  // 状态（可选）
  data?: any;                     // 输出数据（成功时）
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metrics?: {
    durationMs?: number;
    tokens?: number;
    costUsd?: number;
    [key: string]: any;
  };
  modelInfo?: {
    modelName?: string;
    version?: string;
  };
}
```

### 4.2 EngineInvokeResult 结构

**目标结构**（`packages/shared-types/src/engines/engine-adapter.ts`）：
```typescript
interface EngineInvokeResult {
  status: EngineInvokeStatus;     // SUCCESS | FAILED | RETRYABLE
  output?: Record<string, any>;   // 输出数据（成功时）
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metrics?: {
    durationMs?: number;
    tokensUsed?: number;
    cost?: number;
    [key: string]: any;
  };
}
```

### 4.3 映射规则

**HttpEngineAdapter.handleHttpResponse() 的映射逻辑**（参考 S3-A.1 实现）：

#### 规则 1：HTTP 200 + success=true → SUCCESS

**输入**：
```json
{
  "status": 200,
  "data": {
    "success": true,
    "data": {
      "seasons": [...],
      "episodes": [...]
    },
    "metrics": {
      "durationMs": 1234,
      "tokens": 500,
      "costUsd": 0.01
    }
  }
}
```

**输出**：
```typescript
{
  status: EngineInvokeStatus.SUCCESS,
  output: {
    seasons: [...],
    episodes: [...]
  },
  metrics: {
    durationMs: 1234,
    tokensUsed: 500,
    cost: 0.01
  }
}
```

#### 规则 2：HTTP 200 + success=false → FAILED

**输入**：
```json
{
  "status": 200,
  "data": {
    "success": false,
    "error": {
      "message": "Business logic failed",
      "code": "BUSINESS_ERROR"
    }
  }
}
```

**输出**：
```typescript
{
  status: EngineInvokeStatus.FAILED,
  error: {
    message: "Business logic failed",
    code: "BUSINESS_ERROR",
    details: {
      errorType: "BUSINESS_ERROR"
    }
  }
}
```

#### 规则 3：HTTP 5xx → RETRYABLE

**输入**：
```json
{
  "status": 500,
  "data": {}
}
```

**输出**：
```typescript
{
  status: EngineInvokeStatus.RETRYABLE,
  error: {
    message: "HTTP 500 Server Error",
    code: "HTTP_5XX",
    details: {
      errorType: "HTTP_5XX"
    }
  }
}
```

#### 规则 4：HTTP 429 → RETRYABLE

**输入**：
```json
{
  "status": 429,
  "headers": {
    "retry-after": "60"
  },
  "data": {}
}
```

**输出**：
```typescript
{
  status: EngineInvokeStatus.RETRYABLE,
  error: {
    message: "HTTP 429 Too Many Requests",
    code: "HTTP_RATE_LIMIT",
    details: {
      errorType: "HTTP_429",
      retryAfter: "60"
    }
  }
}
```

#### 规则 5：网络错误 → RETRYABLE

**输入**：
```typescript
{
  type: 'NETWORK_ERROR',
  code: 'ECONNRESET',
  message: 'Network error'
}
```

**输出**：
```typescript
{
  status: EngineInvokeStatus.RETRYABLE,
  error: {
    message: "Network error",
    code: "HTTP_TEMPORARY_ERROR",
    details: {
      errorType: "NETWORK_ERROR"
    }
  }
}
```

### 4.4 与 S3-A.1 的边界

**S3-A.1 已实现**（禁止修改）：
- ✅ `handleHttpResponse()` - HTTP 响应分类逻辑
- ✅ `handleHttpError()` - 网络错误分类逻辑
- ✅ 错误分类规则（RETRYABLE / FAILED / SUCCESS）

**S3-A.2 需要实现**（允许扩展）：
- ✅ 支持不同 JobType 的响应数据解析（不修改错误分类逻辑）
- ✅ 支持 metrics 字段的映射（tokens → tokensUsed, costUsd → cost）

---

## 5. 时序说明

### 5.1 完整调用时序图

```
┌─────────┐      ┌──────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│ Worker  │      │   API    │      │ EngineRegistry│      │HttpEngine   │      │ 外部 HTTP    │
│         │      │          │      │              │      │  Adapter    │      │   服务       │
└────┬────┘      └────┬─────┘      └──────┬───────┘      └──────┬──────┘      └──────┬───────┘
     │                │                    │                     │                    │
     │ 1. getNextJob()│                    │                     │                    │
     │───────────────>│                    │                     │                    │
     │                │                    │                     │                    │
     │ 2. Job (PENDING)│                    │                     │                    │
     │<───────────────│                    │                     │                    │
     │                │                    │                     │                    │
     │ 3. 构造 EngineInvokeInput            │                     │                    │
     │    { jobType, engineKey, payload, context }                │                    │
     │                │                    │                     │                    │
     │ 4. EngineAdapterClient.invoke(input)                      │                    │
     │────────────────────────────────────>│                     │                    │
     │                │                    │                     │                    │
     │                │ 5. findAdapter(engineKey, jobType)        │                    │
     │                │───────────────────>│                     │                    │
     │                │                    │                     │                    │
     │                │ 6. getHttpEngineConfig(engineKey)         │                    │
     │                │                    │─────────────────────>│                    │
     │                │                    │                     │                    │
     │                │ 7. HttpEngineConfig { baseUrl, authMode, ... }                 │
     │                │                    │<─────────────────────│                    │
     │                │                    │                     │                    │
     │                │ 8. adapter.invoke(input)                  │                    │
     │                │───────────────────────────────────────────>│                    │
     │                │                    │                     │                    │
     │                │                    │ 9. 构造 HTTP 请求   │                    │
     │                │                    │    POST /invoke     │                    │
     │                │                    │    { jobType, engineKey, payload, context }│
     │                │                    │                     │                    │
     │                │                    │ 10. 发送 HTTP 请求  │                    │
     │                │                    │──────────────────────────────────────────>│
     │                │                    │                     │                    │
     │                │                    │ 11. HTTP 响应       │                    │
     │                │                    │<──────────────────────────────────────────│
     │                │                    │                     │                    │
     │                │                    │ 12. handleHttpResponse()                 │
     │                │                    │    分类为 SUCCESS/FAILED/RETRYABLE       │
     │                │                    │                     │                    │
     │                │ 13. EngineInvokeResult                    │                    │
     │                │<───────────────────────────────────────────│                    │
     │                │                    │                     │                    │
     │ 14. EngineInvokeResult              │                     │                    │
     │<────────────────────────────────────│                     │                    │
     │                │                    │                     │                    │
     │ 15. 根据结果更新 Job 状态            │                     │                    │
     │     - SUCCESS → reportJobResult(SUCCEEDED)                  │                    │
     │     - FAILED → reportJobResult(FAILED)                    │                    │
     │     - RETRYABLE → reportJobResult(FAILED, retryable=true)   │                    │
     │────────────────>│                    │                     │                    │
     │                │                    │                     │                    │
     │ 16. Job 状态更新完成                 │                     │                    │
     │<────────────────│                    │                     │                    │
```

### 5.2 关键步骤说明

#### 步骤 1-2：Worker 拉取 Job

**位置**：`apps/workers/src/main.ts`

**逻辑**：
```typescript
const job = await apiClient.getNextJob(workerId);
// job: { id, type, payload, taskId, projectId, ... }
```

#### 步骤 3：构造 EngineInvokeInput

**位置**：`apps/workers/src/main.ts`

**逻辑**：
```typescript
const engineInput: EngineInvokeInput = {
  jobType: job.type,                    // 如 'NOVEL_ANALYSIS_HTTP'
  engineKey: job.payload?.engineKey,     // 如 'http_gemini_v1'（可选）
  payload: job.payload,                  // Job 负载数据
  context: {
    projectId: job.projectId,
    taskId: job.taskId,
    // ... 其他上下文信息
  },
};
```

#### 步骤 4-8：EngineRegistry 查找适配器

**位置**：`apps/api/src/engine/engine-registry.service.ts`

**逻辑**：
```typescript
// EngineRegistry.findAdapter()
const adapter = this.findAdapter(engineKey, jobType);
// 1. 如果指定了 engineKey，优先查找
// 2. 根据 jobType 查找默认适配器
// 3. 回退到全局默认适配器
```

#### 步骤 9-12：HttpEngineAdapter 发送 HTTP 请求

**位置**：`apps/api/src/engine/adapters/http-engine.adapter.ts`

**逻辑**：
```typescript
// HttpEngineAdapter.invoke()
const config = this.engineConfigService.getHttpEngineConfig(engineKey);
const url = `${config.baseUrl}${config.path || '/invoke'}`;
const headers = this.buildAuthHeaders(config, requestBody);
const response = await httpClient.post(url, requestBody, { headers });
const result = this.handleHttpResponse(response, engineKey, jobType, durationMs);
```

#### 步骤 13-16：Worker 更新 Job 状态

**位置**：`apps/workers/src/main.ts`

**逻辑**：
```typescript
if (engineResult.status === EngineInvokeStatus.SUCCESS) {
  await apiClient.reportJobResult(job.id, {
    status: 'SUCCEEDED',
    result: engineResult.output,
    metrics: engineResult.metrics,
  });
} else if (engineResult.status === EngineInvokeStatus.RETRYABLE) {
  await apiClient.reportJobResult(job.id, {
    status: 'FAILED',
    error: engineResult.error,
    retryable: true,  // 标记为可重试
  });
} else {
  await apiClient.reportJobResult(job.id, {
    status: 'FAILED',
    error: engineResult.error,
  });
}
```

### 5.3 重试流程（RETRYABLE 场景）

**当 HttpEngineAdapter 返回 `RETRYABLE` 时**：

1. Worker 调用 `reportJobResult(FAILED, retryable=true)`
2. API 的 `JobService.markJobFailedAndMaybeRetry()` 将 Job 状态标记为 `RETRYING`
3. Orchestrator 的 `processRetryJobs()` 在下次调度时，将到期的 `RETRYING` Job 放回 `PENDING` 队列
4. Worker 再次拉取该 Job，重复上述流程

**注意**：重试逻辑由 Job 系统负责，HttpEngineAdapter 不包含重试循环（S3-A.1 约束）。

---

## 6. 与 S3-A.1 的边界

### 6.1 S3-A.1 已封板的内容（禁止修改）

以下内容由 S3-A.1 实现并封板，**S3-A.2 禁止修改**：

1. **配置读取逻辑**（`EngineConfigService.getHttpEngineConfig()`）：
   - ❌ 禁止修改配置优先级（env > JSON > 默认值）
   - ❌ 禁止修改配置验证逻辑（`validateHttpEngineConfig()`）
   - ❌ 禁止修改配置缓存机制

2. **认证 Header 拼装**（`HttpEngineAdapter.buildAuthHeaders()`）：
   - ❌ 禁止修改认证模式（bearer / apiKey / hmac / none）
   - ❌ 禁止修改 HMAC 签名逻辑
   - ❌ 禁止修改 API Key 脱敏逻辑

3. **错误分类逻辑**（`HttpEngineAdapter.handleHttpResponse()` / `handleHttpError()`）：
   - ❌ 禁止修改错误分类规则（RETRYABLE / FAILED / SUCCESS）
   - ❌ 禁止修改网络错误处理逻辑
   - ❌ 禁止修改 HTTP 状态码映射规则

4. **重试责任边界**：
   - ❌ 禁止在 HttpEngineAdapter 内部实现重试循环
   - ❌ 禁止修改 `invoke()` 方法的接口签名

### 6.2 S3-A.2 允许扩展的内容

以下内容由 S3-A.2 负责实现，**允许扩展**：

1. **JobType 与 engineKey 映射**：
   - ✅ 允许新增实验性 JobType（如 `NOVEL_ANALYSIS_HTTP`）
   - ✅ 允许扩展 `EngineRegistry.getDefaultEngineKeyForJobType()` 映射
   - ✅ 允许在 payload 中添加 `useHttpEngine` feature flag（可选）

2. **HTTP 请求 payload 构造**：
   - ✅ 允许扩展 `HttpEngineAdapter.invoke()` 的请求 Body 构造逻辑
   - ✅ 允许支持不同 JobType 的 payload 结构（不修改认证逻辑）

3. **HTTP 响应数据解析**：
   - ✅ 允许扩展 `handleHttpResponse()` 的响应数据解析逻辑
   - ✅ 允许支持不同 JobType 的响应格式（不修改错误分类逻辑）
   - ✅ 允许扩展 metrics 字段映射（tokens → tokensUsed, costUsd → cost）

4. **Worker 调用流程**：
   - ✅ 允许扩展 Worker 的 `EngineInvokeInput` 构造逻辑
   - ✅ 允许扩展 Job 状态更新逻辑（根据 `EngineInvokeResult` 更新）

### 6.3 边界检查清单

在 S3-A.2 实现时，必须确保：

- ✅ **不修改** `apps/api/src/config/engine.config.ts` 的核心逻辑
- ✅ **不修改** `apps/api/src/engine/adapters/http-engine.adapter.ts` 的认证和错误分类逻辑
- ✅ **不修改** `apps/api/config/engines.json` 的配置结构（除非新增引擎配置）
- ✅ **不修改** `NOVEL_ANALYSIS` 的默认引擎绑定
- ✅ **不修改** `EngineAdapter` 接口定义
- ✅ **不修改** Job 状态机（PENDING → RUNNING → RETRYING/FAILED）
- ✅ **不修改** `schema.prisma`（除非采用方案 B 新增 EngineConfig 表）

### 6.4 封板约束再强调

**重要**：本设计文档不得作为回溯性调整 S3-A.1 封板内容（配置读取、认证逻辑、错误分类）的依据，任何相关调整必须新建 S3-A.x 批次，并按新批次生成 REVIEW 报告。

S3-A.1 已封板的内容（见 `docs/S3A1_REVIEW_REPORT.md` 第 10 章）包括：
- `apps/api/src/config/engine.config.ts` - 配置读取逻辑
- `apps/api/src/engine/adapters/http-engine.adapter.ts` - 认证和错误分类逻辑
- `apps/api/config/engines.json` - 引擎配置文件结构

这些文件在 S3-A.2 批次中**禁止修改**，所有扩展工作必须在不修改这些核心逻辑的前提下进行。

---

## 7. 实现文件清单（未来 EXECUTE 阶段）

### 7.1 需要修改的文件

1. **`apps/api/src/engine/engine-registry.service.ts`**（修改）
   - 扩展 `getDefaultEngineKeyForJobType()` 方法，添加 `*_HTTP` JobType 映射
   - 可选：扩展 `findAdapter()` 方法，支持 `useHttpEngine` feature flag

2. **`apps/api/src/engine/adapters/http-engine.adapter.ts`**（扩展，不修改核心逻辑）
   - 扩展 `invoke()` 方法的请求 Body 构造逻辑（支持不同 JobType）
   - 扩展 `handleHttpResponse()` 的响应数据解析逻辑（支持不同 JobType 的响应格式）
   - 扩展 metrics 字段映射（tokens → tokensUsed, costUsd → cost）

3. **`apps/workers/src/main.ts`**（扩展）
   - 扩展 `EngineInvokeInput` 构造逻辑（支持新 JobType）
   - 扩展 Job 状态更新逻辑（根据 `EngineInvokeResult` 更新）

4. **`packages/shared-types/src/engines/engine-adapter.ts`**（可选扩展）
   - 扩展 `EngineInvokeResult.metrics` 字段类型（如需要）

### 7.2 需要新增的文件

1. **`apps/api/src/engine/dto/http-engine-payload.dto.ts`**（可选，新增）
   - 定义不同 JobType 的 HTTP 请求 payload DTO

2. **`apps/api/src/engine/dto/http-engine-response.dto.ts`**（可选，新增）
   - 定义不同 JobType 的 HTTP 响应 DTO

### 7.3 不需要修改的文件

- ❌ `apps/api/src/config/engine.config.ts` - S3-A.1 已封板
- ❌ `apps/api/src/novel-import/novel-import.controller.ts` - 禁止修改
- ❌ `apps/workers/src/novel-analysis-processor.ts` - 禁止修改
- ❌ `schema.prisma` - 禁止修改（除非采用方案 B）

### 7.4 本批次实现边界

**重要说明**：

1. **S3-A.2 批次仅产出设计方案**：
   - S3-A.2 只产生设计文档（本文档），**不允许对列出的实现文件做任何代码改动**
   - 所有代码实现工作统一放在后续 **S3-A.3 EXECUTE 批次**进行

2. **实现文件清单的用途**：
   - 第 7.1、7.2 节列出的"需要修改/新增的文件"仅作为下一批 **S3-A.3 EXECUTE 的工作清单**
   - 这些文件清单用于指导 S3-A.3 批次的实现工作，而非 S3-A.2 批次的工作范围

3. **流程约束**：
   - 若在 S3-A.2 批次中对这些文件进行代码修改，属于**流程违规**
   - S3-A.2 批次必须严格遵循 PLAN-only 模式，只产出设计文档，不进行任何代码实现

4. **进入 EXECUTE 模式的前提**：
   - 必须等待本文档通过评审
   - 必须新建 S3-A.3 批次并进入 MODE: EXECUTE
   - 在 S3-A.3 批次中才能对上述文件进行实际代码修改

---

## 8. 风险与注意事项

### 8.1 风险点

1. **新 JobType 与现有 JobType 的隔离**：
   - **风险**：如果映射逻辑错误，可能影响现有 JobType
   - **缓解**：严格遵循约束，只新增 `*_HTTP` JobType，不修改现有映射

2. **HTTP 请求 payload 结构不匹配**：
   - **风险**：外部 HTTP 服务期望的 payload 结构与实际发送的不匹配
   - **缓解**：在实现前明确外部服务的 API 文档，确保 payload 结构正确

3. **响应数据解析错误**：
   - **风险**：外部服务的响应格式与预期不符，导致解析失败
   - **缓解**：实现健壮的响应解析逻辑，支持多种响应格式

### 8.2 注意事项

1. **测试策略**：
   - 先使用 mock HTTP 服务测试调用路径
   - 再使用真实 HTTP 服务进行集成测试
   - 确保不影响现有 NOVEL_ANALYSIS 链路

2. **日志记录**：
   - 在关键步骤记录结构化日志（请求 URL、payload 大小、响应状态等）
   - 确保日志不包含敏感信息（API Key 等）

3. **错误处理**：
   - 确保所有错误都被正确分类为 RETRYABLE 或 FAILED
   - 确保 RETRYABLE 错误由 Job 重试系统处理

---

## 9. 总结

### 9.1 设计要点回顾

1. **JobType 映射策略**：推荐使用方案 A（新增实验性 JobType），完全隔离现有链路
2. **HTTP 请求构造**：将 `EngineInvokeInput` 转换为标准 HTTP 请求格式
3. **响应数据映射**：将外部服务响应转换为 `EngineInvokeResult`，不修改错误分类逻辑
4. **调用时序**：Worker → EngineRegistry → HttpEngineAdapter → 外部服务 → 回写 Job 状态
5. **边界控制**：严格遵循 S3-A.1 的约束，不修改已封板的核心逻辑

### 9.2 与前置文档的对齐

- ✅ 遵循 `ENGINE_HTTP_CONFIG.md` 的配置和安全约束
- ✅ 遵循 `STAGE3_PLAN.md` 的 S3-A.2 设计目标
- ✅ 不修改 NOVEL_ANALYSIS 现有链路
- ✅ 不修改 S3-A.1 已封板的实现

### 9.3 下一步行动

1. **评审本文档**：确认 JobType 映射策略和调用路径设计
2. **进入 MODE: EXECUTE**：设计文档通过后，实现 JobType 映射和 HTTP 请求构造逻辑
3. **集成测试**：使用 mock HTTP 服务测试完整调用路径

---

**文档状态**: ✅ 设计完成，待评审  
**前置文档**: [ENGINE_HTTP_CONFIG.md](./ENGINE_HTTP_CONFIG.md) (S3-A.1)  
**后续批次**: S3-A.3（如需要）或 S3-B.1（Engine 管理 API）

