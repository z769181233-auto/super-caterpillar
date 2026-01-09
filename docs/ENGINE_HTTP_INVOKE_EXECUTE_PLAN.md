# HTTP 引擎调用路径实现计划文档

**文档版本**: V1.0  
**生成时间**: 2024-12-11  
**对应批次**: S3-A.3 (EXECUTE)  
**实现模式**: 本批次负责在"已封板的 S3-A.1"和"PLAN-only 的 S3-A.2"基础上落地实现 HTTP 调用链路，不回头改 S3-A.1 封板内容。  
**前置文档**:

- [ENGINE_HTTP_CONFIG.md](./ENGINE_HTTP_CONFIG.md) (S3-A.1 配置与安全设计)
- [S3A1_REVIEW_REPORT.md](./S3A1_REVIEW_REPORT.md) (S3-A.1 封板报告，特别是第 10 章)
- [ENGINE_HTTP_INVOKE_DESIGN.md](./ENGINE_HTTP_INVOKE_DESIGN.md) (S3-A.2 调用路径设计)

---

## 1. 批次和模式说明

### 1.1 批次定位

**S3-A.3 是 EXECUTE 批次**，负责将 S3-A.2 的设计方案落地为实际代码实现。

### 1.2 实现范围

本批次**只负责**在以下基础上落地实现 HTTP 调用链路：

1. **S3-A.1 已封板的内容**（禁止修改）：
   - `apps/api/src/config/engine.config.ts` - 配置读取逻辑
   - `apps/api/src/engine/adapters/http-engine.adapter.ts` - 认证和错误分类逻辑
   - `apps/api/config/engines.json` - 引擎配置文件结构

2. **S3-A.2 的设计方案**（需要实现）：
   - JobType 与 engineKey 的映射策略（新增 `*_HTTP` JobType）
   - HTTP 请求 payload 构造逻辑
   - HTTP 响应数据解析逻辑
   - Worker → EngineRegistry → HttpEngineAdapter → 外部服务的调用时序

### 1.3 严格约束

- ❌ **禁止修改** S3-A.1 封板文件的核心逻辑
- ❌ **禁止调整** S3-A.1 的配置读取、认证逻辑、错误分类规则
- ❌ **禁止引入** 任何 retry 循环、sleep、延时逻辑到 HttpEngineAdapter
- ✅ **允许扩展** HttpEngineAdapter 的请求构造和响应解析逻辑（不修改认证和错误分类）
- ✅ **允许新增** 实验性 JobType（`NOVEL_ANALYSIS_HTTP`、`SHOT_RENDER_HTTP`）
- ✅ **允许扩展** EngineRegistry 的 JobType 映射逻辑

---

## 2. 文件级实现清单

### 2.1 `apps/api/src/engine/engine-registry.service.ts`

#### 2.1.1 需要新增/调整的函数或逻辑

**任务 1：扩展 `getDefaultEngineKeyForJobType()` 方法**

**位置**：`private getDefaultEngineKeyForJobType(jobType: string): string | null`

**实现逻辑**（伪代码）：

```typescript
private getDefaultEngineKeyForJobType(jobType: string): string | null {
  const jobTypeToEngineKey: Record<string, string> = {
    // 现有 JobType（保持不变，禁止修改）
    NOVEL_ANALYSIS: 'default_novel_analysis', // 本地 Adapter
    SHOT_RENDER: 'default_shot_render',

    // 新增实验性 HTTP JobType（S3-A.3 实现）
    NOVEL_ANALYSIS_HTTP: 'http_gemini_v1', // HTTP 引擎
    SHOT_RENDER_HTTP: 'http_gemini_v1',    // HTTP 引擎
  };

  return jobTypeToEngineKey[jobType] || null;
}
```

**关键约束**：

- ✅ 只允许**新增** `*_HTTP` JobType 映射
- ❌ **禁止修改** `NOVEL_ANALYSIS` 的映射（仍指向 `default_novel_analysis`）
- ❌ **禁止修改** 现有 JobType 的映射关系

**任务 2：可选扩展 `findAdapter()` 方法（支持 feature flag）**

**位置**：`findAdapter(engineKey?: string, jobType?: string): EngineAdapter`

**实现逻辑**（伪代码，可选实现）：

