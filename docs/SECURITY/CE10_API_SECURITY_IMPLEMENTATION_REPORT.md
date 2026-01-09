# CE10 API 安全模块实现报告

## 模式声明

**MODE: EXECUTE** - API 安全模块实现（@RequireSignature() 装饰器）

## 实现时间

2025-12-14

---

## 一、实现概述

### 1.1 目标

实现 API 安全模块，提供 `@RequireSignature()` 装饰器，用于标记高成本/敏感接口，强制要求 HMAC 签名验证。

### 1.2 参考文档

- 《10毛毛虫宇宙\_API设计规范\_APISpec_V1.1》
- 《9毛毛虫宇宙\_数据库设计说明书\_DBSpec_V1.1》

### 1.3 实现范围

- ✅ 新增 `ApiSecurityModule`（HMAC-SHA256 签名验证、时间戳窗口校验、Nonce 防重放）
- ✅ 提供 `@RequireSignature()` 装饰器
- ✅ 接入审计日志（成功/失败都记录）
- ✅ 在关键 controller 上应用装饰器
- ✅ 编写单元测试

---

## 二、实现文件清单

### 2.1 新增文件

1. **`apps/api/src/security/api-security/api-security.types.ts`**
   - 定义 API 安全相关的类型定义
   - `SignatureVerificationResult`、`SignatureVerificationContext`、`SignatureAuditDetails`

2. **`apps/api/src/security/api-security/api-security.decorator.ts`**
   - `@RequireSignature()` 装饰器实现
   - 元数据键：`REQUIRE_SIGNATURE_KEY`

3. **`apps/api/src/security/api-security/api-security.service.ts`**
   - `ApiSecurityService`：核心签名验证服务
   - 实现 HMAC-SHA256 签名验证
   - 实现时间戳窗口校验（±5 分钟）
   - 实现 Nonce 防重放（Redis TTL 5 分钟）
   - 实现审计日志记录

4. **`apps/api/src/security/api-security/api-security.guard.ts`**
   - `ApiSecurityGuard`：只对标记了 `@RequireSignature()` 的端点生效
   - 提取请求头（X-Api-Key, X-Nonce, X-Timestamp, X-Signature）
   - 调用 `ApiSecurityService` 验证签名

5. **`apps/api/src/security/api-security/api-security.module.ts`**
   - `ApiSecurityModule`：模块定义
   - 导入依赖：`PrismaModule`、`RedisModule`、`AuditLogModule`

6. **`apps/api/src/security/api-security/api-security.spec.ts`**
   - 单元测试文件
   - 覆盖：正常签名、时间戳过期、Nonce 重放、签名错误、无效 API Key、禁用 API Key

### 2.2 修改文件

1. **`apps/api/src/app.module.ts`**
   - 导入 `ApiSecurityModule`
   - 在 `imports` 数组中添加 `ApiSecurityModule`

2. **`apps/api/src/novel-import/novel-import.controller.ts`**
   - 导入 `RequireSignature` 装饰器和 `ApiSecurityGuard`
   - 在 Controller 类上添加 `@UseGuards(ApiSecurityGuard)`
   - 在以下方法上添加 `@RequireSignature()`：
     - `@Post('import-file')` - 文件导入（高成本）
     - `@Post('import')` - 文本导入（高成本）
     - `@Post('analyze')` - 小说分析（触发解析/增强，高成本）

3. **`apps/api/src/novel-import/novel-import.module.ts`**
   - 导入 `ApiSecurityModule`（已通过 AppModule 全局注册，此处可选）

---

## 三、被保护的端点清单

### 3.1 当前已保护端点（3 个）

| 端点     | 方法 | 路径                                         | 说明                         |
| -------- | ---- | -------------------------------------------- | ---------------------------- |
| 文件导入 | POST | `/api/projects/:projectId/novel/import-file` | 上传小说文件，触发解析       |
| 文本导入 | POST | `/api/projects/:projectId/novel/import`      | 直接导入文本内容             |
| 小说分析 | POST | `/api/projects/:projectId/novel/analyze`     | 触发 CE06/CE03/CE04 分析流程 |

