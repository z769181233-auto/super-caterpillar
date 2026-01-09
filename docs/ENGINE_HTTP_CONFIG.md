# HTTP 引擎配置与安全设计文档

**文档版本**: V1.0  
**生成时间**: 2024-12-11  
**对应批次**: S3-A.1  
**规划文档**: [STAGE3_PLAN.md](./STAGE3_PLAN.md)

---

## 1. 背景与目标

### 1.1 背景

在 Stage2 中，我们已经实现了 `HttpEngineAdapter` 的基础框架，支持通过 HTTP 协议调用外部引擎服务。在 Stage3 中，我们需要完善 HTTP 引擎的配置与安全机制，使其能够安全、可靠地接入真实的 LLM 服务（本地推理服务 / 云端 HTTP 模型）。

### 1.2 设计目标

1. **配置管理**: 设计统一、灵活的 HTTP 引擎配置方案，支持多引擎配置
2. **安全认证**: 支持多种认证方式（Bearer Token / API Key / HMAC），确保 API Key 安全
3. **错误处理**: 明确错误分类规则，确保与 Job 重试系统协调工作
4. **限流处理**: 正确处理外部服务的限流响应，避免系统阻塞
5. **向后兼容**: 不破坏 Stage2 已有的稳定实现

### 1.3 设计范围

- ✅ 环境变量配置方案
- ✅ EngineConfig 结构定义（JSON 配置文件方案）
- ✅ 认证方式设计
- ✅ 错误分类与重试策略
- ✅ 限流与安全要求
- ❌ 不包含：HTTP 引擎调用路径设计（由 S3-A.2 负责）
- ❌ 不包含：Engine 管理 API 设计（由 S3-B.1 负责）

---

## 2. 不动边界（引用 STAGE3_PLAN 的约束）

### 2.1 核心约束

本设计严格遵循 [STAGE3_PLAN.md](./STAGE3_PLAN.md) 中的约束：

1. **禁止修改 NOVEL_ANALYSIS 现有执行链路**:
   - ❌ 禁止修改 `apps/api/src/novel-import/novel-import.controller.ts` 的核心导入逻辑
   - ❌ 禁止修改 `apps/workers/src/novel-analysis-processor.ts` 的分析处理逻辑
   - ❌ 禁止修改 NOVEL_ANALYSIS 的默认引擎绑定（仍使用 `default_novel_analysis` 本地适配器）

2. **HTTP 引擎接入仅允许通过以下两种方式**:
   - **方式 1**: 新增实验性 JobType（例如 `EXPERIMENTAL_NOVEL_ANALYSIS_HTTP`、`EXPERIMENTAL_SHOT_RENDER_HTTP`）
   - **方式 2**: 通过显式 feature flag（例如 `useHttpEngine: true`），且**默认关闭**

3. **Feature Flag 生效位置**:
   - Feature flag 在**创建 Job 时决定**（Task/Job payload 中设置）
   - **执行过程中不自动切换**引擎（Job 的 engineKey 已固化在 payload 中）

### 2.2 本设计不改变什么

- ❌ **不改变** `EngineAdapter` 接口定义（`packages/shared-types/src/engines/engine-adapter.ts`）
- ❌ **不改变** `EngineRegistry` 核心逻辑（适配器注册、查找机制）
- ❌ **不改变** Job 状态机（PENDING → RUNNING → RETRYING/FAILED）
- ❌ **不改变** `schema.prisma`（除非采用方案 B 新增 EngineConfig 表）
- ❌ **不改变** `HttpEngineAdapter.invoke()` 的接口签名
- ✅ **仅扩展** `EngineConfigService.getHttpEngineConfig()` 支持多引擎配置
- ✅ **仅增强** `HttpEngineAdapter` 的认证和错误处理逻辑

---

## 3. 配置总览

### 3.1 配置来源优先级

HTTP 引擎配置的读取优先级（从高到低）：

1. **环境变量**（最高优先级）
   - 用于存储敏感信息（API Key / Token）
   - 用于覆盖默认配置
   - 格式：`HTTP_ENGINE_*` 或 `ENGINE_HTTP_*`（保持向后兼容）

2. **JSON 配置文件**（`config/engines.json`）
   - 用于存储非敏感的引擎配置
   - 支持多引擎配置（engineKey → config 映射）
   - 格式：JSON 数组，每个元素为一个引擎配置

3. **代码中的硬编码默认值**（最低优先级）
   - 仅作为兜底值
   - 例如：`baseUrl: 'http://localhost:8000'`, `timeoutMs: 30000`

### 3.2 配置读取流程

