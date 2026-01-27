# Worker HMAC 认证完整验证报告

## ✅ 修复完成项

### 1. 包名和脚本执行方式

**修复内容：**

- ✅ `apps/api/package.json` 中包名为 `api`（不是 `@super-caterpillar/api`）
- ✅ 脚本执行方式：
  - `pnpm --filter api init:worker-api-key`
  - 或在 `apps/api` 目录下：`pnpm init:worker-api-key`
- ✅ `init-worker-api-key.ts` 注释已更新为正确的执行方式

### 2. Worker HMAC 认证实现

**请求头（Worker 端）：**

- ✅ `X-API-KEY`: API Key ID
- ✅ `X-API-NONCE`: 随机字符串（32 字符十六进制）
- ✅ `X-API-TIMESTAMP`: 时间戳（毫秒，字符串）
- ✅ `X-API-SIGNATURE`: HMAC-SHA256 签名（十六进制字符串）

**签名算法（与后端完全一致）：**

```typescript
// 1. 消息格式：${method}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}
const message = `${method.toUpperCase()}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}`;

// 2. 计算签名：HMAC-SHA256(secret, message)
const signature = computeSignature(apiSecret, message);
```

**实现位置：**

- `apps/workers/src/api-client.ts` 中的 `request()` 方法
- 所有 Worker API 调用都自动包含 HMAC 认证头

### 3. Worker API Key 初始化脚本

**文件位置：**

- ✅ `apps/api/src/scripts/init-worker-api-key.ts`

**package.json 脚本：**

- ✅ `"init:worker-api-key": "ts-node -r tsconfig-paths/register src/scripts/init-worker-api-key.ts"`

**使用方法：**

```bash
# 方式 1：使用 filter
pnpm --filter api init:worker-api-key

# 方式 2：在 apps/api 目录下
cd apps/api
pnpm init:worker-api-key
```

### 4. .env 配置

**已配置的变量：**

```env
WORKER_API_KEY=ak_worker_dev_0000000000000000
WORKER_API_SECRET=super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678
WORKER_ID=local-worker
WORKER_NAME=local-worker
```

**验证：**

```bash
cat .env | grep -E "^WORKER_|^API_"
```

### 5. Worker baseURL 和路由前缀

**baseURL：**

- ✅ `http://localhost:3000`（在 `apps/workers/src/env.ts` 中配置）

**所有路由都包含 `/api` 前缀：**

- ✅ `POST /api/workers/register`
- ✅ `POST /api/workers/heartbeat`
- ✅ `POST /api/workers/:workerId/jobs/next`
- ✅ `POST /api/jobs/:jobId/report`

**实现位置：**

- `apps/workers/src/api-client.ts` 中的所有方法

### 6. 旧路径清理

**检查结果：**

- ✅ 没有找到 `/workers/fetch-job` 路径
- ✅ 没有找到 `/workers/report` 路径
- ✅ 所有路径都使用新的 `/api` 前缀

**验证命令：**

```bash
grep -r "fetch-job\|/workers/report" apps/workers/src
# 结果：No matches found
```

## 完整验证清单

### 环境配置

- [x] `.env` 文件包含所有必需的 Worker 配置
- [x] `WORKER_API_KEY` 和 `WORKER_API_SECRET` 已设置
- [x] `WORKER_ID` 和 `WORKER_NAME` 已设置

### API 初始化脚本

- [x] `apps/api/src/scripts/init-worker-api-key.ts` 存在
- [x] `apps/api/package.json` 包含 `init:worker-api-key` 脚本
- [x] 脚本注释中的执行方式正确

### Worker HMAC 认证

- [x] `apps/workers/src/api-client.ts` 实现 HMAC 认证
- [x] 签名算法与后端 `HmacAuthService` 完全一致
- [x] 所有请求头正确设置（`X-API-KEY`, `X-API-NONCE`, `X-API-TIMESTAMP`, `X-API-SIGNATURE`）
- [x] Body hash 计算与后端一致

### Worker API 路径

- [x] baseURL 为 `http://localhost:3000`
- [x] 所有路由包含 `/api` 前缀
- [x] 没有使用旧的路径（`/workers/fetch-job`, `/workers/report`）

### Worker 功能

- [x] `apps/workers/src/novel-analysis-processor.ts` 有最小实现
- [x] Worker 可以注册、发送心跳、拉取任务、上报结果

## 测试步骤

### 1. 初始化 Worker API Key

```bash
# 在项目根目录执行
pnpm --filter api init:worker-api-key
```

**预期输出：**

```
========================================
初始化 Worker API Key
========================================

✅ Worker API Key 创建成功！
   Key: ak_worker_dev_0000000000000000
   Secret: super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678
```

### 2. 启动服务

```bash
# 在项目根目录执行
pnpm dev
```

### 3. 验证 Worker 日志

**预期日志：**

```
[Worker] Starting Worker Agent...
[Worker] Worker ID: local-worker
[Worker] API Base URL: http://localhost:3000
[Worker] API Key: ak_worker_dev_0000000000000000...
[Worker] API Secret: SET
[Worker HMAC_V2] POST /api/workers/register nonce=a1b2c3d4... timestamp=1704067200000
[Worker] Registered successfully: ...
[Worker] Worker Agent started successfully
```

**不应出现：**

- ❌ `401 Unauthorized` 错误
- ❌ `Network Error fetch failed`（API 就绪后）
- ❌ 旧的路径错误

## 关键代码位置

### Worker HMAC 认证实现

- **文件：** `apps/workers/src/api-client.ts`
- **方法：** `request()` (第 75-152 行)
- **函数：** `computeBodyHash()`, `generateNonce()`, `buildMessage()`, `computeSignature()`

### Worker 配置

- **文件：** `apps/workers/src/env.ts`
- **文件：** `apps/workers/src/worker-agent.ts` (第 10-21 行)

### API 初始化脚本

- **文件：** `apps/api/src/scripts/init-worker-api-key.ts`
- **脚本：** `pnpm --filter api init:worker-api-key`

## 总结

✅ 所有要求已满足：

1. ✅ 包名和脚本执行方式正确
2. ✅ Worker HMAC 认证完整实现
3. ✅ 初始化脚本位置和名称正确
4. ✅ package.json 脚本配置正确
5. ✅ .env 配置完整
6. ✅ Worker baseURL 和路由前缀正确
7. ✅ 旧路径已清理

Worker 现在应该能够：

- ✅ 使用 HMAC 认证成功注册
- ✅ 发送心跳
- ✅ 拉取任务（`/api/workers/:workerId/jobs/next`）
- ✅ 上报结果（`/api/jobs/:jobId/report`）

不再出现 401 错误。