### 3.2 下一步扩大覆盖面策略

**阶段 1（当前）**: 20% 高成本端点

- ✅ 小说导入/分析相关端点（3 个）

**阶段 2（计划）**: 50% 高成本端点

- 渲染相关端点（如 `POST /api/projects/:projectId/shots/:shotId/render`）
- 增强相关端点（如 `POST /api/projects/:projectId/shots/:shotId/enhance`）
- Inpaint 相关端点
- Pose 相关端点

**阶段 3（计划）**: 100% 高成本端点

- 所有触发引擎调用的端点
- 所有涉及模型路由的端点

**灰度开关**:

- 通过环境变量 `API_SECURITY_ENABLED` 控制是否启用签名验证（默认 `true`）
- 通过 `API_SECURITY_REQUIRE_SIGNATURE_ENDPOINTS` 配置需要签名的端点列表（JSON 数组）

---

## 四、签名计算规则与 Canonical String

### 4.1 Canonical String 定义

**规则**: `apiKey + nonce + timestamp + body`

**示例**:

```typescript
const canonicalString = `${apiKey}${nonce}${timestamp}${body || ''}`;
```

**注意事项**:

1. `body` 必须稳定序列化（使用 `JSON.stringify` 确保 key 顺序一致）
2. 空请求体使用空字符串 `''`
3. 所有字段按顺序拼接，无分隔符

### 4.2 HMAC 签名计算

**算法**: HMAC-SHA256

**步骤**:

1. 构建 Canonical String（见 4.1）
2. 使用 API Key 对应的 `secretHash` 作为密钥
3. 计算 HMAC-SHA256，输出十六进制字符串（64 字符）

**代码实现**:

```typescript
const hmac = createHmac('sha256', secret);
hmac.update(canonicalString, 'utf8');
const signature = hmac.digest('hex');
```

### 4.3 请求头要求

| 请求头        | 说明                         | 示例           |
| ------------- | ---------------------------- | -------------- |
| `X-Api-Key`   | API Key ID（公钥）           | `ak_test_123`  |
| `X-Nonce`     | 随机字符串（防重放）         | `nonce_123456` |
| `X-Timestamp` | 时间戳（秒级）               | `1702540800`   |
| `X-Signature` | HMAC-SHA256 签名（十六进制） | `a1b2c3d4...`  |

---

## 五、Nonce 策略与 TTL

### 5.1 Nonce 存储策略

**Redis Key 格式**: `api_security:nonce:{apiKey}:{nonce}`

**示例**: `api_security:nonce:ak_test_123:nonce_123456`

### 5.2 TTL 设置

**TTL**: 300 秒（5 分钟）

**原因**:

- 与时间戳窗口（±5 分钟）保持一致
- 防止 Nonce 重放攻击
- 自动过期清理，无需手动管理

### 5.3 防重放机制

1. **验证流程**:
   - 检查 Redis 中是否存在该 Nonce
   - 如果存在 → 拒绝请求（错误码 4004）
   - 如果不存在 → 保存 Nonce（TTL 5 分钟）→ 继续验证

2. **原子性保证**:
   - 使用 Redis `SET` 命令的 `NX` 选项（如果不存在则设置）
   - 确保并发请求不会同时通过 Nonce 验证

---

## 六、时间戳窗口校验

### 6.1 窗口大小

**窗口**: ±300 秒（±5 分钟）

**计算方式**:

```typescript
const nowSec = Math.floor(Date.now() / 1000);
const timeDiff = Math.abs(nowSec - parseInt(timestamp, 10));
if (timeDiff > 300) {
  // 拒绝请求
}
```

### 6.2 时间戳格式

**要求**: 秒级时间戳（Unix timestamp）

**示例**: `1702540800`（对应 2023-12-14 00:00:00 UTC）

**注意**: 如果传入毫秒级时间戳（> 1,000,000,000,000），会自动转换为秒级（除以 1000）

---

## 七、错误码映射

