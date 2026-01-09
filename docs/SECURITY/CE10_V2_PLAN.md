# CE10 API Security v2 实现计划

## RESEARCH 发现

### 1. 当前 Canonical 规则（v1）

- **格式**: `apiKey + nonce + timestamp + body`
- **位置**: `apps/api/src/security/api-security/api-security.service.ts:255`
- **问题**:
  - 不包含 method、path
  - multipart body 无法稳定序列化
  - 不包含 query string

### 2. multipart body 处理

- **当前实现**: 尝试从 `request.rawBody` 获取，但 multipart 请求的 body 可能无法直接序列化
- **问题**: 无法对 multipart 文件上传进行签名验证

### 3. Secret 来源

- **当前**: 使用 `keyRecord.secretHash`，注释说明这是临时方案，直接存储 secret 明文
- **问题**: 生产环境必须改为可逆的 secret（AES 加密）或 Ed25519

---

## PLAN: Signature v2 规范

### 1. 请求头（统一）

- `X-Api-Key`: API Key ID
- `X-Nonce`: 随机字符串
- `X-Timestamp`: 时间戳（秒级）
- `X-Content-SHA256`: 内容 SHA256 哈希（hex）或 `UNSIGNED`（multipart 例外）
- `X-Signature`: HMAC-SHA256 签名（hex）

### 2. Canonical String v2 格式

```
v2\n
{METHOD}\n
{PATH_WITH_QUERY}\n
{API_KEY}\n
{TIMESTAMP}\n
{NONCE}\n
{CONTENT_SHA256}\n
```

**规则**:

- 第一行固定为 `v2`
- 每行用 `\n` 分隔（严格换行符）
- `PATH_WITH_QUERY`: 包含 query string（从 `req.url` 获取，保持原始顺序）
- `CONTENT_SHA256`:
  - JSON 请求：`sha256(rawBodyBytes)`（hex）
  - multipart 请求：`UNSIGNED`（固定字符串）

### 3. multipart 例外规则

**端点**: `POST /api/projects/:projectId/novel/import-file`

**规则**:

- 强制要求 `X-Content-SHA256=UNSIGNED`
- canonical string 中使用 `UNSIGNED` 作为 `CONTENT_SHA256`
- 禁止尝试 stringify/读取 multipart body

### 4. Secret 处理

**当前**: `keyRecord.secretHash` 直接存储 secret 明文（临时方案）

**要求**:

- 生产环境必须改为可逆的 secret（AES 加密存储）
- 或改用 Ed25519 签名算法

**实现**:

- 当前阶段：在文档中明确说明，并在代码中添加 TODO
- 后续阶段：实现 AES 解密或 Ed25519

---

## EXECUTE 改动范围

### 允许修改的文件

1. `apps/api/src/security/api-security/api-security.guard.ts`
2. `apps/api/src/security/api-security/api-security.service.ts`
3. `apps/api/src/security/api-security/api-security.spec.ts`
4. `apps/api/src/security/api-security/api-security.types.ts`（可选，添加 contentSha256 字段）
5. `apps/api/src/main.ts`（可选，添加 rawBody 捕获）

### 禁止修改的文件（冻结白名单）

- `apps/api/src/job/job.rules.ts`
- `apps/api/src/job/job.retry.ts`
- `apps/api/src/job/job.service.ts`
- `apps/api/src/job/job-worker.service.ts`
- `apps/api/src/orchestrator/orchestrator.service.ts`
- `apps/api/src/worker/worker.service.ts`
- `packages/config/src/env.ts`（仅 `workerHeartbeatTimeoutMs` 相关）

---

## 实现要点

### 1. Guard 修改

- 提取 `X-Content-SHA256` 请求头
- 提取 `method`、`pathWithQuery`（包含 query string）
- 判断是否为 multipart 端点（`POST /api/projects/*/novel/import-file`）
- 如果是 multipart，验证 `X-Content-SHA256=UNSIGNED`
- 计算或使用 `UNSIGNED` 作为 `contentSha256`

### 2. Service 修改

- 新增 `buildCanonicalStringV2()` 方法
- 移除或废弃 `buildCanonicalString()`（v1）
- 新增 `sha256Hex(rawBodyBytes)` 方法
- 修改 `verifySignature()` 使用 v2 规范

### 3. 测试用例

- v2 canonical 正确性
- query string 被纳入 canonical
- multipart UNSIGNED 通过
- timestamp out of window 拒绝
- nonce replay 拒绝
- signature mismatch 拒绝

---

## 文档更新

在 `docs/SECURITY/CE10_API_SECURITY_IMPLEMENTATION_REPORT.md` 中追加：

1. "Signature v2 规范" 章节
2. "multipart 例外规则（UNSIGNED）" 章节
3. "Secret 必须可逆/或 Ed25519" 章节