```typescript
findAdapter(engineKey?: string, jobType?: string, payload?: any): EngineAdapter {
  // 可选：如果 payload 中有 useHttpEngine=true，强制使用 HTTP 引擎
  // 注意：此功能为可选，如果实现需要确保不影响现有逻辑
  if (payload?.useHttpEngine === true) {
    const httpEngineKey = payload?.engineKey || 'http_gemini_v1';
    const adapter = this.getAdapter(httpEngineKey);
    if (adapter && adapter.supports(httpEngineKey)) {
      return adapter;
    }
  }

  // 原有逻辑（保持不变）
  // ... 现有实现
}
```

**关键约束**：

- ⚠️ 此功能为**可选实现**，如果实现需要确保：
  - 不影响现有 `findAdapter()` 的调用方式（向后兼容）
  - 不修改现有 JobType 的默认行为
  - 只在显式设置 `useHttpEngine=true` 时生效

#### 2.1.2 不能改动的部分

- ❌ **禁止修改** `register()`, `getAdapter()`, `getDefaultAdapter()` 方法
- ❌ **禁止修改** `findAdapter()` 的现有逻辑（除非添加可选的 feature flag 分支）
- ❌ **禁止修改** `invoke()` 方法的接口签名和实现逻辑

---

### 2.2 `apps/api/src/engine/adapters/http-engine.adapter.ts`

#### 2.2.1 允许扩展的范围

**只能在以下层面新增逻辑**：

- ✅ HTTP 请求 Body 构造（将 `EngineInvokeInput` 转换为 HTTP 请求格式）
- ✅ HTTP 响应数据解析（将外部服务响应转换为 `EngineInvokeResult.output`）
- ✅ metrics 字段映射（tokens → tokensUsed, costUsd → cost）

**禁止修改的范围**：

- ❌ **禁止修改** `buildAuthHeaders()`, `buildHmacHeaders()` - 认证 Header 拼装（S3-A.1 封板）
- ❌ **禁止修改** `handleHttpResponse()`, `handleHttpError()` - 错误分类逻辑（S3-A.1 封板）
- ❌ **禁止修改** `logRequestStart()` - 日志脱敏逻辑（S3-A.1 封板）
- ❌ **禁止修改** `computeBodyHash()`, `computeHmacSignature()` - HMAC 签名计算（S3-A.1 封板）
- ❌ **禁止修改** `invoke()` 方法的接口签名

#### 2.2.2 请求 Body 构造逻辑

**位置**：`invoke()` 方法内部，在调用 `buildAuthHeaders()` 之前

**实现逻辑**（伪代码）：

```typescript
async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
  // ... 现有逻辑（获取 config、构造 URL）

  // S3-A.3 新增：根据 JobType 构造不同的请求 Body
  const requestBody = this.buildRequestBody(input);

  // 现有逻辑（调用 buildAuthHeaders，发送请求）
  const headers = this.buildAuthHeaders(config, requestBody);
  // ...
}

// S3-A.3 新增方法
private buildRequestBody(input: EngineInvokeInput): any {
  // 基础结构（所有 JobType 通用）
  const baseBody = {
    jobType: input.jobType,
    engineKey: input.engineKey,
    payload: input.payload,
    context: input.context,
  };

  // 根据 JobType 进行特殊处理（如果需要）
  if (input.jobType === 'NOVEL_ANALYSIS_HTTP') {
    // 可以在这里对 payload 进行格式化或验证
    return baseBody;
  } else if (input.jobType === 'SHOT_RENDER_HTTP') {
    // 可以在这里对 payload 进行格式化或验证
    return baseBody;
  }

  // 默认返回基础结构
  return baseBody;
}
```

**关键约束**：

- ✅ 只允许构造请求 Body，**不修改**认证 Header 的生成逻辑
- ✅ 请求 Body 结构必须符合 S3-A.2 设计文档中的格式

#### 2.2.3 响应数据解析逻辑

**位置**：`handleHttpResponse()` 方法内部，在错误分类之后

**实现逻辑**（伪代码）：

