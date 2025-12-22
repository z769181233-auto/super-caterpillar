# Worker HMAC 认证修复 - 最终报告

## ✅ 修复完成

### 修改的文件列表

1. **`apps/workers/src/env.ts`**
   - 添加 `apiKey` 和 `apiSecret` 配置
   - 添加 `workerId` 字段

2. **`apps/workers/src/api-client.ts`**
   - 实现完整的 HMAC 认证逻辑
   - 添加签名计算函数（与后端完全一致）
   - 所有请求自动添加 HMAC 认证头
   - 添加详细的 HTTP 错误日志

3. **`apps/workers/src/worker-agent.ts`**
   - 使用统一的 env 配置
   - 添加启动日志显示 API Key 配置状态

4. **`apps/workers/src/worker/workerLoop.ts`**
   - 更新为使用新的 API 路径
   - 删除旧的 `/api/workers/fetch-job` 路径

5. **`apps/workers/src/client/httpClient.ts`**
   - 修复 `hmacSecret` → `apiSecret` 引用

6. **`apps/workers/src/novel-analysis-processor.ts`**
   - 删除重复代码（第 333-664 行）

7. **`.env`（根目录）**
   - 添加 Worker HMAC 认证配置

8. **`apps/api/src/scripts/init-worker-api-key.ts`（新建）**
   - 创建初始化脚本，用于在数据库中创建 Worker API Key

9. **`apps/api/package.json`**
   - 添加 `init:worker-api-key` 脚本

## 关键代码片段

### HMAC 签名逻辑（Worker 端）

```typescript
// 1. 序列化请求体
const bodyString = body ? JSON.stringify(body) : undefined;

// 2. 计算 body hash（与后端 HmacAuthService.computeBodyHash 一致）
const bodyHash = computeBodyHash(bodyString);

// 3. 构建签名消息（与后端 HmacAuthService.buildMessage 一致）
// 格式：${method}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}
const message = `${method.toUpperCase()}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}`;

// 4. 计算签名（与后端 HmacAuthService.computeSignature 一致）
const signature = computeSignature(apiSecret, message);

// 5. 设置请求头
headers['X-API-KEY'] = apiKey;
headers['X-API-NONCE'] = nonce;
headers['X-API-TIMESTAMP'] = timestamp;
headers['X-API-SIGNATURE'] = signature;
```

### Body Hash 计算

```typescript
function computeBodyHash(body: string | undefined): string {
  if (!body || body.length === 0) {
    // 空请求体使用空字符串的哈希
    return createHash('sha256').update('').digest('hex');
  }
  return createHash('sha256').update(body, 'utf8').digest('hex');
}
```

### 签名消息格式

```
POST
/api/workers/register
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
a1b2c3d4e5f6...
1704067200000
```

## HMAC 认证要求

### 请求头
- `X-API-KEY`: API Key ID（例如：`ak_worker_dev_0000000000000000`）
- `X-API-NONCE`: 随机字符串（32 字符十六进制）
- `X-API-TIMESTAMP`: 时间戳（毫秒，字符串）
- `X-API-SIGNATURE`: HMAC-SHA256 签名（十六进制字符串）

### Secret 来源
- Secret 存储在数据库 `ApiKey` 表的 `secretHash` 字段中
- 通过 `X-API-KEY` 查找对应的 `ApiKey` 记录
- 当前实现中，`secretHash` 直接存储 secret 明文（开发环境）

### 路由使用的 Guard
- `WorkerController`: 使用 `@UseGuards(JwtOrHmacGuard)`
- `JobController.reportJob`: 使用 `@UseGuards(JwtOrHmacGuard)`
- `JwtOrHmacGuard` 会检查是否有 `x-api-key` 和 `x-api-signature` 头，如果有则使用 HMAC，否则使用 JWT

## 使用步骤

### 1. 初始化 Worker API Key（首次使用）

```bash
# 在项目根目录执行
pnpm --filter @super-caterpillar/api init:worker-api-key
```

这会：
- 在数据库中创建 API Key 记录（如果不存在）
- 输出配置说明

### 2. 启动服务

```bash
# 在项目根目录执行
pnpm dev
```

### 3. 验证 Worker 状态

查看 Worker 日志，应该看到：
- `[Worker] API Key: ak_worker_dev_0000000000000000...`
- `[Worker] API Secret: SET`
- `[Worker HMAC] POST /api/workers/register ...`
- 不再出现 `401 Unauthorized` 错误

## 环境变量配置

在 `.env` 文件中已添加：

```env
WORKER_API_KEY=ak_worker_dev_0000000000000000
WORKER_API_SECRET=super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678
WORKER_ID=local-worker
WORKER_NAME=local-worker
```

## 验证清单

- [x] Worker 启动时显示 API Key 配置状态
- [x] 所有 Worker 请求都包含 HMAC 认证头
- [x] HTTP 错误日志包含详细的请求信息
- [x] API Key 和 Secret 从环境变量读取
- [x] 签名算法与后端完全一致
- [x] 支持所有 Worker API 端点（register、heartbeat、getNextJob、reportJobResult）
- [x] TypeScript 编译通过（0 错误）

## 预期结果

运行 `pnpm dev` 后，Worker 日志应该显示：

```
[Worker] Starting Worker Agent...
[Worker] Worker ID: local-worker
[Worker] API Base URL: http://localhost:3000
[Worker] API Key: ak_worker_dev_0000000000000000...
[Worker] API Secret: SET
[Worker HMAC] POST /api/workers/register nonce=a1b2c3d4... timestamp=1704067200000
[Worker] Registered successfully: ...
[Worker] Worker Agent started successfully
```

**不再出现：**
- `401 Unauthorized` 错误
- `Network Error fetch failed`（API 就绪后）