### 7.1 错误码定义

| 错误码 | HTTP 状态码 | 说明         | 触发条件                                                            |
| ------ | ----------- | ------------ | ------------------------------------------------------------------- |
| `4003` | 401         | 签名验证失败 | 签名错误、时间戳过期、缺少请求头、无效 API Key、API Key 被禁用/过期 |
| `4004` | 403         | Nonce 重放   | Nonce 已被使用（5 分钟内重复）                                      |

### 7.2 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "4003",
    "message": "签名验证失败"
  },
  "requestId": "uuid",
  "timestamp": "2025-12-14T00:00:00.000Z",
  "path": "/api/projects/123/novel/import-file",
  "method": "POST"
}
```

---

## 八、审计日志记录

### 8.1 审计记录时机

- ✅ **成功场景**: 签名验证通过时记录
- ✅ **失败场景**: 签名验证失败时记录（包含失败原因码）

### 8.2 审计字段

| 字段           | 说明       | 示例                                  |
| -------------- | ---------- | ------------------------------------- |
| `action`       | 操作类型   | `SECURITY_EVENT`                      |
| `resourceType` | 资源类型   | `api_security`                        |
| `resourceId`   | 资源 ID    | API Key（脱敏后）                     |
| `nonce`        | Nonce 值   | `nonce_123456`                        |
| `signature`    | 签名值     | `a1b2c3d4...`                         |
| `timestamp`    | 请求时间戳 | `2025-12-14T00:00:00.000Z`            |
| `details`      | 详细信息   | `{ reason, path, method, errorCode }` |

### 8.3 失败原因码（reason）

| 原因码                     | 说明               |
| -------------------------- | ------------------ |
| `INVALID_API_KEY`          | 无效的 API Key     |
| `API_KEY_DISABLED`         | API Key 已被禁用   |
| `API_KEY_EXPIRED`          | API Key 已过期     |
| `INVALID_TIMESTAMP_FORMAT` | 时间戳格式错误     |
| `TIMESTAMP_OUT_OF_WINDOW`  | 时间戳超出允许范围 |
| `NONCE_REPLAY`             | Nonce 重放         |
| `SIGNATURE_MISMATCH`       | 签名不匹配         |
| `SIGNATURE_VERIFIED`       | 签名验证成功       |
| `VERIFICATION_ERROR`       | 验证过程异常       |

### 8.4 DB 跟进 TODO

**当前实现**: 审计日志写入 `audit_logs` 表的 `payload` 字段（JSON）

**后续优化**:

- 如果 `audit_logs` schema 扩展独立列（`nonce`、`signature`、`timestamp`），优先使用独立列
- 保持 `payload` 字段作为完整快照（向后兼容）

---

## 九、测试结果

### 9.1 单元测试覆盖

**测试文件**: `apps/api/src/security/api-security/api-security.spec.ts`

**测试用例**:

| 用例 | 场景                       | 预期结果             | 状态 |
| ---- | -------------------------- | -------------------- | ---- |
| 1    | 正常签名验证               | 验证通过             | ✅   |
| 2    | 时间戳过期（超过 ±5 分钟） | 拒绝，错误码 4003    | ✅   |
| 3    | Nonce 重放（5 分钟内重复） | 拒绝，错误码 4004    | ✅   |
| 4    | 签名错误                   | 拒绝，错误码 4003    | ✅   |
| 5    | 无效的 API Key             | 拒绝，错误码 4003    | ✅   |
| 6    | 被禁用的 API Key           | 拒绝，错误码 4003    | ✅   |
| 7    | Canonical String 构建      | 正确拼接             | ✅   |
| 8    | HMAC 签名计算              | 正确计算，一致性验证 | ✅   |

### 9.2 编译验证

**命令**: `pnpm -w --filter api build`

**结果**: ✅ 通过

**输出**:

```
apps/api build: webpack 5.97.1 compiled successfully in 4921 ms
```

### 9.3 Lint 验证

**命令**: `pnpm -w lint`

**结果**: ✅ 通过（无新增错误）

---

## 十、冻结白名单文件验证

### 10.1 验证结果

**命令**: `git diff --name-only | grep -E "job|orchestrator|worker|env\.ts"`

**结果**: ✅ **未触碰冻结白名单文件**

**冻结白名单文件（7 个）**:

1. `apps/api/src/job/job.rules.ts`
2. `apps/api/src/job/job.retry.ts`
3. `apps/api/src/job/job.service.ts`
4. `apps/api/src/job/job-worker.service.ts`
5. `apps/api/src/orchestrator/orchestrator.service.ts`
6. `apps/api/src/worker/worker.service.ts`
7. `packages/config/src/env.ts`（仅 `workerHeartbeatTimeoutMs` 字段）

---

## 十一、使用示例

### 11.1 在 Controller 中使用

```typescript
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { ApiSecurityGuard } from '../security/api-security/api-security.guard';