```typescript
private handleHttpResponse(
  response: { status: number; data: HttpEngineResponse; headers: Record<string, string> },
  engineKey: string,
  jobType: string,
  durationMs: number,
): EngineInvokeResult {
  // S3-A.1 封板逻辑：错误分类（禁止修改）
  if (response.status >= 200 && response.status < 300) {
    if (response.data.success === true || response.data.status === 'SUCCESS') {
      // S3-A.3 新增：根据 JobType 解析响应数据
      const output = this.parseResponseData(response.data, jobType);
      const metrics = this.parseMetrics(response.data.metrics);

      return {
        status: EngineInvokeStatus.SUCCESS,
        output,
        metrics,
      };
    }
    // ... 错误分类逻辑（S3-A.1 封板，禁止修改）
  }
  // ... 其他错误分类逻辑（S3-A.1 封板，禁止修改）
}

// S3-A.3 新增方法：解析响应数据
private parseResponseData(responseData: HttpEngineResponse, jobType: string): Record<string, any> {
  // 根据 JobType 解析不同的响应格式
  if (jobType === 'NOVEL_ANALYSIS_HTTP') {
    // 解析小说分析结果
    // 例如：从 responseData.data 中提取 seasons, episodes, scenes, shots
    return responseData.data || {};
  } else if (jobType === 'SHOT_RENDER_HTTP') {
    // 解析镜头渲染结果
    return responseData.data || {};
  }

  // 默认返回原始 data
  return responseData.data || {};
}

// S3-A.3 新增方法：解析 metrics
private parseMetrics(metrics?: any): EngineInvokeResult['metrics'] {
  if (!metrics) return undefined;

  return {
    durationMs: metrics.durationMs,
    tokensUsed: metrics.tokens || metrics.tokensUsed, // 支持两种字段名
    cost: metrics.costUsd || metrics.cost,           // 支持两种字段名
    ...metrics, // 保留其他字段
  };
}
```

**关键约束**：

- ✅ 只允许解析响应数据，**不修改**错误分类规则
- ✅ 必须保持 `handleHttpResponse()` 的错误分类逻辑不变（SUCCESS / FAILED / RETRYABLE）
- ✅ 必须支持不同 JobType 的响应格式（通过 `jobType` 参数区分）

#### 2.2.4 不能改动的部分

- ❌ **禁止修改** `buildAuthHeaders()`, `buildHmacHeaders()` - 认证逻辑（S3-A.1 封板）
- ❌ **禁止修改** `handleHttpResponse()` 的错误分类逻辑（S3-A.1 封板）
- ❌ **禁止修改** `handleHttpError()` 的错误分类逻辑（S3-A.1 封板）
- ❌ **禁止修改** `logRequestStart()` - 日志脱敏逻辑（S3-A.1 封板）
- ❌ **禁止修改** `invoke()` 方法的接口签名

---

### 2.3 `apps/workers/src/main.ts`

#### 2.3.1 扩展 `EngineInvokeInput` 构造逻辑

**位置**：`processJob()` 函数内部

**实现逻辑**（伪代码）：

```typescript
async function processJob(job: {
  id: string;
  type: string;
  payload: any;
  taskId: string;
  shotId?: string;
  projectId?: string;
}): Promise<void> {
  // ... 现有逻辑（日志记录等）

  try {
    // S3-A.3 扩展：支持 *_HTTP JobType
    if (job.type === 'NOVEL_ANALYSIS' || job.type === 'NOVEL_ANALYSIS_HTTP') {
      const engineInput: EngineInvokeInput = {
        jobType: job.type, // 保持原始 jobType（支持 NOVEL_ANALYSIS_HTTP）
        engineKey: (job.payload as any)?.engineKey || undefined, // 可选：从 payload 获取
        payload: {
          ...(job.payload || {}),
          jobId: job.id,
          novelSourceId: (job.payload as any)?.novelSourceId,
        },
        context: {
          projectId: job.projectId,
          jobId: job.id,
          taskId: job.taskId,
          // 可以添加更多上下文信息
        },
      };

      const engineResult = await engineAdapterClient.invoke(engineInput);
      // ... 处理结果
    } else if (job.type === 'SHOT_RENDER_HTTP') {
      // S3-A.3 新增：支持 SHOT_RENDER_HTTP
      const engineInput: EngineInvokeInput = {
        jobType: 'SHOT_RENDER_HTTP',
        engineKey: (job.payload as any)?.engineKey || undefined,
        payload: {
          ...(job.payload || {}),
          jobId: job.id,
          shotId: job.shotId,
        },
        context: {
          projectId: job.projectId,
          jobId: job.id,
          taskId: job.taskId,
          shotId: job.shotId,
        },
      };

      const engineResult = await engineAdapterClient.invoke(engineInput);
      // ... 处理结果
    } else {
      throw new Error(`Unsupported job type: ${job.type}`);
    }

    // ... 上报结果
  } catch (error) {
    // ... 错误处理
  }
}
```

**关键约束**：

- ✅ 必须保持现有 `NOVEL_ANALYSIS` 的处理逻辑不变
- ✅ 新增的 `*_HTTP` JobType 处理逻辑必须与现有逻辑隔离
- ✅ `context` 字段必须包含足够的上下文信息（projectId, jobId, taskId 等）

#### 2.3.2 扩展 Job 状态更新逻辑