```
1. HttpEngineAdapter.invoke(engineKey)
   ↓
2. EngineConfigService.getHttpEngineConfig(engineKey)
   ↓
3. 读取优先级：
   a. 环境变量（HTTP_ENGINE_{engineKey}_BASE_URL 等）
   b. JSON 配置文件（config/engines.json 中 engineKey 对应的配置）
   c. 硬编码默认值
   ↓
4. 返回 HttpEngineConfig 对象
   ↓
5. HttpEngineAdapter 使用配置构造 HTTP 请求
```

### 3.3 配置作用域

- **全局配置**: 适用于所有 HTTP 引擎（如 `HTTP_ENGINE_TIMEOUT_MS`）
- **引擎级配置**: 针对特定 engineKey 的配置（如 `HTTP_ENGINE_GEMINI_V1_BASE_URL`）
- **混合模式**: 全局配置 + 引擎级覆盖（推荐）

---

## 4. 环境变量详细说明

### 4.1 环境变量列表

| 变量名                               | 类型   | 默认值                  | 必填 | 生效位置              | 说明                                                                       |
| ------------------------------------ | ------ | ----------------------- | ---- | --------------------- | -------------------------------------------------------------------------- |
| `HTTP_ENGINE_BASE_URL`               | string | `http://localhost:8000` | ❌   | `EngineConfigService` | 全局 HTTP 引擎基础 URL（向后兼容：`ENGINE_HTTP_BASE_URL`）                 |
| `HTTP_ENGINE_API_KEY`                | string | -                       | ❌   | `EngineConfigService` | 全局 API Key（用于 Bearer Token 认证，向后兼容：`ENGINE_HTTP_AUTH_TOKEN`） |
| `HTTP_ENGINE_TIMEOUT_MS`             | number | `30000`                 | ❌   | `EngineConfigService` | 全局 HTTP 请求超时时间（毫秒，向后兼容：`ENGINE_HTTP_TIMEOUT_MS`）         |
| `HTTP_ENGINE_PATH`                   | string | `/invoke`               | ❌   | `EngineConfigService` | 全局 HTTP 引擎调用路径（向后兼容：`ENGINE_HTTP_PATH`）                     |
| `HTTP_ENGINE_RETRY_MAX`              | number | `3`                     | ❌   | 文档说明              | 最大重试次数（由 Job 重试机制控制，不在 Adapter 中使用）                   |
| `HTTP_ENGINE_{engineKey}_BASE_URL`   | string | 继承全局                | ❌   | `EngineConfigService` | 特定引擎的基础 URL（如 `HTTP_ENGINE_GEMINI_V1_BASE_URL`）                  |
| `HTTP_ENGINE_{engineKey}_API_KEY`    | string | 继承全局                | ❌   | `EngineConfigService` | 特定引擎的 API Key（如 `HTTP_ENGINE_GEMINI_V1_API_KEY`）                   |
| `HTTP_ENGINE_{engineKey}_TIMEOUT_MS` | number | 继承全局                | ❌   | `EngineConfigService` | 特定引擎的超时时间（如 `HTTP_ENGINE_GEMINI_V1_TIMEOUT_MS`）                |
| `HTTP_ENGINE_{engineKey}_PATH`       | string | 继承全局                | ❌   | `EngineConfigService` | 特定引擎的调用路径（如 `HTTP_ENGINE_GEMINI_V1_PATH`）                      |

### 4.2 环境变量命名规则

- **全局配置**: `HTTP_ENGINE_*`（推荐）或 `ENGINE_HTTP_*`（向后兼容）
- **引擎级配置**: `HTTP_ENGINE_{engineKey}_*`，其中 `{engineKey}` 为大写，连字符替换为下划线
  - 例如：`http_gemini_v1` → `HTTP_ENGINE_GEMINI_V1_BASE_URL`
  - 例如：`http_openai_gpt4` → `HTTP_ENGINE_OPENAI_GPT4_BASE_URL`

### 4.3 环境变量示例

```bash
# 全局配置（适用于所有 HTTP 引擎）
HTTP_ENGINE_BASE_URL=https://api.example.com
HTTP_ENGINE_API_KEY=sk-xxxxxxxxxxxxx
HTTP_ENGINE_TIMEOUT_MS=30000
HTTP_ENGINE_PATH=/invoke

# 引擎级配置（覆盖全局配置）
HTTP_ENGINE_GEMINI_V1_BASE_URL=https://api.gemini.com
HTTP_ENGINE_GEMINI_V1_API_KEY=AIzaSyxxxxxxxxxxxxx
HTTP_ENGINE_GEMINI_V1_TIMEOUT_MS=60000
HTTP_ENGINE_GEMINI_V1_PATH=/v1/invoke

HTTP_ENGINE_OPENAI_GPT4_BASE_URL=https://api.openai.com
HTTP_ENGINE_OPENAI_GPT4_API_KEY=sk-xxxxxxxxxxxxx
HTTP_ENGINE_OPENAI_GPT4_PATH=/v1/chat/completions
```