@Controller('projects/:projectId/novel')
@UseGuards(JwtAuthGuard, PermissionsGuard, ApiSecurityGuard)
export class NovelImportController {
  @Post('import-file')
  @RequireSignature() // 标记为需要签名验证
  async importFile(@UploadedFile() file: Express.Multer.File) {
    // ...
  }
}
```

### 11.2 客户端签名计算示例

```typescript
import { createHmac } from 'crypto';

function computeSignature(
  apiKey: string,
  nonce: string,
  timestamp: string,
  body: string,
  secret: string
): string {
  const canonicalString = `${apiKey}${nonce}${timestamp}${body || ''}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(canonicalString, 'utf8');
  return hmac.digest('hex');
}

// 使用示例
const apiKey = 'ak_test_123';
const nonce = 'nonce_' + Date.now();
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify({ test: 'data' });
const secret = 'your_secret_key';

const signature = computeSignature(apiKey, nonce, timestamp, body, secret);

// 发送请求
fetch('/api/projects/123/novel/import', {
  method: 'POST',
  headers: {
    'X-Api-Key': apiKey,
    'X-Nonce': nonce,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'Content-Type': 'application/json',
  },
  body: body,
});
```

---

## 十二、下一步扩大覆盖面策略

### 12.1 阶段 2（50% 高成本端点）

**目标端点**:

- 渲染相关：`POST /api/projects/:projectId/shots/:shotId/render`
- 增强相关：`POST /api/projects/:projectId/shots/:shotId/enhance`
- Inpaint 相关：`POST /api/projects/:projectId/shots/:shotId/inpaint`
- Pose 相关：`POST /api/projects/:projectId/shots/:shotId/pose`

**实施步骤**:

1. 在对应 Controller 上添加 `@UseGuards(ApiSecurityGuard)`
2. 在对应方法上添加 `@RequireSignature()`
3. 更新本报告，记录新增端点

### 12.2 阶段 3（100% 高成本端点）

**目标**: 所有触发引擎调用的端点

**识别方法**:

- 搜索所有调用 `EngineRegistry.invoke()` 的端点
- 搜索所有创建 `JobType` 为引擎相关类型的端点
- 搜索所有涉及模型路由的端点

### 12.3 灰度开关

**环境变量**:

```bash
# 是否启用 API 安全模块（默认 true）
API_SECURITY_ENABLED=true

# 需要签名的端点列表（JSON 数组，可选，默认所有标记 @RequireSignature() 的端点）
API_SECURITY_REQUIRE_SIGNATURE_ENDPOINTS=["/api/projects/*/novel/import-file", "/api/projects/*/novel/analyze"]
```

**实现位置**: `apps/api/src/security/api-security/api-security.guard.ts`

---

## 十三、总结

### 13.1 实现完成度

- ✅ API Security Module 核心实现
- ✅ `@RequireSignature()` 装饰器
- ✅ HMAC-SHA256 签名验证
- ✅ 时间戳窗口校验（±5 分钟）
- ✅ Nonce 防重放（Redis TTL 5 分钟）
- ✅ 审计日志记录（成功/失败）
- ✅ 单元测试覆盖
- ✅ 在关键端点应用装饰器（3 个端点）
- ✅ 编译/Lint 验证通过
- ✅ 未触碰冻结白名单文件

### 13.2 后续工作

1. **扩大覆盖面**: 按阶段 2/3 逐步覆盖更多高成本端点
2. **DB Schema 优化**: 如果 `audit_logs` 扩展独立列，优先使用独立列
3. **性能优化**: 监控 Redis Nonce 存储性能，必要时优化
4. **文档完善**: 更新 API 文档，说明签名计算规则

---

---

## 十四、Signature v2 规范（CE10 v2 升级）

### 14.1 v2 规范概述

**升级时间**: 2025-12-14  
**版本**: v2  
**目标**: 可商用稳定的签名规范

### 14.2 请求头（v2 统一）

| 请求头             | 说明                                 | 示例                        |
| ------------------ | ------------------------------------ | --------------------------- |
| `X-Api-Key`        | API Key ID（公钥）                   | `ak_test_123`               |
| `X-Nonce`          | 随机字符串（防重放）                 | `nonce_123456`              |
| `X-Timestamp`      | 时间戳（秒级）                       | `1702540800`                |
| `X-Content-SHA256` | 内容 SHA256 哈希（hex）或 `UNSIGNED` | `a1b2c3d4...` 或 `UNSIGNED` |
| `X-Signature`      | HMAC-SHA256 签名（十六进制）         | `a1b2c3d4...`               |

### 14.3 Canonical String v2 格式

**格式**:

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

1. 第一行固定为 `v2`
2. 每行用 `\n` 分隔（严格换行符，避免拼接歧义）
3. `METHOD`: HTTP 方法（大写，如 `POST`、`GET`）
4. `PATH_WITH_QUERY`: 包含 query string 的完整路径（从 `req.url` 获取，保持原始顺序）
5. `API_KEY`: API Key ID
6. `TIMESTAMP`: 时间戳（秒级）
7. `NONCE`: 随机字符串
8. `CONTENT_SHA256`:
   - JSON 请求：`sha256(rawBodyBytes)`（hex）
   - multipart 请求：`UNSIGNED`（固定字符串）

**示例**:

```
v2
POST
/api/projects/123/novel/import?foo=bar
ak_test_123
1702540800
nonce_123456
a1b2c3d4e5f6...
```

### 14.4 multipart 例外规则（UNSIGNED）

**适用端点**: `POST /api/projects/:projectId/novel/import-file`

**规则**:

1. 强制要求 `X-Content-SHA256=UNSIGNED`
2. canonical string 中使用 `UNSIGNED` 作为 `CONTENT_SHA256`
3. 禁止尝试 stringify/读取 multipart body 来签名

**原因**:

- multipart/form-data 请求的 body 包含文件内容，无法稳定序列化
- 文件内容可能很大，计算 SHA256 成本高
- 使用 `UNSIGNED` 表示不验证 body 内容，仅验证请求元数据（method、path、apiKey、timestamp、nonce）

**验证流程**:

1. 检查是否为 multipart 端点（`POST /api/projects/*/novel/import-file`）
2. 如果是，验证 `X-Content-SHA256=UNSIGNED`
3. 如果不是，验证 `X-Content-SHA256` 为有效的 SHA256 hex 字符串

### 14.5 Secret 加密存储（AES-256-GCM）

**实现状态**: ✅ **已完成**

**实现方案**: AES-256-GCM 加密存储

**DB 字段**:

- `secretEnc`: String? (base64，加密后的 secret)
- `secretEncIv`: String? (base64，GCM IV)
- `secretEncTag`: String? (base64，GCM 认证标签)
- `secretVersion`: Int? (密钥版本，默认 1)
- `secretHash`: String? (改为可选，仅用于 fallback)

**环境变量**:

- `API_KEY_MASTER_KEY_B64`: 32 bytes base64（AES-256-GCM 主密钥）

**实现细节**:

1. **创建 API Key**: 生成随机 secret → AES-256-GCM 加密 → 存储三元组
2. **读取 secret**: 优先解密新字段，fallback 旧字段（仅 dev/test）
3. **生产环境**: 强制使用新字段，禁止 fallback

**代码位置**:

- `apps/api/src/security/api-security/secret-encryption.service.ts` - 加密/解密服务
- `apps/api/src/security/api-security/api-security.service.ts:resolveSecretForApiKey()` - 读取逻辑
- `apps/api/src/auth/hmac/api-key.service.ts:createApiKey()` - 创建逻辑

**详细文档**: 参见 `docs/SECURITY/CE10_SECRET_STORAGE_AESGCM_REPORT.md`

### 14.6 v2 vs v1 对比

| 特性              | v1                                  | v2                                                                                     |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| Canonical 格式    | `apiKey + nonce + timestamp + body` | `v2\n{METHOD}\n{PATH_WITH_QUERY}\n{API_KEY}\n{TIMESTAMP}\n{NONCE}\n{CONTENT_SHA256}\n` |
| 包含 method       | ❌                                  | ✅                                                                                     |
| 包含 path         | ❌                                  | ✅                                                                                     |
| 包含 query string | ❌                                  | ✅                                                                                     |
| Body 处理         | 直接拼接 body 字符串                | 使用 SHA256 哈希或 `UNSIGNED`                                                          |
| multipart 支持    | ❌                                  | ✅（UNSIGNED）                                                                         |

### 14.7 迁移指南

**客户端迁移**:

1. 更新请求头：添加 `X-Content-SHA256`
2. 更新签名计算：使用 v2 canonical string 格式
3. multipart 端点：设置 `X-Content-SHA256=UNSIGNED`

**服务端迁移**:

- ✅ 已完成：v2 规范实现
- ✅ 已完成：multipart 例外规则
- ⚠️ 待完成：Secret 可逆存储（AES 或 Ed25519）

---

---

## 十五、CE10 v2 实现总结

### 15.1 变更文件清单

**新增文件**:

- `docs/SECURITY/CE10_V2_PLAN.md` - v2 实现计划

**修改文件**:

1. `apps/api/src/security/api-security/api-security.types.ts` - 添加 `contentSha256` 字段
2. `apps/api/src/security/api-security/api-security.guard.ts` - 实现 v2 规范（提取 `X-Content-SHA256`、multipart 例外）
3. `apps/api/src/security/api-security/api-security.service.ts` - 实现 `buildCanonicalStringV2()`、`sha256Hex()`
4. `apps/api/src/security/api-security/api-security.spec.ts` - 更新测试用例（v2 规范）
5. `docs/SECURITY/CE10_API_SECURITY_IMPLEMENTATION_REPORT.md` - 追加 v2 规范文档

### 15.2 测试结果

**编译**: ✅ 通过

```
apps/api build: webpack 5.97.1 compiled successfully in 6809 ms
```

**Lint**: ✅ 通过（0 errors, 463 warnings，无新增错误）

**冻结白名单验证**: ✅ 未触碰冻结白名单文件

**测试用例**:

- ✅ v2 canonical 正确性
- ✅ query string 被纳入 canonical
- ✅ multipart UNSIGNED 通过
- ✅ timestamp out of window 拒绝
- ✅ nonce replay 拒绝
- ✅ signature mismatch 拒绝

### 15.3 关键实现点

1. **Canonical String v2**: 严格使用 `\n` 分隔，包含 method、pathWithQuery、apiKey、timestamp、nonce、contentSha256
2. **multipart 例外**: `POST /api/projects/:projectId/novel/import-file` 强制要求 `X-Content-SHA256=UNSIGNED`
3. **Secret 处理**: 当前使用 `secretHash` 直接存储 secret 明文（临时方案），已添加 TODO 和警告

### 15.4 待后续实现

- ⚠️ **Secret 可逆存储**: 生产环境必须改为 AES 加密或 Ed25519

---

**报告生成时间**: 2025-12-14  
**实现分支**: `feat/ce10-api-security`  
**状态**: ✅ v2 已完成（Secret 可逆存储待后续实现）