**位置**：`processJob()` 函数内部，处理 `EngineInvokeResult` 之后

**实现逻辑**（伪代码）：

```typescript
const engineResult = await engineAdapterClient.invoke(engineInput);

// S3-A.3 扩展：根据 EngineInvokeResult 更新 Job 状态
if (engineResult.status === EngineInvokeStatus.SUCCESS) {
  // 成功：上报 SUCCEEDED 状态
  await apiClient.reportJobResult({
    jobId: job.id,
    status: 'SUCCEEDED',
    result: engineResult.output,
    metrics: engineResult.metrics, // 可选：传递 metrics
  });
} else if (engineResult.status === EngineInvokeStatus.RETRYABLE) {
  // 可重试：上报 FAILED 状态，标记为可重试
  await apiClient.reportJobResult({
    jobId: job.id,
    status: 'FAILED',
    error: engineResult.error,
    retryable: true, // 标记为可重试
  });
} else {
  // 失败：上报 FAILED 状态
  await apiClient.reportJobResult({
    jobId: job.id,
    status: 'FAILED',
    error: engineResult.error,
  });
}
```

**关键约束**：

- ✅ 必须遵守现有 JobStatus 状态机（PENDING → RUNNING → SUCCEEDED/FAILED/RETRYING）
- ✅ `RETRYABLE` 状态必须转换为 `FAILED` 状态，并设置 `retryable: true`
- ✅ 不能直接修改 Job 状态，必须通过 `apiClient.reportJobResult()` 上报

#### 2.3.3 不能改动的部分

- ❌ **禁止修改** 现有 `NOVEL_ANALYSIS` 的处理逻辑
- ❌ **禁止修改** Job 状态机的状态流转规则
- ❌ **禁止修改** `apiClient.reportJobResult()` 的调用方式（除非扩展参数）

---

### 2.4 `packages/shared-types/src/engines/engine-adapter.ts`（可选扩展）

#### 2.4.1 扩展 metrics 字段类型

**当前结构**：

```typescript
interface EngineInvokeResult {
  status: EngineInvokeStatus;
  output?: Record<string, any>;
  error?: { ... };
  metrics?: {
    durationMs?: number;
    tokensUsed?: number;
    cost?: number;
    [key: string]: any;
  };
}
```

**扩展方案**（如果需要）：

```typescript
interface EngineInvokeResult {
  // ... 现有字段
  metrics?: {
    durationMs?: number;
    tokensUsed?: number;
    cost?: number;
    // S3-A.3 可选扩展：支持更多 metrics 字段
    tokens?: number; // 向后兼容：支持 tokens 字段名
    costUsd?: number; // 向后兼容：支持 costUsd 字段名
    [key: string]: any; // 保留索引签名，支持任意字段
  };
}
```

**关键约束**：

- ✅ 必须保持向后兼容（现有字段不能删除或修改类型）
- ✅ 只能**新增可选字段**，不能修改现有字段
- ✅ 必须保留 `[key: string]: any` 索引签名，支持任意扩展字段

#### 2.4.2 避免 break change 的策略

1. **保持现有字段不变**：
   - `durationMs`, `tokensUsed`, `cost` 字段必须保持原有类型和可选性

2. **新增字段为可选**：
   - 所有新增字段必须为可选（`?:`），确保不影响现有代码

3. **使用索引签名**：
   - 保留 `[key: string]: any`，允许外部服务返回任意 metrics 字段

---

### 2.5 可选 DTO 文件（`apps/api/src/engine/dto/*.ts`）

#### 2.5.1 是否需要 DTO

**评估**：

- 如果 HTTP 请求/响应的结构相对简单，可以直接使用 `Record<string, any>`
- 如果需要对请求/响应进行严格的类型检查和验证，建议创建 DTO

**推荐方案**：**暂不创建 DTO 文件**（MVP 阶段）

**理由**：

1. HTTP 请求 Body 结构相对简单（jobType, engineKey, payload, context）
2. HTTP 响应结构由外部服务决定，难以提前定义严格类型
3. 使用 `Record<string, any>` 可以保持灵活性，后续需要时再创建 DTO

#### 2.5.2 如果未来需要创建 DTO

**文件结构**（仅供参考，本批次不实现）：

```typescript
// apps/api/src/engine/dto/http-engine-payload.dto.ts
export interface HttpEngineRequestPayload {
  jobType: string;
  engineKey: string;
  payload: Record<string, any>;
  context: {
    projectId?: string;
    sceneId?: string;
    shotId?: string;
    [key: string]: any;
  };
}

// apps/api/src/engine/dto/http-engine-response.dto.ts
export interface HttpEngineResponse {
  success: boolean;
  status?: 'SUCCESS' | 'FAILED';
  data?: any;
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
}
```

