# CE10 Secret 加密存储（AES-256-GCM）实现计划

## RESEARCH 发现

### 1. 现有 ApiKey 存储字段

- **表**: `api_keys`
- **字段**:
  - `id`: String (UUID)
  - `key`: String (公钥 ID，如 `ak_xxx`)
  - `secretHash`: String (当前直接存储 secret 明文)
  - `name`: String? (可选名称)
  - `ownerUserId`: String? (关联用户)
  - `ownerOrgId`: String? (关联组织)
  - `status`: ApiKeyStatus (ACTIVE/DISABLED)
  - `lastUsedAt`: DateTime?
  - `expiresAt`: DateTime?

### 2. 当前 secret 创建/写入逻辑

- **位置**: `apps/api/src/auth/hmac/api-key.service.ts`
- **方法**: `createApiKey()`
- **当前实现**:
  - 生成随机 secret（32 字节 hex）
  - 直接写入 `secretHash` 字段（明文存储）
  - 返回包含 secret 的记录（只返回一次）

### 3. 审计日志结构

- **表**: `audit_logs`
- **字段**:
  - `nonce`: String? (已有)
  - `signature`: String? (已有)
  - `timestamp`: DateTime? (已有)
  - `payload`: Json? (已有，可存储完整快照)
- **结论**: 无需新增字段，使用 `payload` JSON 存储额外信息

---

## PLAN: AES-256-GCM 加密存储方案

### 方案选择

**选择方案 A**: AES-256-GCM 加密存储（推荐，落地快）

### 1. DB 字段变更

**新增字段**（在 `ApiKey` 表中）:

- `secretEnc`: String? (base64，加密后的 secret)
- `secretEncIv`: String? (base64，GCM IV)
- `secretEncTag`: String? (base64，GCM 认证标签)
- `secretVersion`: Int? (可选，便于密钥轮换，默认 1)

**保留字段**（兼容性）:

- `secretHash`: String? (改为可选，仅用于 fallback)

**迁移策略**:

- 新创建的 API Key：使用新字段（secretEnc/secretEncIv/secretEncTag）
- 旧 API Key：保留 `secretHash`，允许 fallback（仅 dev/test）
- 生产环境：禁止 fallback，强制使用新字段

### 2. 环境变量

**新增**:

- `API_KEY_MASTER_KEY_B64`: String (32 bytes base64，用于 AES-256-GCM 加密)

**验证**:

- 启动时检查 `API_KEY_MASTER_KEY_B64` 是否存在
- 生产环境缺失时拒绝启动
- dev/test 环境缺失时警告但允许 fallback

### 3. 行为变更

#### 3.1 创建 API Key

1. 生成随机 secret 明文（32 字节）
2. 使用 AES-256-GCM 加密（生成 enc/iv/tag）
3. 入库保存加密后的三元组
4. 返回 secret 明文（只返回一次，禁止写日志）

#### 3.2 验签时读取 secret

1. 优先读取新字段（secretEnc/secretEncIv/secretEncTag）
2. 如果存在新字段：解密得到 secret 明文
3. 如果仅存在旧字段（secretHash）：
   - dev/test: 允许 fallback，但写警告日志
   - 生产: 拒绝并写审计 `INSECURE_SECRET_STORAGE`
4. 所有失败路径写审计日志

### 4. 实现文件

**修改文件**:

1. `packages/database/prisma/schema.prisma` - 新增字段
2. `apps/api/src/auth/hmac/api-key.service.ts` - 改造创建逻辑
3. `apps/api/src/security/api-security/api-security.service.ts` - 改造读取逻辑
4. `packages/config/src/env.ts` - 新增环境变量
5. `apps/api/src/security/api-security/api-security.spec.ts` - 更新测试

**新增文件**:

1. `apps/api/src/security/api-security/secret-encryption.service.ts` - 加密/解密服务

---

## EXECUTE 步骤

### Step 1: Prisma Schema 变更

- 新增 `secretEnc`、`secretEncIv`、`secretEncTag`、`secretVersion` 字段
- `secretHash` 改为可选

### Step 2: 实现 SecretEncryptionService

- `encryptSecret(plainSecret: string): { enc: string; iv: string; tag: string }`
- `decryptSecret(enc: string, iv: string, tag: string): string`
- 使用 AES-256-GCM

### Step 3: 改造 ApiKeyService

- `createApiKey()`: 加密后存储
- 禁止日志输出 secret 明文

### Step 4: 改造 ApiSecurityService

- `resolveSecretForApiKey()`: 优先解密新字段，fallback 旧字段
- 生产环境禁止 fallback

### Step 5: 单测

- master key 缺失
- 解密失败
- 正常解密
- fallback 逻辑（仅 dev/test）

---

## 兼容策略

1. **读取优先级**: 新字段 > 旧字段（仅 dev/test fallback）
2. **写入策略**: 新创建的 API Key 必须使用新字段
3. **迁移脚本**: 可选，批量加密旧 secret（后续实现）

---

## 回滚策略

1. **代码回滚**: `git revert` 相关 commit
2. **数据回滚**: 保留 `secretHash` 字段，允许 fallback
3. **环境变量**: 移除 `API_KEY_MASTER_KEY_B64`（仅 dev/test）