---

## 5. EngineConfig 结构定义

### 5.1 TypeScript 接口定义

```typescript
/**
 * HTTP 引擎配置（HttpEngineConfig）
 * 用于 HttpEngineAdapter 构造 HTTP 请求
 */
export interface HttpEngineConfig {
  baseUrl: string; // HTTP 基础 URL（必填）
  timeoutMs: number; // 超时时间（毫秒，必填）
  path?: string; // 调用路径（可选，默认 '/invoke'）
  authToken?: string; // 认证 Token（可选，用于 Bearer Token）
  apiKey?: string; // API Key（可选，用于 X-API-Key Header）
}

/**
 * 引擎配置（EngineConfig）
 * 完整的引擎配置结构，用于 JSON 配置文件
 */
export interface EngineConfig {
  engineKey: string; // 引擎标识（必填，唯一）
  adapterName: string; // 适配器名称（必填，如 'http'）
  adapterType: 'local' | 'http'; // 适配器类型（必填）

  // HTTP 配置（仅当 adapterType='http' 时使用）
  httpConfig?: {
    baseUrl: string; // HTTP 基础 URL
    path?: string; // 调用路径（默认 '/invoke'）
    timeoutMs?: number; // 超时时间（毫秒，默认 30000）
    // 注意：authToken 和 apiKey 不应出现在 JSON 文件中，只从环境变量读取
  };

  // 模型信息（可选）
  modelInfo?: {
    modelName?: string; // 模型名称（如 'gemini-pro'）
    version?: string; // 模型版本（如 'v1.0'）
  };

  // 默认引擎配置
  isDefault?: boolean; // 是否为全局默认引擎
  isDefaultForJobTypes?: Record<string, boolean>; // 按 JobType 的默认引擎映射

  // 启用状态
  enabled: boolean; // 是否启用（默认 true）

  // 元数据
  createdAt?: string; // 创建时间（ISO 字符串）
  updatedAt?: string; // 更新时间（ISO 字符串）
}
```

### 5.2 JSON 配置文件示例

**文件路径**: `config/engines.json`

```json
{
  "engines": [
    {
      "engineKey": "default_novel_analysis",
      "adapterName": "default_novel_analysis",
      "adapterType": "local",
      "isDefaultForJobTypes": {
        "NOVEL_ANALYSIS": true
      },
      "enabled": true
    },
    {
      "engineKey": "http_gemini_v1",
      "adapterName": "http",
      "adapterType": "http",
      "httpConfig": {
        "baseUrl": "https://api.gemini.com",
        "path": "/v1/invoke",
        "timeoutMs": 60000
      },
      "modelInfo": {
        "modelName": "gemini-pro",
        "version": "v1.0"
      },
      "enabled": true
    },
    {
      "engineKey": "http_openai_gpt4",
      "adapterName": "http",
      "adapterType": "http",
      "httpConfig": {
        "baseUrl": "https://api.openai.com",
        "path": "/v1/chat/completions",
        "timeoutMs": 30000
      },
      "modelInfo": {
        "modelName": "gpt-4",
        "version": "v1.0"
      },
      "enabled": true
    },
    {
      "engineKey": "http_local_llm",
      "adapterName": "http",
      "adapterType": "http",
      "httpConfig": {
        "baseUrl": "http://localhost:11434",
        "path": "/api/generate",
        "timeoutMs": 120000
      },
      "modelInfo": {
        "modelName": "llama2",
        "version": "v1.0"
      },
      "enabled": true
    }
  ]
}
```

### 5.3 配置优先级规则

1. **环境变量优先于 JSON 文件**:
   - 如果 `HTTP_ENGINE_GEMINI_V1_BASE_URL` 存在，则覆盖 JSON 文件中的 `httpConfig.baseUrl`
   - 如果 `HTTP_ENGINE_GEMINI_V1_API_KEY` 存在，则覆盖 JSON 文件中的 `httpConfig.authToken`（如果存在）

2. **JSON 文件优先于代码中的硬编码默认值**:
   - 如果 JSON 文件中定义了 `httpConfig.baseUrl`，则使用该值
   - 如果 JSON 文件中未定义，则使用代码中的默认值（如 `http://localhost:8000`）