---

## 3. 执行步骤（分阶段的实施顺序）

### 阶段 1：只在 API 侧打通适配器选择层

**目标**：扩展 EngineRegistry，支持 `*_HTTP` JobType → `http_gemini_v1` 映射，确保现有 `NOVEL_ANALYSIS` 行为不变。

#### 步骤 1.1：扩展 `getDefaultEngineKeyForJobType()`

**任务**：

1. 在 `apps/api/src/engine/engine-registry.service.ts` 中修改 `getDefaultEngineKeyForJobType()` 方法
2. 新增 `NOVEL_ANALYSIS_HTTP` 和 `SHOT_RENDER_HTTP` 的映射
3. 确保 `NOVEL_ANALYSIS` 的映射保持不变

**验证**：

- 运行现有测试，确保 `NOVEL_ANALYSIS` 仍然映射到 `default_novel_analysis`
- 手动测试 `getDefaultEngineKeyForJobType('NOVEL_ANALYSIS_HTTP')` 返回 `'http_gemini_v1'`

#### 步骤 1.2：可选扩展 `findAdapter()`（支持 feature flag）

**任务**（可选）：

1. 如果采用 feature flag 方案，扩展 `findAdapter()` 方法签名，添加 `payload?: any` 参数
2. 在方法开头添加 `useHttpEngine` 分支逻辑
3. 确保不影响现有调用方式（向后兼容）

**验证**：

- 运行现有测试，确保不传 `payload` 参数时行为不变
- 测试传入 `payload: { useHttpEngine: true }` 时使用 HTTP 引擎

#### 步骤 1.3：自检

**检查项**：

- ✅ 所有与 S3-A.1 封板文件的依赖关系保持单向（不修改封板文件）
- ✅ `NOVEL_ANALYSIS` 的默认引擎绑定保持不变
- ✅ 新增的 `*_HTTP` JobType 映射不影响现有逻辑

---

### 阶段 2：打通 Worker → EngineAdapter → HTTP 的数据路径

**目标**：在 Worker 中统一构造 `EngineInvokeInput`，在 HttpEngineAdapter 中只"拼请求体 + 调 handleHttpResponse"，不动认证/错误分类。

#### 步骤 2.1：在 Worker 中统一构造 `EngineInvokeInput`

**任务**：

1. 在 `apps/workers/src/main.ts` 的 `processJob()` 函数中扩展 JobType 处理逻辑
2. 支持 `NOVEL_ANALYSIS_HTTP` 和 `SHOT_RENDER_HTTP` JobType
3. 统一构造 `EngineInvokeInput`（包含 jobType, engineKey, payload, context）

**验证**：

- 确保 `NOVEL_ANALYSIS` 的处理逻辑保持不变
- 测试 `NOVEL_ANALYSIS_HTTP` JobType 能正确构造 `EngineInvokeInput`

#### 步骤 2.2：在 HttpEngineAdapter 中扩展请求 Body 构造

**任务**：

1. 在 `apps/api/src/engine/adapters/http-engine.adapter.ts` 的 `invoke()` 方法中新增 `buildRequestBody()` 方法
2. 根据 `EngineInvokeInput` 构造 HTTP 请求 Body
3. 确保不修改 `buildAuthHeaders()` 的调用逻辑

**验证**：

- 确保请求 Body 结构符合 S3-A.2 设计文档
- 确保认证 Header 的生成逻辑不变

#### 步骤 2.3：在 HttpEngineAdapter 中扩展响应数据解析

**任务**：

1. 在 `handleHttpResponse()` 方法中新增 `parseResponseData()` 和 `parseMetrics()` 方法
2. 根据 JobType 解析不同的响应格式
3. 确保不修改错误分类逻辑（SUCCESS / FAILED / RETRYABLE）

**验证**：

- 确保错误分类逻辑保持不变
- 测试不同 JobType 的响应数据能正确解析

#### 步骤 2.4：扩展 Job 状态更新逻辑

**任务**：

1. 在 `apps/workers/src/main.ts` 中扩展 `EngineInvokeResult` 处理逻辑
2. 正确处理 `SUCCESS`、`FAILED`、`RETRYABLE` 三种状态
3. 确保 `RETRYABLE` 状态转换为 `FAILED` 状态，并设置 `retryable: true`

**验证**：

