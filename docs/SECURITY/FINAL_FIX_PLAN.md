# 0 雷区 / 0 脆弱终审 - 修复计划

**生成时间**: 2025-12-14  
**审计范围**: 全局、系统级  
**目标**: 制定修复策略（仅修复"必须修"项）

---

## 一、修复项清单

### 1.1 必须修（影响商用）

| 项 | 位置 | 问题 | 风险等级 | 是否影响商用 | 是否影响后续 Stage | 是否需要回滚 |
|----|------|------|----------|--------------|-------------------|--------------|
| **FIX-1** | `apps/api/src/auth/hmac/api-key.service.ts:79-90` | 加密失败错误消息可能泄露信息 | ⚠️ **P1** | ✅ 是 | ❌ 否 | ❌ 否 |

**问题描述**:
- 加密失败时，错误消息包含完整的错误信息（`error.message`）
- 可能泄露系统内部信息（如加密算法、密钥格式等）

**修复方案**:
- 脱敏错误消息，仅返回通用错误信息
- 详细错误信息记录到日志（不返回给客户端）

**修复代码**:
```typescript
// 修改前
throw new BadRequestException(
  `Failed to encrypt secret: ${error.message}. ` +
  'Production environment requires encrypted storage.',
);

// 修改后
this.logger.error(`Failed to encrypt secret: ${error.message}`, error.stack);
throw new BadRequestException(
  'Failed to encrypt secret. Production environment requires encrypted storage.',
);
```

**影响评估**:
- ✅ **不影响功能**: 仅改变错误消息格式
- ✅ **不影响后续 Stage**: 不改变业务逻辑
- ❌ **不需要回滚**: 错误消息改进，无风险

---

### 1.2 建议修（不影响商用，但建议修复）

| 项 | 位置 | 问题 | 风险等级 | 是否影响商用 | 是否影响后续 Stage | 是否需要回滚 |
|----|------|------|----------|--------------|-------------------|--------------|
| **FIX-2** | `apps/api/src/security/api-security/api-security.service.ts:368-370` | Secret 解密失败错误消息可能泄露信息 | ⚠️ **P1** | ❌ 否 | ❌ 否 | ❌ 否 |

**问题描述**:
- 解密失败时，错误消息包含完整的错误信息（`error.message`）
- 可能泄露系统内部信息

**修复方案**:
- 脱敏错误消息，仅返回通用错误信息
- 详细错误信息记录到日志

**修复代码**:
```typescript
// 修改前
throw new InternalServerErrorException(
  `Failed to decrypt secret for API Key ${this.maskApiKey(apiKey)}: ${error.message}`,
);

// 修改后
this.logger.error(
  `Failed to decrypt secret for API Key ${this.maskApiKey(apiKey)}: ${error.message}`,
  error.stack,
);
throw new InternalServerErrorException(
  `Failed to decrypt secret for API Key ${this.maskApiKey(apiKey)}.`,
);
```

**影响评估**:
- ✅ **不影响功能**: 仅改变错误消息格式
- ✅ **不影响后续 Stage**: 不改变业务逻辑
- ❌ **不需要回滚**: 错误消息改进，无风险

---

### 1.3 可选修（不影响商用，可选）

| 项 | 位置 | 问题 | 风险等级 | 是否影响商用 | 是否影响后续 Stage | 是否需要回滚 |
|----|------|------|----------|--------------|-------------------|--------------|
| **FIX-3** | `apps/api/src/auth/hmac/api-key.service.ts:65-96` | 添加环境变量强制禁用 fallback | ⚠️ **P1** | ❌ 否 | ❌ 否 | ❌ 否 |

**问题描述**:
- dev/test 环境可能误配置为生产环境
- 需要额外的安全开关

**修复方案**:
- 添加环境变量 `ALLOW_INSECURE_SECRET_FALLBACK=false` 强制禁用 fallback
- 即使非生产环境，如果设置了此变量，也禁止 fallback

**修复代码**:
```typescript
// 修改前
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  throw new BadRequestException(...);
}

// 修改后
const isProduction = process.env.NODE_ENV === 'production';
const allowFallback = process.env.ALLOW_INSECURE_SECRET_FALLBACK === 'true';
if (isProduction || !allowFallback) {
  throw new BadRequestException(...);
}
```

**影响评估**:
- ✅ **不影响功能**: 仅增加安全开关
- ✅ **不影响后续 Stage**: 不改变业务逻辑
- ❌ **不需要回滚**: 安全增强，无风险

---

## 二、未修项说明

### 2.1 为什么不是雷区

| 项 | 位置 | 为什么不是雷区 |
|----|------|----------------|
| dev/test fallback | `apps/api/src/auth/hmac/api-key.service.ts:65-96` | 生产环境已强制拒绝，dev/test 使用是预期行为 |
| Worker 上报失败重试策略 | `apps/workers/src/api-client.ts:215-250` | 有重试机制，失败不影响 Job 执行结果 |
| API Key 更新失败静默忽略 | `apps/api/src/security/api-security/api-security.service.ts:204-209` | 非关键操作，不影响认证流程 |
| 审计日志写入失败静默忽略 | `apps/api/src/security/api-security/api-security.service.ts:283-311` | 有日志记录，不应阻断主流程 |

---

## 三、修复执行计划

### 3.1 修复顺序

1. **FIX-1**: 加密失败错误消息脱敏（必须修）
2. **FIX-2**: 解密失败错误消息脱敏（建议修）
3. **FIX-3**: 添加环境变量强制禁用 fallback（可选修）

### 3.2 修复原则

- ✅ 不改架构
- ✅ 不引入新机制
- ✅ 不扩大改动面
- ✅ 不触碰冻结白名单

### 3.3 验证方法

- ✅ 编译验证：`pnpm -w --filter api build`
- ✅ Lint 验证：`pnpm -w lint`
- ✅ 冻结白名单验证：`git diff --name-only | grep -E "job\.rules|job\.retry|job\.service|job-worker|orchestrator\.service|worker\.service|env\.ts"`

---

## 四、回滚策略

### 4.1 代码回滚

**命令**:
```bash
git revert <commit-hash>
```

**影响**:
- 仅影响错误消息格式，不影响功能
- 无数据变更，无需数据回滚

### 4.2 环境变量回滚

**FIX-3**（如果实施）:
- 移除 `ALLOW_INSECURE_SECRET_FALLBACK` 环境变量
- 恢复原有行为

---

## 五、总结

### 5.1 必须修项

- ✅ **FIX-1**: 加密失败错误消息脱敏（1 项）

### 5.2 建议修项

- ⚠️ **FIX-2**: 解密失败错误消息脱敏（1 项）

### 5.3 可选修项

- 📋 **FIX-3**: 添加环境变量强制禁用 fallback（1 项）

### 5.4 修复后状态

- ✅ 所有必须修项修复后，达到"商用 0 雷区"标准
- ✅ 建议修项修复后，进一步提升安全性
- ✅ 可选修项修复后，提供额外安全开关

---

**修复计划结论**: ✅ **仅 1 项必须修，修复后达到商用 0 雷区标准**