3. **引擎级配置优先于全局配置**:
   - 如果 `HTTP_ENGINE_GEMINI_V1_BASE_URL` 存在，则使用该值
   - 否则使用 `HTTP_ENGINE_BASE_URL`
   - 否则使用 JSON 文件中的配置
   - 否则使用硬编码默认值

### 5.4 配置读取逻辑（伪代码）

```typescript
// EngineConfigService.getHttpEngineConfig(engineKey: string): HttpEngineConfig
function getHttpEngineConfig(engineKey: string): HttpEngineConfig {
  // 1. 读取引擎级环境变量（优先级最高）
  const engineEnvBaseUrl =
    process.env[`HTTP_ENGINE_${engineKey.toUpperCase().replace(/-/g, '_')}_BASE_URL`];
  const engineEnvApiKey =
    process.env[`HTTP_ENGINE_${engineKey.toUpperCase().replace(/-/g, '_')}_API_KEY`];
  const engineEnvTimeout =
    process.env[`HTTP_ENGINE_${engineKey.toUpperCase().replace(/-/g, '_')}_TIMEOUT_MS`];
  const engineEnvPath =
    process.env[`HTTP_ENGINE_${engineKey.toUpperCase().replace(/-/g, '_')}_PATH`];

  // 2. 读取全局环境变量（次优先级）
  const globalEnvBaseUrl = process.env.HTTP_ENGINE_BASE_URL || process.env.ENGINE_HTTP_BASE_URL;
  const globalEnvApiKey = process.env.HTTP_ENGINE_API_KEY || process.env.ENGINE_HTTP_AUTH_TOKEN;
  const globalEnvTimeout = process.env.HTTP_ENGINE_TIMEOUT_MS || process.env.ENGINE_HTTP_TIMEOUT_MS;
  const globalEnvPath = process.env.HTTP_ENGINE_PATH || process.env.ENGINE_HTTP_PATH;

  // 3. 读取 JSON 配置文件（再次优先级）
  const jsonConfig = loadEngineConfigFromJson(engineKey);

  // 4. 合并配置（按优先级）
  return {
    baseUrl:
      engineEnvBaseUrl ||
      globalEnvBaseUrl ||
      jsonConfig?.httpConfig?.baseUrl ||
      'http://localhost:8000',
    timeoutMs: parseInt(
      engineEnvTimeout || globalEnvTimeout || String(jsonConfig?.httpConfig?.timeoutMs || 30000),
      10
    ),
    path: engineEnvPath || globalEnvPath || jsonConfig?.httpConfig?.path || '/invoke',
    authToken: engineEnvApiKey || globalEnvApiKey, // 只从环境变量读取，不从 JSON 读取
    apiKey: engineEnvApiKey || globalEnvApiKey, // 只从环境变量读取，不从 JSON 读取
  };
}
```

---

## 6. 认证方式设计

### 6.1 支持的认证方式

#### 方式 1: Bearer Token（推荐）

- **Header 格式**: `Authorization: Bearer ${TOKEN}`
- **配置来源**: 环境变量 `HTTP_ENGINE_API_KEY` 或 `HTTP_ENGINE_{engineKey}_API_KEY`
- **使用场景**: 大多数现代 API 服务（OpenAI, Gemini, Anthropic 等）

**实现逻辑**（伪代码）:

```typescript
// 在 HttpEngineAdapter.invoke() 中
const headers: Record<string, string> = {};
if (config.authToken) {
  headers['Authorization'] = `Bearer ${config.authToken}`;
}
```

#### 方式 2: X-API-Key Header（可选）

- **Header 格式**: `X-API-Key: ${API_KEY}`
- **配置来源**: 环境变量 `HTTP_ENGINE_API_KEY` 或 `HTTP_ENGINE_{engineKey}_API_KEY`
- **使用场景**: 部分 API 服务要求使用 `X-API-Key` 而非 `Authorization`

**实现逻辑**（伪代码）:

```typescript
// 在 HttpEngineConfig 中增加 authType 字段（可选）
// 如果 authType === 'api-key'，则使用 X-API-Key Header
if (config.apiKey && config.authType === 'api-key') {
  headers['X-API-Key'] = config.apiKey;
}
```

#### 方式 3: HMAC 签名（预留，未来扩展）

- **Header 格式**: `X-Signature: ${HMAC_SIGNATURE}`, `X-Timestamp: ${TIMESTAMP}`, `X-Nonce: ${NONCE}`
- **配置来源**: 环境变量 `HTTP_ENGINE_{engineKey}_HMAC_SECRET`
- **使用场景**: 需要签名验证的 API 服务
- **实现方式**: 复用现有的 HMAC 签名机制（参考 `HmacSignatureInterceptor`）