- 确保 Job 状态更新符合现有状态机规则
- 测试 `RETRYABLE` 状态能正确触发重试机制

#### 步骤 2.5：自检

**检查项**：

- ✅ 在代码层面不会引入任何 retry / sleep / 延时逻辑
- ✅ HttpEngineAdapter 的认证和错误分类逻辑保持不变
- ✅ Worker 的 Job 状态更新逻辑符合现有状态机

---

### 阶段 3：为 `*_HTTP` JobType 设定最小可用验证路径

**目标**：设计一个最小的 `NOVEL_ANALYSIS_HTTP` 调用流，验证完整链路不影响现有 `NOVEL_ANALYSIS`。

#### 步骤 3.1：设计最小的 `NOVEL_ANALYSIS_HTTP` 调用流

**任务**：

1. 设计一个简单的 mock HTTP 服务（或使用现有的测试 HTTP 服务）
2. 定义 mock 服务的请求/响应格式
3. 确保 mock 服务能返回 SUCCESS / FAILED / RETRYABLE 三种场景

**验证方案**（伪代码）：

```typescript
// 最小验证场景
// 1. SUCCESS 场景：返回 success=true, data={...}
// 2. FAILED 场景：返回 success=false, error={...}
// 3. RETRYABLE 场景：返回 HTTP 500
```

#### 步骤 3.2：规划测试 Job 创建方式

**任务**：

1. 设计一个临时验证脚本 `apps/api/scripts/verify-s3a3-http-invoke.ts`（本批次只描述，不创建）
2. 脚本功能：
   - 直接创建一条 `NOVEL_ANALYSIS_HTTP` 类型的测试 Job
   - 不依赖 Studio UI
   - 可以通过 API 或直接操作数据库创建

**脚本设计思路**（伪代码）：

```typescript
// verify-s3a3-http-invoke.ts
// 1. 创建测试 Task
// 2. 创建测试 Job（type: 'NOVEL_ANALYSIS_HTTP'）
// 3. 等待 Worker 处理
// 4. 验证 Job 状态和结果
```

#### 步骤 3.3：验证链路隔离

**任务**：

1. 运行现有 `NOVEL_ANALYSIS` 的测试，确保行为不变
2. 运行新的 `NOVEL_ANALYSIS_HTTP` 测试，验证新链路工作正常
3. 确保两个链路完全隔离，互不影响

#### 步骤 3.4：自检

**检查项**：

- ✅ 验证链路不影响现有 `NOVEL_ANALYSIS`
- ✅ 新的 `*_HTTP` JobType 能正确调用 HTTP 引擎
- ✅ 所有三种 `EngineInvokeResult` 状态都能正确处理

---

## 4. 自检 checklist

### 4.1 封板文件保护检查

**必须确保不修改以下封板文件的既有逻辑**：

- [ ] `apps/api/src/config/engine.config.ts`
  - [ ] `getHttpEngineConfig()` 方法未被修改
  - [ ] `validateHttpEngineConfig()` 方法未被修改
  - [ ] `loadEngineConfigsFromJson()` 方法未被修改
  - [ ] 配置缓存机制未被修改

- [ ] `apps/api/src/engine/adapters/http-engine.adapter.ts`
  - [ ] `buildAuthHeaders()` 方法未被修改
  - [ ] `buildHmacHeaders()` 方法未被修改
  - [ ] `handleHttpResponse()` 的错误分类逻辑未被修改
  - [ ] `handleHttpError()` 的错误分类逻辑未被修改
  - [ ] `logRequestStart()` 方法未被修改
  - [ ] `computeBodyHash()` 方法未被修改
  - [ ] `computeHmacSignature()` 方法未被修改
  - [ ] `invoke()` 方法的接口签名未被修改

- [ ] `apps/api/config/engines.json`
  - [ ] 基础结构未被修改（只允许新增引擎配置，不允许修改现有配置）

### 4.2 现有链路保护检查

**必须确保所有与 NOVEL_ANALYSIS 相关的现有链路在改动后，行为保持一致**：

- [ ] `NOVEL_ANALYSIS` JobType 仍然映射到 `default_novel_analysis` 引擎
- [ ] `NOVEL_ANALYSIS` 的处理逻辑在 Worker 中保持不变
- [ ] 现有 `NOVEL_ANALYSIS` 的测试用例全部通过
- [ ] 现有 `NOVEL_ANALYSIS` 的业务流程不受影响

### 4.3 新增逻辑隔离检查

**必须确保所有新增逻辑都可以通过 feature flag 或 `*_HTTP` JobType 完全关停**：

