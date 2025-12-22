# Worker HMAC 认证分析

## 第 1 步：后端 Worker 鉴权逻辑分析

### 1.1 HMAC 认证 Guard

**文件：** `apps/api/src/auth/guards/jwt-or-hmac.guard.ts`

**逻辑：**
- 检查请求头中是否有 `x-api-key` 和 `x-api-signature`
- 如果有，使用 HMAC 认证
- 如果没有，使用 JWT 认证

### 1.2 HMAC 认证需要的请求头

**文件：** `apps/api/src/auth/hmac/hmac-auth.guard.ts`

**必需请求头：**
- `X-API-KEY`: API Key ID（公钥，格式：`ak_xxx`）
- `X-API-NONCE`: 随机字符串（防止重放攻击）
- `X-API-TIMESTAMP`: 时间戳（毫秒，字符串）
- `X-API-SIGNATURE`: HMAC 签名（十六进制字符串）

### 1.3 HMAC 签名算法

**文件：** `apps/api/src/auth/hmac/hmac-auth.service.ts`

**签名规则：**
1. **消息格式：** `${method}\n${path}\n${bodyHash}\n${nonce}\n${timestamp}`
   - `method`: HTTP 方法（大写，如 `POST`）
   - `path`: 请求路径（不带查询参数，如 `/api/workers/register`）
   - `bodyHash`: 请求体的 SHA256 哈希（空请求体使用空字符串的哈希）
   - `nonce`: 随机字符串
   - `timestamp`: 时间戳（毫秒，字符串）

2. **签名计算：** `HMAC-SHA256(secret, message)`
   - `secret`: 从数据库 `ApiKey` 表中读取，通过 `X-API-KEY` 查找对应的 `secretHash` 字段
   - 输出：十六进制字符串

3. **Body Hash 计算：**
   - 如果请求体为空：使用空字符串的 SHA256 哈希
   - 如果请求体不为空：将请求体序列化为 JSON 字符串，计算 SHA256 哈希

### 1.4 Secret 来源

**当前实现：**
- Secret 存储在数据库 `ApiKey` 表的 `secretHash` 字段中
- 通过 `X-API-KEY` 查找对应的 `ApiKey` 记录
- 从记录的 `secretHash` 字段获取 secret（当前实现中，`secretHash` 直接存储 secret 明文）

**注意：** 这不是共享密钥方案，而是基于 API Key 的方案。Worker 需要先有一个 API Key。

### 1.5 路由使用的 Guard

**WorkerController (`apps/api/src/worker/worker.controller.ts`):**
- 使用 `@UseGuards(JwtOrHmacGuard)`
- 所有路由都支持 JWT 或 HMAC 认证

**JobController (`apps/api/src/job/job.controller.ts`):**
- `POST /api/jobs/:id/report` 使用 `@UseGuards(JwtOrHmacGuard)`
- 支持 JWT 或 HMAC 认证

### 1.6 时间戳验证

- 允许误差：±5 分钟（300000 毫秒）
- 配置来源：`env.HMAC_TIMESTAMP_WINDOW`（默认 300000）

## 第 2 步：解决方案

由于当前实现需要 API Key，我们有两个选择：

1. **方案 A（推荐）：** 在 dev 环境下，为 Worker 创建一个固定的 API Key
2. **方案 B：** 修改后端支持共享密钥（需要改代码，不符合要求）

**采用方案 A：**
- 在 `.env` 中配置固定的 API Key 和 Secret
- Worker 使用这个 API Key 进行 HMAC 认证
- 如果 API Key 不存在，Worker 启动时自动创建