**注意**: HMAC 签名不在 MVP 范围，仅预留接口，后续扩展。

### 6.2 认证配置优先级

1. **引擎级环境变量**（最高优先级）:
   - `HTTP_ENGINE_{engineKey}_API_KEY` → 用于该引擎的认证

2. **全局环境变量**（次优先级）:
   - `HTTP_ENGINE_API_KEY` → 用于所有 HTTP 引擎的认证

3. **JSON 配置文件**（不支持）:
   - ❌ **禁止**在 JSON 文件中存储 API Key / Token
   - ✅ JSON 文件中可以包含占位符（如 `"authToken": "${HTTP_ENGINE_API_KEY}"`），但实际值必须从环境变量读取

### 6.3 认证 Header 拼装规则

**在 HttpEngineAdapter 中的实现**（伪代码）:

```typescript
// HttpEngineAdapter.invoke() 方法中
const headers: Record<string, string> = {};

// 1. Bearer Token（优先）
if (config.authToken) {
  headers['Authorization'] = `Bearer ${config.authToken}`;
}

// 2. X-API-Key（如果指定了 authType='api-key'）
if (config.apiKey && config.authType === 'api-key') {
  headers['X-API-Key'] = config.apiKey;
  // 如果同时有 Bearer Token，优先使用 Bearer Token
  if (!config.authToken) {
    // 仅在没有 Bearer Token 时使用 X-API-Key
  }
}

// 3. HMAC 签名（未来扩展）
if (config.hmacSecret) {
  const signature = generateHmacSignature(requestBody, config.hmacSecret);
  headers['X-Signature'] = signature;
  headers['X-Timestamp'] = String(Date.now());
  headers['X-Nonce'] = generateNonce();
}
```

---

## 7. 错误分类与重试策略

### 7.1 HttpEngineAdapter 的唯一职责

**重要约束**: HttpEngineAdapter 内部**只允许一次请求 + 错误分类**，禁止实现重试逻辑。

- ✅ **允许**: 发送一次 HTTP 请求
- ✅ **允许**: 根据返回/错误分类为 `SUCCESS` / `FAILED` / `RETRYABLE`
- ❌ **禁止**: 在 Adapter 内部实现重试循环
- ❌ **禁止**: 在 Adapter 内部实现退避策略（exponential backoff）
- ❌ **禁止**: 在 Adapter 内部实现 sleep / delay

**所有重试必须由 Job 重试系统处理**（参考 [STAGE2_REGRESSION_CHECKLIST.md](./STAGE2_REGRESSION_CHECKLIST.md) 中的 S2-A 章节）。

### 7.2 错误分类规则

#### 规则 1: 网络错误 → RETRYABLE

**错误类型**:

- `ECONNRESET` - 连接被重置
- `ETIMEDOUT` - 连接超时
- `ENETUNREACH` - 网络不可达
- `ECONNREFUSED` - 连接被拒绝
- `EHOSTUNREACH` - 主机不可达
- `EAI_AGAIN` - DNS 解析失败（临时）

**分类结果**: `EngineInvokeStatus.RETRYABLE`

**理由**: 网络错误通常是临时性的，可以通过重试解决。

#### 规则 2: HTTP 5xx 错误 → RETRYABLE

**HTTP 状态码**: `500`, `502`, `503`, `504`, `507`, `508` 等

**分类结果**: `EngineInvokeStatus.RETRYABLE`

**理由**: 服务器错误通常是临时性的，可以通过重试解决。

#### 规则 3: HTTP 4xx 错误 → FAILED

**HTTP 状态码**: `400`, `401`, `403`, `404`, `422`, `429`（特殊处理，见规则 4）等

**分类结果**: `EngineInvokeStatus.FAILED`（429 除外）

**理由**: 客户端错误通常是永久性的，重试不会解决问题。

**例外**: HTTP 429（限流）需要特殊处理（见规则 4）。

#### 规则 4: HTTP 429（限流）→ RETRYABLE

**HTTP 状态码**: `429 Too Many Requests`

**分类结果**: `EngineInvokeStatus.RETRYABLE`

**理由**: 限流是临时性的，可以通过重试解决（依赖 Job 重试系统的退避策略）。

**日志要求**: 记录专门的限流日志字段（见 8.1 节）。

#### 规则 5: 业务层错误 → FAILED

**判断条件**:

- HTTP 状态码为 2xx，但 `response.success === false`
- HTTP 状态码为 2xx，但 `response.error` 字段存在

**分类结果**: `EngineInvokeStatus.FAILED`

**理由**: 业务层错误通常是永久性的（如参数错误、业务逻辑错误），重试不会解决问题。

