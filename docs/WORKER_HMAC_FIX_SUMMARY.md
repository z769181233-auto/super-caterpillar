# Worker HMAC 认证修复总结

## 修复的文件列表

### 1. `apps/workers/src/env.ts`
- **修改内容：** 添加 `apiKey` 和 `apiSecret` 配置
- **变更：**
  - 新增 `workerId` 字段（从 `WORKER_ID` 或 `WORKER_NAME` 读取）
  - 新增 `apiKey` 字段（从 `WORKER_API_KEY` 或 `API_KEY` 读取）
  - 新增 `apiSecret` 字段（从 `WORKER_API_SECRET` 或 `API_SECRET` 读取）

### 2. `apps/workers/src/api-client.ts`
- **修改内容：** 实现完整的 HMAC 认证逻辑
- **变更：**
  - 添加 `computeBodyHash()` 函数（与后端 `HmacAuthService.computeBodyHash` 一致）
  - 添加 `generateNonce()` 函数（生成随机 nonce）
  - 添加 `buildMessage()` 函数（构建签名消息，格式：`${method}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}`）
  - 添加 `computeSignature()` 函数（计算 HMAC-SHA256 签名）
  - 在 `request()` 方法中实现 HMAC 认证头设置：
    - `X-API-KEY`: API Key ID
    - `X-API-NONCE`: 随机 nonce
    - `X-API-TIMESTAMP`: 时间戳（毫秒）
    - `X-API-SIGNATURE`: HMAC 签名
  - 添加详细的 HTTP 错误日志（打印 method、URL、status、请求头）

### 3. `apps/workers/src/worker-agent.ts`
- **修改内容：** 使用统一的 env 配置
- **变更：**
  - 从 `env` 模块导入配置
  - 使用 `env.apiKey` 和 `env.apiSecret` 初始化 `ApiClient`
  - 添加启动日志，显示 API Key 配置状态

### 4. `.env`（根目录）
- **修改内容：** 添加 Worker HMAC 认证配置
- **新增配置：**
  ```env
  WORKER_API_KEY=ak_worker_dev_0000000000000000
  WORKER_API_SECRET=super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678
  WORKER_ID=local-worker
  WORKER_NAME=local-worker
  ```

### 5. `apps/api/src/scripts/init-worker-api-key.ts`（新建）
- **修改内容：** 创建初始化脚本，用于在数据库中创建 Worker API Key
- **功能：**
  - 检查 API Key 是否已存在
  - 如果不存在，创建新的 API Key 记录
  - 输出配置说明

### 6. `apps/api/package.json`
- **修改内容：** 添加初始化脚本命令
- **新增脚本：** `"init:worker-api-key": "ts-node -r tsconfig-paths/register src/scripts/init-worker-api-key.ts"`

## HMAC 认证逻辑说明

### 请求头要求
Worker 请求必须包含以下 HTTP 头：
- `X-API-KEY`: API Key ID（例如：`ak_worker_dev_0000000000000000`）
- `X-API-NONCE`: 随机字符串（32 字符十六进制）
- `X-API-TIMESTAMP`: 时间戳（毫秒，字符串）
- `X-API-SIGNATURE`: HMAC-SHA256 签名（十六进制字符串）

### 签名算法
1. **消息格式：** `${method}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}`
   - `method`: HTTP 方法（大写，如 `POST`）
   - `path`: 请求路径（如 `/api/workers/register`）
   - `bodyHash`: 请求体的 SHA256 哈希（空请求体使用空字符串的哈希）
   - `nonce`: 随机字符串
   - `timestamp`: 时间戳（毫秒，字符串）

2. **签名计算：** `HMAC-SHA256(secret, message)`
   - `secret`: 从数据库 `ApiKey` 表的 `secretHash` 字段读取
   - 输出：十六进制字符串

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

这会同时启动：
- API 服务（`http://localhost:3000`）
- Worker 服务（使用 HMAC 认证）

### 3. 验证 Worker 状态

查看 Worker 日志，应该看到：
- `[Worker] API Key: ak_worker_dev_0000000000000000...`
- `[Worker] API Secret: SET`
- `[Worker HMAC] POST /api/workers/register ...`
- 不再出现 `401 Unauthorized` 错误

## 关键代码片段

### HMAC 签名逻辑（Worker 端）

```typescript
// 1. 序列化请求体
const bodyString = body ? JSON.stringify(body) : undefined;

// 2. 计算 body hash
const bodyHash = computeBodyHash(bodyString);

// 3. 构建签名消息
const message = `${method.toUpperCase()}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}`;

// 4. 计算签名
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
    return createHash('sha256').update('').digest('hex');
  }
  return createHash('sha256').update(body, 'utf8').digest('hex');
}
```

## 验证清单

- [x] Worker 启动时显示 API Key 配置状态
- [x] 所有 Worker 请求都包含 HMAC 认证头
- [x] HTTP 错误日志包含详细的请求信息
- [x] API Key 和 Secret 从环境变量读取
- [x] 签名算法与后端完全一致
- [x] 支持所有 Worker API 端点（register、heartbeat、getNextJob、reportJobResult）