- [ ] 新增的 `*_HTTP` JobType 与现有 JobType 完全隔离
- [ ] 如果实现 feature flag，必须默认关闭（`useHttpEngine: false`）
- [ ] 禁用 `*_HTTP` JobType 或 feature flag 后，系统行为与改动前完全一致

### 4.4 重试责任边界检查

**必须确保 HttpEngineAdapter 不包含任何重试逻辑**：

- [ ] `HttpEngineAdapter.invoke()` 方法中不包含任何 `for` / `while` 循环
- [ ] `HttpEngineAdapter.invoke()` 方法中不包含任何 `setTimeout` / `setInterval` / `sleep` / `delay` 调用
- [ ] 所有重试逻辑由 Job 系统（`markJobFailedAndMaybeRetry` / `processRetryJobs`）负责

### 4.5 接口兼容性检查

**必须确保所有接口变更向后兼容**：

- [ ] `EngineRegistry.findAdapter()` 的接口签名保持向后兼容（如果添加 `payload` 参数，必须为可选）
- [ ] `HttpEngineAdapter.invoke()` 的接口签名保持不变
- [ ] `EngineInvokeResult` 的类型定义保持向后兼容（只允许新增可选字段）

---

## 5. 测试与验证策略

### 5.1 最小验证方案设计

#### 5.1.1 验证脚本设计思路

**文件**：`apps/api/scripts/verify-s3a3-http-invoke.ts`（本批次只描述，不创建）

**功能**：

1. **创建测试 Job**：
   - 直接通过 API 或数据库创建一条 `NOVEL_ANALYSIS_HTTP` 类型的测试 Job
   - 不依赖 Studio UI
   - 可以指定测试场景（SUCCESS / FAILED / RETRYABLE）

2. **等待处理**：
   - 轮询 Job 状态，等待 Worker 处理完成
   - 设置超时时间，避免无限等待

3. **验证结果**：
   - 验证 Job 状态是否符合预期
   - 验证 `EngineInvokeResult` 是否正确转换
   - 验证 metrics 字段是否正确映射

**脚本结构**（伪代码）：

```typescript
// verify-s3a3-http-invoke.ts
async function main() {
  // 1. 创建测试 Job
  const job = await createTestJob({
    type: 'NOVEL_ANALYSIS_HTTP',
    payload: { ... },
  });

  // 2. 等待处理
  const result = await waitForJobCompletion(job.id);

  // 3. 验证结果
  verifyJobResult(result, expectedStatus);
}
```

#### 5.1.2 Mock HTTP 服务设计

**方案**：使用简单的 HTTP mock 服务（如 `httpbin.org` 或本地 mock 服务）

**场景覆盖**：

1. **SUCCESS 场景**：
   - 返回 HTTP 200，`{ success: true, data: {...} }`
   - 验证 `EngineInvokeResult.status === SUCCESS`
   - 验证 `output` 字段正确解析

2. **FAILED 场景**：
   - 返回 HTTP 200，`{ success: false, error: {...} }`
   - 验证 `EngineInvokeResult.status === FAILED`
   - 验证 `error` 字段正确设置

3. **RETRYABLE 场景**：
   - 返回 HTTP 500（服务器错误）
   - 验证 `EngineInvokeResult.status === RETRYABLE`
   - 验证 Job 状态转换为 `FAILED`，并设置 `retryable: true`

### 5.2 验证覆盖范围

#### 5.2.1 覆盖 SUCCESS / FAILED / RETRYABLE 三种状态

**SUCCESS 场景验证**：

- [ ] HTTP 200 + `success=true` → `EngineInvokeResult.status === SUCCESS`
- [ ] `output` 字段正确解析
- [ ] `metrics` 字段正确映射（tokens → tokensUsed, costUsd → cost）
- [ ] Job 状态更新为 `SUCCEEDED`

**FAILED 场景验证**：

- [ ] HTTP 200 + `success=false` → `EngineInvokeResult.status === FAILED`
- [ ] HTTP 400 → `EngineInvokeResult.status === FAILED`
- [ ] `error` 字段正确设置
- [ ] Job 状态更新为 `FAILED`

**RETRYABLE 场景验证**：

- [ ] HTTP 500 → `EngineInvokeResult.status === RETRYABLE`
- [ ] HTTP 429 → `EngineInvokeResult.status === RETRYABLE`
- [ ] 网络错误（ECONNRESET） → `EngineInvokeResult.status === RETRYABLE`
- [ ] Job 状态更新为 `FAILED`，并设置 `retryable: true`
- [ ] Job 重试机制正确触发