### 7.3 错误分类实现逻辑（伪代码）

```typescript
// HttpEngineAdapter.invoke() 方法中的错误处理
try {
  const response = await httpClient.post(url, requestBody);

  // 1. 检查 HTTP 状态码
  if (response.status >= 200 && response.status < 300) {
    // 2. 检查业务层成功标志
    if (response.data.success === true || response.data.status === 'SUCCESS') {
      return { status: EngineInvokeStatus.SUCCESS, output: response.data.data };
    } else {
      // 业务层错误 → FAILED
      return { status: EngineInvokeStatus.FAILED, error: { ... } };
    }
  } else if (response.status === 429) {
    // 限流 → RETRYABLE
    return { status: EngineInvokeStatus.RETRYABLE, error: { code: 'HTTP_RATE_LIMIT', ... } };
  } else if (response.status >= 500) {
    // 5xx → RETRYABLE
    return { status: EngineInvokeStatus.RETRYABLE, error: { code: 'HTTP_SERVER_ERROR', ... } };
  } else {
    // 4xx（除 429）→ FAILED
    return { status: EngineInvokeStatus.FAILED, error: { code: 'HTTP_CLIENT_ERROR', ... } };
  }
} catch (error) {
  // 3. 检查网络错误
  if (error.type === 'NETWORK_ERROR') {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'ECONNREFUSED', 'EHOSTUNREACH', 'EAI_AGAIN'];
    if (retryableCodes.includes(error.code)) {
      // 网络错误 → RETRYABLE
      return { status: EngineInvokeStatus.RETRYABLE, error: { code: 'HTTP_TEMPORARY_ERROR', ... } };
    }
  }

  // 其他错误 → FAILED
  return { status: EngineInvokeStatus.FAILED, error: { code: 'HTTP_UNKNOWN_ERROR', ... } };
}
```

### 7.4 与 Job 重试系统的协调

**Job 重试系统**（参考 STAGE2_REGRESSION_CHECKLIST.md）:

- `getAndMarkNextPendingJob()`: 从 PENDING/RETRYING 状态领取 Job
- `markJobFailedAndMaybeRetry()`: 将 RUNNING Job 标记为 RETRYING 或 FAILED
- `processRetryJobs()`: 将到期的 RETRYING Job 放回 PENDING 队列

**HttpEngineAdapter 的配合**:

1. 返回 `RETRYABLE` → Worker 调用 `markJobFailedAndMaybeRetry()` → Job 状态变为 `RETRYING`
2. Job 重试系统在下次调度时，将 `RETRYING` Job 放回 `PENDING` 队列
3. Worker 再次拉取该 Job → 再次调用 `HttpEngineAdapter.invoke()` → 重试

**重试次数控制**:

- 由 Job 的 `maxRetry` 字段控制（不在 HttpEngineAdapter 中控制）
- 如果达到 `maxRetry`，Job 状态变为 `FAILED`，不再重试

---

## 8. 限流与安全要求

### 8.1 限流处理（HTTP 429）

#### 处理策略

1. **分类为 RETRYABLE**:
   - HTTP 429 响应 → `EngineInvokeStatus.RETRYABLE`
   - 依赖 Job 重试系统进行重试

2. **日志记录**:
   - 记录专门的限流日志字段（只写文档，不写代码）:
     ```json
     {
       "event": "HTTP_ENGINE_INVOKE_RATE_LIMIT",
       "engineKey": "http_gemini_v1",
       "jobType": "NOVEL_ANALYSIS",
       "status": "RETRYABLE",
       "httpStatusCode": 429,
       "retryAfter": "60", // 如果响应头中有 Retry-After
       "durationMs": 1234,
       "timestamp": "2024-12-11T10:30:00.000Z"
     }
     ```

3. **Retry-After Header**:
   - 如果 HTTP 429 响应中包含 `Retry-After` Header，记录到日志中
   - **不在 Adapter 中实现延迟逻辑**，由 Job 重试系统控制重试时机

#### 限流日志字段说明

| 字段             | 类型   | 说明                                   |
| ---------------- | ------ | -------------------------------------- |
| `event`          | string | 固定值 `HTTP_ENGINE_INVOKE_RATE_LIMIT` |
| `engineKey`      | string | 引擎标识                               |
| `jobType`        | string | Job 类型                               |
| `status`         | string | 固定值 `RETRYABLE`                     |
| `httpStatusCode` | number | 固定值 `429`                           |
| `retryAfter`     | string | Retry-After Header 的值（如果存在）    |
| `durationMs`     | number | 请求耗时（毫秒）                       |
| `timestamp`      | string | 时间戳（ISO 格式）                     |

### 8.2 安全要求

#### 要求 1: API Key / Token 必须只来自环境变量

- ✅ **允许**: 从环境变量读取 API Key / Token
- ❌ **禁止**: 在 JSON 配置文件中存储真实的 API Key / Token
- ❌ **禁止**: 在代码中硬编码 API Key / Token
- ❌ **禁止**: 将 API Key / Token 提交到代码仓库

#### 要求 2: JSON 配置文件中的占位符

如果 JSON 配置文件中需要引用环境变量，可以使用占位符：

```json
{
  "engineKey": "http_gemini_v1",
  "httpConfig": {
    "baseUrl": "https://api.gemini.com",
    "authToken": "${HTTP_ENGINE_GEMINI_V1_API_KEY}" // 占位符，实际值从环境变量读取
  }
}
```

**实现要求**: `EngineConfigService` 在读取 JSON 配置时，如果发现 `${...}` 格式的占位符，应从环境变量中读取实际值。

#### 要求 3: 环境变量验证

在 `EngineConfigService.getHttpEngineConfig()` 中，应验证：

- `baseUrl` 必须是有效的 URL 格式
- `timeoutMs` 必须是正整数
- `path` 必须以 `/` 开头
- 如果 `authToken` 或 `apiKey` 存在，不应为空字符串

#### 要求 4: 敏感信息日志

- ❌ **禁止**: 在日志中输出完整的 API Key / Token
- ✅ **允许**: 在日志中输出 API Key / Token 的前 4 位和后 4 位（用于调试）
- ✅ **允许**: 在日志中输出 API Key / Token 的长度（用于验证）

**日志示例**:

```json
{
  "event": "HTTP_ENGINE_INVOKE_START",
  "engineKey": "http_gemini_v1",
  "hasAuthToken": true,
  "authTokenPrefix": "AIza", // 仅显示前 4 位
  "authTokenLength": 39 // 显示长度
}
```

### 8.3 传输安全

- **HTTPS**: 生产环境必须使用 HTTPS（`baseUrl` 以 `https://` 开头）
- **TLS 验证**: 使用默认的 TLS 证书验证（不跳过证书验证）
- **加密传输**: API Key / Token 通过 HTTPS 加密传输，不在 URL 参数中传递

---

## 9. 与现有系统的集成点

### 9.1 HttpEngineAdapter 集成

**文件**: `apps/api/src/engine/adapters/http-engine.adapter.ts`

**需要修改的点**:

1. **配置读取**: 调用 `EngineConfigService.getHttpEngineConfig(engineKey)` 获取配置
2. **认证 Header**: 根据配置中的 `authToken` 或 `apiKey` 构造 Header
3. **错误分类**: 根据错误类型返回 `SUCCESS` / `FAILED` / `RETRYABLE`
4. **日志记录**: 记录结构化日志（包含限流日志）

**不修改的点**:

- ❌ 不修改 `invoke()` 方法的接口签名
- ❌ 不修改 `supports()` 方法的逻辑
- ❌ 不添加重试逻辑

### 9.2 EngineConfigService 集成

**文件**: `apps/api/src/config/engine.config.ts`

**需要扩展的点**:

1. **多引擎配置支持**: 支持根据 `engineKey` 读取不同的配置
2. **JSON 配置文件读取**: 实现从 `config/engines.json` 读取配置
3. **环境变量优先级**: 实现环境变量优先于 JSON 文件的优先级逻辑
4. **配置验证**: 实现配置验证逻辑（URL 格式、超时时间等）

**新增方法**（伪代码）:

```typescript
// 读取 JSON 配置文件
private loadEngineConfigsFromJson(): EngineConfig[] { ... }

// 根据 engineKey 查找配置
private findEngineConfigByKey(engineKey: string): EngineConfig | null { ... }

// 合并环境变量和 JSON 配置
private mergeConfig(engineKey: string, jsonConfig: EngineConfig | null): HttpEngineConfig { ... }
```

### 9.3 EngineRegistry 集成

**文件**: `apps/api/src/engine/engine-registry.service.ts`

**不修改的点**:

- ❌ 不修改 `findAdapter()` 方法
- ❌ 不修改 `getAdapter()` 方法
- ❌ 不修改适配器注册逻辑

**依赖关系**:

- `HttpEngineAdapter` 依赖 `EngineConfigService` 读取配置
- `EngineRegistry` 注册 `HttpEngineAdapter` 时，`HttpEngineAdapter` 已注入 `EngineConfigService`

### 9.4 Job 系统集成

**文件**: `apps/api/src/job/job.service.ts`