#### 5.2.2 验证 Worker 对 RETRYABLE 的处理

**验证点**：

- [ ] Worker 正确识别 `RETRYABLE` 状态
- [ ] Worker 调用 `reportJobResult(FAILED, retryable=true)`
- [ ] API 的 `markJobFailedAndMaybeRetry()` 正确标记 Job 为 `RETRYING`
- [ ] Orchestrator 的 `processRetryJobs()` 正确将 `RETRYING` Job 放回 `PENDING` 队列
- [ ] Worker 再次拉取 Job 并重试

### 5.3 回归测试策略

#### 5.3.1 现有功能回归

**测试范围**：

- [ ] 运行现有 `NOVEL_ANALYSIS` 的所有测试用例
- [ ] 验证现有业务流程不受影响
- [ ] 验证现有 API 接口行为不变

#### 5.3.2 新功能隔离测试

**测试范围**：

- [ ] 测试 `NOVEL_ANALYSIS_HTTP` JobType 的完整调用链路
- [ ] 测试 `SHOT_RENDER_HTTP` JobType 的完整调用链路（如果实现）
- [ ] 验证新功能不影响现有功能

### 5.4 性能与稳定性验证

**验证点**：

- [ ] HTTP 请求超时处理正确（使用 S3-A.1 配置的 `timeoutMs`）
- [ ] 并发请求不会相互干扰
- [ ] 大量 RETRYABLE 错误不会导致系统阻塞
- [ ] 日志脱敏机制正常工作（API Key 不泄露）

---

## 6. 风险与注意事项

### 6.1 实现风险

1. **新 JobType 与现有 JobType 的隔离风险**：
   - **风险**：如果映射逻辑错误，可能影响现有 JobType
   - **缓解**：严格遵循约束，只新增 `*_HTTP` JobType，不修改现有映射

2. **HTTP 请求 payload 结构不匹配风险**：
   - **风险**：外部 HTTP 服务期望的 payload 结构与实际发送的不匹配
   - **缓解**：在实现前明确外部服务的 API 文档，确保 payload 结构正确

3. **响应数据解析错误风险**：
   - **风险**：外部服务的响应格式与预期不符，导致解析失败
   - **缓解**：实现健壮的响应解析逻辑，支持多种响应格式

### 6.2 注意事项

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

## 7. 总结

### 7.1 实现要点回顾

1. **JobType 映射**：扩展 `EngineRegistry.getDefaultEngineKeyForJobType()`，新增 `*_HTTP` JobType 映射
2. **请求构造**：在 `HttpEngineAdapter` 中新增 `buildRequestBody()` 方法，构造 HTTP 请求 Body
3. **响应解析**：在 `HttpEngineAdapter` 中新增 `parseResponseData()` 和 `parseMetrics()` 方法，解析响应数据
4. **Worker 集成**：在 Worker 中扩展 `EngineInvokeInput` 构造和 Job 状态更新逻辑
5. **边界控制**：严格遵循 S3-A.1 的封板约束，不修改认证和错误分类逻辑

### 7.2 与前置文档的对齐

- ✅ 遵循 `ENGINE_HTTP_CONFIG.md` 的配置和安全约束
- ✅ 遵循 `ENGINE_HTTP_INVOKE_DESIGN.md` 的设计方案
- ✅ 遵循 `S3A1_REVIEW_REPORT.md` 的封板约束
- ✅ 不修改 NOVEL_ANALYSIS 现有链路
- ✅ 不修改 S3-A.1 已封板的实现

### 7.3 下一步行动

1. **评审本文档**：确认实现计划和执行步骤
2. **进入 MODE: EXECUTE**：按照阶段 1 → 阶段 2 → 阶段 3 的顺序实施
3. **自检与验证**：每个阶段完成后进行自检，确保符合 checklist
4. **生成 REVIEW 报告**：实现完成后生成 S3-A.3 REVIEW 报告

---

**文档状态**: ✅ 实现计划完成，待评审  
**前置文档**:

- [ENGINE_HTTP_CONFIG.md](./ENGINE_HTTP_CONFIG.md) (S3-A.1)
- [ENGINE_HTTP_INVOKE_DESIGN.md](./ENGINE_HTTP_INVOKE_DESIGN.md) (S3-A.2)
- [S3A1_REVIEW_REPORT.md](./S3A1_REVIEW_REPORT.md) (S3-A.1 封板报告)  
  **后续批次**: S3-B.1（Engine 管理 API）或 S3-C.1（Studio/导入页联动增强）