**不修改的点**:

- ❌ 不修改 `getAndMarkNextPendingJob()` 方法
- ❌ 不修改 `markJobFailedAndMaybeRetry()` 方法
- ❌ 不修改 Job 状态流转逻辑

**配合关系**:

- `HttpEngineAdapter.invoke()` 返回 `RETRYABLE` → Worker 调用 `markJobFailedAndMaybeRetry()` → Job 状态变为 `RETRYING`
- Job 重试系统在下次调度时，将 `RETRYING` Job 放回 `PENDING` 队列，实现重试

---

## 10. 风险与后续扩展

### 10.1 风险点

#### 风险 1: 外部服务不可用

- **风险**: HTTP 引擎服务不可用或响应慢，导致大量 Job 进入重试队列
- **缓解**:
  - 设置合理的超时时间（默认 30s，可根据引擎调整）
  - 监控外部服务的可用性和响应时间
  - 实现熔断机制（可选，不在 MVP 范围）

#### 风险 2: API Key 泄露

- **风险**: API Key 存储在环境变量或配置文件中，可能泄露
- **缓解**:
  - 使用环境变量存储敏感信息，不提交到代码仓库
  - 在配置文档中明确安全要求
  - 后续考虑使用密钥管理服务（不在 MVP 范围）

#### 风险 3: 配置更新需要重启

- **风险**: 使用 JSON 配置文件方案，配置更新需要重启服务
- **缓解**:
  - MVP 阶段接受此限制
  - 后续可迁移到数据库表方案（方案 B），支持动态配置更新

#### 风险 4: 多引擎配置复杂度

- **风险**: 随着引擎数量增加，环境变量和 JSON 配置可能变得复杂
- **缓解**:
  - 使用统一的命名规则（`HTTP_ENGINE_{engineKey}_*`）
  - 提供配置示例和文档
  - 后续考虑实现配置管理 API（S3-B.1）

### 10.2 后续扩展

#### 扩展 1: 配置热加载

- **目标**: 支持在不重启服务的情况下更新配置
- **实现**: 实现配置文件的 watch 机制，检测到文件变化时重新加载配置
- **范围**: 不在 MVP 范围，后续扩展

#### 扩展 2: 配置管理 API

- **目标**: 通过 API 动态管理引擎配置
- **实现**: 参考 S3-B.1 Engine 管理 API 设计
- **范围**: 不在 MVP 范围，由 S3-B.1 负责

#### 扩展 3: 多租户配置

- **目标**: 支持按项目/租户配置不同的引擎
- **实现**: 在 `EngineConfig` 中增加 `projectId` 或 `tenantId` 字段
- **范围**: 不在 MVP 范围，后续扩展

#### 扩展 4: 配置版本管理

- **目标**: 支持配置的版本管理和回滚
- **实现**: 在数据库表方案中增加 `version` 字段
- **范围**: 不在 MVP 范围，后续扩展

#### 扩展 5: 熔断机制

- **目标**: 当外部服务连续失败时，自动熔断，避免大量重试
- **实现**: 实现熔断器模式（Circuit Breaker Pattern）
- **范围**: 不在 MVP 范围，后续扩展

---

## 11. 总结

### 11.1 设计要点回顾

1. **配置优先级**: 环境变量 > JSON 文件 > 硬编码默认值
2. **认证方式**: Bearer Token（推荐）、X-API-Key（可选）、HMAC（预留）
3. **错误分类**: 网络错误/5xx/429 → RETRYABLE，4xx/业务错误 → FAILED
4. **重试策略**: HttpEngineAdapter 只做一次请求 + 错误分类，重试由 Job 系统处理
5. **安全要求**: API Key 只从环境变量读取，不在 JSON 文件中存储

### 11.2 与 STAGE3_PLAN 的对齐

- ✅ 遵循 S3-A.0 的约束（禁止修改 NOVEL_ANALYSIS，HTTP 引擎仅通过新 JobType 或 feature flag 接入）
- ✅ 遵循 S3-A.1 的设计要点（环境变量配置、认证方式、错误处理、限流策略）
- ✅ 不改变 EngineAdapter 接口、EngineRegistry 核心逻辑、Job 状态机、schema.prisma

### 11.3 下一步行动

1. **评审本文档**: 确认配置方案和安全要求
2. **进入 S3-A.2**: 完成 HTTP 引擎调用路径设计
3. **进入 MODE: EXECUTE**: 设计文档通过后，实现配置读取和认证逻辑

---

**文档状态**: ✅ 设计完成，待评审  
**后续文档**: S3-A.2 HTTP 引擎调用路径设计
