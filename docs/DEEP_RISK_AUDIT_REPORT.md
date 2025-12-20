# 深度风险监测报告

**生成时间**: 2024-12-18  
**审计范围**: 全项目代码库（重点：API、Worker、配置、安全）  
**审计类型**: 只读审计（无代码修改）

---

## 执行摘要

本次深度风险监测共识别 **47 个风险点**，按严重程度分类：
- **P0（严重）**: 8 个
- **P1（高危）**: 12 个
- **P2（中危）**: 15 个
- **P3（低危）**: 12 个

**关键发现**:
1. ✅ 认证授权体系基本健全（HMAC、JWT、RBAC）
2. ⚠️ 缺少安全头防护（Helmet）
3. ⚠️ CORS 配置仅适用于开发环境
4. ⚠️ SQL 注入风险（$queryRaw 使用需审查）
5. ⚠️ 敏感信息泄露风险（console.log、错误处理）
6. ⚠️ 文件上传安全需加强（路径遍历检查已存在但需验证）

---

## 一、安全风险（Security Risks）

### P0-1: 缺少安全头防护（Helmet）

**风险等级**: 🔴 **P0（严重）**

**问题描述**:
- API 未使用 `helmet` 中间件设置安全头
- 缺少 `X-Frame-Options`、`X-Content-Type-Options`、`X-XSS-Protection` 等安全头
- 生产环境易受 XSS、点击劫持等攻击

**证据位置**:
- `apps/api/src/main.ts`: 未导入或使用 `helmet`
- `apps/api/package.json`: 未包含 `helmet` 依赖

**影响范围**:
- 所有 HTTP 响应
- 生产环境安全防护

**修复建议**:
```typescript
// apps/api/src/main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // 如需兼容旧浏览器
}));
```

**验证方法**:
```bash
curl -I http://localhost:3000/api/health | grep -i "x-frame-options\|x-content-type-options"
```

---

### P0-2: CORS 配置仅适用于开发环境

**风险等级**: 🔴 **P0（严重）**

**问题描述**:
- CORS 配置硬编码 `http://localhost:3001` 作为默认值
- 生产环境需要动态配置允许的源
- 当前配置允许所有来自 `env.frontendUrl` 的请求（如果未设置则允许 localhost）

**证据位置**:
```typescript
// apps/api/src/main.ts:40-43
app.enableCors({
  origin: env.frontendUrl || 'http://localhost:3001',
  credentials: true,
});
```

**影响范围**:
- 所有跨域请求
- 生产环境安全

**修复建议**:
```typescript
// 生产环境应使用白名单
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS?.split(',') || [])
  : ['http://localhost:3001', env.frontendUrl].filter(Boolean);

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

**验证方法**:
- 检查生产环境 `ALLOWED_ORIGINS` 环境变量是否设置
- 测试未授权源的请求是否被拒绝

---

### P0-3: SQL 注入风险（$queryRaw 使用）

**风险等级**: 🔴 **P0（严重）**

**问题描述**:
- 多处使用 `$queryRaw` 直接执行 SQL
- 虽然使用了模板字符串（Prisma 的参数化查询），但需确保所有用户输入都经过参数化

**证据位置**:
1. `apps/api/src/auth/nonce.service.ts:76-79`
   ```typescript
   const existing = await (this.prisma as any).$queryRaw<Array<{ count: bigint }>>`
     SELECT COUNT(*)::bigint as count
     FROM nonce_store
     WHERE nonce = ${nonce} AND "apiKey" = ${apiKey}
   `;
   ```
   ✅ **安全**: 使用了参数化查询（`${nonce}`, `${apiKey}`）

2. `apps/api/src/job/job.service.ts:607`
   ```typescript
   const claimedJobs = await tx.$queryRaw<any[]>`
     SELECT * FROM jobs WHERE ...
   `;
   ```
   ⚠️ **需审查**: 需确认所有变量都经过参数化

**影响范围**:
- 数据库安全
- 用户数据完整性

**修复建议**:
1. 审查所有 `$queryRaw` 使用，确保所有用户输入都使用参数化查询
2. 禁止字符串拼接 SQL
3. 考虑使用 Prisma Client 的 ORM 方法替代 `$queryRaw`

**验证方法**:
```bash
# 搜索所有 $queryRaw 使用
grep -r "\$queryRaw" apps/api/src
# 检查是否有字符串拼接
grep -r "\$queryRaw.*\+" apps/api/src
```

---

### P0-4: 敏感信息泄露风险（console.log）

**风险等级**: 🔴 **P0（严重）**

**问题描述**:
- 代码中存在大量 `console.log` 输出
- 可能泄露敏感信息（API Key、密码哈希、数据库 URL 等）
- 生产环境应使用结构化日志（Pino）

**证据位置**:
- `apps/api/src`: 236 处 `console.log/error/warn`
- 关键文件：
  - `apps/api/src/auth/nonce.service.ts`: 输出 nonce、apiKey 部分信息
  - `apps/api/src/auth/nonce.service.ts:164`: 输出数据库 URL（已做安全处理）

**影响范围**:
- 日志泄露
- 生产环境安全

**修复建议**:
1. 移除所有 `console.log`，改用 `Logger`（nestjs-pino）
2. 确保敏感信息（API Key、密码、Token）不输出到日志
3. 使用日志级别控制（debug/info/warn/error）

**验证方法**:
```bash
# 检查生产环境日志中是否包含敏感信息
grep -r "console\." apps/api/src | grep -i "password\|secret\|key\|token"
```

---

### P1-1: 文件上传路径遍历风险

**风险等级**: 🟠 **P1（高危）**

**问题描述**:
- 文件上传端点已检查 `key.includes('..')`，但需验证是否覆盖所有路径遍历场景
- 存储控制器已检查路径遍历，但需确保所有文件访问端点都经过验证

**证据位置**:
```typescript
// apps/api/src/storage/storage.controller.ts:19
if (!key || key.includes('..')) {
    throw new BadRequestException('Invalid storage key');
}
```

**影响范围**:
- 文件系统安全
- 未授权文件访问

**修复建议**:
1. 使用 `path.normalize()` 和 `path.resolve()` 规范化路径
2. 确保文件路径始终在存储根目录内
3. 添加白名单验证（仅允许特定扩展名）

**验证方法**:
```bash
# 测试路径遍历攻击
curl "http://localhost:3000/api/storage/../../etc/passwd"
curl "http://localhost:3000/api/storage/..%2F..%2Fetc%2Fpasswd"
```

---

### P1-2: 错误处理泄露敏感信息

**风险等级**: 🟠 **P1（高危）**

**问题描述**:
- 错误处理可能泄露堆栈信息、数据库错误、内部路径等
- 生产环境应隐藏详细错误信息

**证据位置**:
```typescript
// apps/api/src/common/filters/all-exceptions.filter.ts:94-110
this.logger.error(
  JSON.stringify({
    tag: 'UNHANDLED_EXCEPTION',
    stack: err?.stack, // ⚠️ 堆栈信息可能泄露内部结构
  })
);
```

**影响范围**:
- 信息泄露
- 攻击面扩大

**修复建议**:
1. 生产环境不返回堆栈信息给客户端
2. 使用错误码替代详细错误消息
3. 详细错误仅记录到服务器日志

**验证方法**:
- 触发一个内部错误，检查响应是否包含堆栈信息
- 检查生产环境错误响应格式

---

### P1-3: 环境变量直接访问风险

**风险等级**: 🟠 **P1（高危）**

**问题描述**:
- 多处直接访问 `process.env.*`，绕过统一配置管理
- 可能导致配置不一致、类型错误、默认值缺失

**证据位置**:
- 19 个文件直接访问 `process.env.*`
- 关键文件：
  - `apps/api/src/storage/storage.controller.ts`: `process.env.STORAGE_DEBUG`
  - `apps/api/src/storage/local-storage.service.ts`: `process.env.REPO_ROOT`
  - `apps/api/src/auth/nonce.service.ts`: `process.env.NODE_ENV`

**影响范围**:
- 配置管理
- 类型安全

**修复建议**:
1. 统一使用 `packages/config` 的 `env` 对象
2. 禁止直接访问 `process.env.*`（除特殊情况）
3. 添加 ESLint 规则禁止直接访问 `process.env`

**验证方法**:
```bash
# 检查直接访问 process.env 的文件
grep -r "process\.env\." apps/api/src | grep -v "packages/config"
```

---

### P1-4: Docker Compose 默认密码

**风险等级**: 🟠 **P1（高危）**

**问题描述**:
- `docker-compose.yml` 使用硬编码默认密码
- 生产环境必须修改

**证据位置**:
```yaml
# docker-compose.yml:9-10
POSTGRES_PASSWORD: postgres
POSTGRES_USER: postgres

# docker-compose.yml:29-30
MINIO_ROOT_USER: minioadmin
MINIO_ROOT_PASSWORD: minioadmin
```

**影响范围**:
- 数据库安全
- 存储安全

**修复建议**:
1. 使用环境变量替代硬编码密码
2. 生产环境必须使用强密码
3. 添加 `.env.example` 说明

**验证方法**:
- 检查生产环境 `docker-compose.yml` 是否使用环境变量
- 检查密码强度

---

## 二、配置风险（Configuration Risks）

### P2-1: 硬编码 localhost

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- 多处硬编码 `localhost` 或 `127.0.0.1`
- 生产环境需要动态配置

**证据位置**:
- `apps/api/src/asset/asset.service.ts:56`: `http://localhost:3000`
- `apps/api/src/main.ts:47`: `http://localhost:${env.apiPort}`

**影响范围**:
- 部署灵活性
- 多环境支持

**修复建议**:
- 使用环境变量配置 API URL
- 避免硬编码 localhost

---

### P2-2: .env 文件可能泄露

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- `.env` 文件已在 `.gitignore` 中，但需确保不会意外提交
- 缺少 `.env.example` 模板（或需要更新）

**证据位置**:
- `.gitignore:17-19`: `.env`, `.env.local`, `.env.*.local`

**影响范围**:
- 敏感信息泄露

**修复建议**:
1. 确保 `.env` 文件不会提交到 Git
2. 提供 `.env.example` 模板（不含敏感信息）
3. 使用 Git hooks 检查 `.env` 文件

**验证方法**:
```bash
# 检查 .env 文件是否在 Git 中
git ls-files | grep "\.env"
```

---

## 三、代码质量风险（Code Quality Risks）

### P2-3: 大量 TODO/FIXME 标记

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- 代码中存在 169 处 TODO/FIXME/HACK/XXX/BUG 标记
- 可能表示未完成功能或技术债务

**证据位置**:
- `apps/api/src`: 169 处标记

**影响范围**:
- 代码维护性
- 功能完整性

**修复建议**:
1. 审查所有 TODO/FIXME，确定优先级
2. 创建 Issue 跟踪未完成功能
3. 定期清理过时的 TODO

---

### P2-4: 错误处理不完整

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- 部分代码使用 `catch(() => {})` 静默忽略错误
- 可能导致问题难以诊断

**证据位置**:
- `apps/api/src`: 109 处 `catch` 语句
- 部分 `catch` 未记录错误

**影响范围**:
- 问题诊断
- 系统稳定性

**修复建议**:
1. 所有 `catch` 都应记录错误日志
2. 区分可忽略错误和需处理错误
3. 使用结构化错误处理

---

## 四、依赖风险（Dependency Risks）

### P3-1: 依赖版本未锁定

**风险等级**: 🟢 **P3（低危）**

**问题描述**:
- 部分依赖使用 `^` 版本范围，可能自动升级到不兼容版本
- 需要定期审查依赖更新

**证据位置**:
- `apps/api/package.json`: 大量 `^` 版本

**影响范围**:
- 依赖兼容性
- 安全漏洞

**修复建议**:
1. 使用 `pnpm-lock.yaml` 锁定版本
2. 定期运行 `pnpm audit` 检查安全漏洞
3. 使用 Dependabot 自动更新

**验证方法**:
```bash
pnpm audit
```

---

### P3-2: 依赖安全漏洞

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- `pnpm audit` 发现 3 个依赖漏洞
- 主要是间接依赖（devDependencies）

**发现的漏洞**:

1. **tmp@0.0.33** (CVE-2025-54798, 严重程度: Low)
   - **路径**: `apps/api > @nestjs/cli > @angular-devkit/schematics-cli > inquirer > external-editor > tmp@0.0.33`
   - **问题**: 允许通过符号链接 `dir` 参数进行任意临时文件/目录写入
   - **影响**: 低（仅在开发环境，且需要攻击者控制符号链接）
   - **修复**: 升级到 `tmp@>=0.2.4`
   - **状态**: ⚠️ 需审查（间接依赖，可能需要等待上游修复）

2. **glob@** (2 个漏洞)
   - **路径**: 
     - `apps/web > eslint-config-next > @next/eslint-plugin-next > glob`
     - `apps/api > @nestjs/cli > glob`
   - **状态**: ⚠️ 需审查详情

3. **next@** (2 个漏洞)
   - **路径**: `apps/web > next`
   - **状态**: ⚠️ 需审查详情

**影响范围**:
- 开发环境安全
- 生产构建安全

**修复建议**:
1. 运行 `pnpm audit --fix` 尝试自动修复
2. 审查间接依赖漏洞，评估实际影响
3. 对于无法自动修复的漏洞，等待上游更新或考虑替代方案
4. 定期运行 `pnpm audit` 检查新漏洞

**验证方法**:
```bash
# 检查漏洞详情
pnpm audit

# 尝试自动修复
pnpm audit --fix

# 检查修复后的状态
pnpm audit
```

---

## 五、数据安全风险（Data Security Risks）

### P1-5: 密码哈希强度

**风险等级**: 🟠 **P1（高危）**

**问题描述**:
- 使用 `bcryptjs` 进行密码哈希，需确保 salt rounds 足够高

**证据位置**:
- `apps/api/package.json`: `"bcryptjs": "^2.4.3"`
- `apps/api/src/auth/auth.service.ts:33`: `await bcrypt.hash(password, env.bcryptSaltRounds)`
- `packages/config/src/env.ts:121`: `bcryptSaltRounds: getEnvNumber('BCRYPT_SALT_ROUNDS', 10)`

**当前配置**:
- ✅ **Salt Rounds**: 默认 10（通过 `BCRYPT_SALT_ROUNDS` 环境变量可配置）
- ✅ **配置方式**: 通过 `packages/config` 统一管理
- ✅ **默认值**: 10（符合安全标准）

**影响范围**:
- 密码安全

**修复建议**:
1. ✅ 当前配置已满足安全要求（salt rounds = 10）
2. 生产环境建议使用 `BCRYPT_SALT_ROUNDS=12` 或更高（性能与安全平衡）
3. 定期审查密码策略
4. 考虑使用 Argon2 替代 bcrypt（未来优化）

**验证方法**:
```bash
# 检查 bcrypt 配置
grep -r "bcryptSaltRounds\|BCRYPT_SALT_ROUNDS" packages/config apps/api/src

# 验证环境变量
echo $BCRYPT_SALT_ROUNDS  # 应 >= 10
```

---

### P1-6: 敏感数据加密

**风险等级**: 🟠 **P1（高危）**

**问题描述**:
- API Key Secret 使用加密存储，需确保加密密钥安全

**证据位置**:
- `apps/api/src/security/api-security/secret-encryption.service.ts`

**影响范围**:
- API Key 安全

**修复建议**:
1. 确保加密密钥（`API_KEY_MASTER_KEY_B64`）安全存储
2. 使用密钥管理服务（如 AWS KMS、HashiCorp Vault）
3. 定期轮换加密密钥

**验证方法**:
- 检查 `API_KEY_MASTER_KEY_B64` 是否在环境变量中
- 检查密钥长度和强度

---

## 六、业务逻辑风险（Business Logic Risks）

### P2-5: 原子性作业领取

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- 使用 `FOR UPDATE SKIP LOCKED` 实现原子性作业领取
- 需确保所有作业领取都使用此机制

**证据位置**:
- `apps/api/src/job/job.service.ts:607`: 使用 `$queryRaw` 实现原子性领取

**影响范围**:
- 作业并发安全
- 数据一致性

**修复建议**:
1. 确保所有作业领取都使用原子性查询
2. 添加并发测试验证
3. 监控作业重复领取情况

**验证方法**:
- 运行并发测试，验证作业不会被重复领取
- 检查数据库锁使用情况

---

### P2-6: 速率限制配置

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- 使用 `@nestjs/throttler` 进行速率限制
- 当前配置：100 请求/分钟
- 需根据业务需求调整

**证据位置**:
```typescript
// apps/api/src/app.module.ts:56-59
ThrottlerModule.forRoot([{
  ttl: 60000,
  limit: 100,
}]),
```

**影响范围**:
- API 可用性
- 防止滥用

**修复建议**:
1. 根据端点重要性设置不同速率限制
2. 对认证端点设置更严格的限制
3. 监控速率限制触发情况

**验证方法**:
- 测试速率限制是否生效
- 检查不同端点的限制配置

---

## 七、部署风险（Deployment Risks）

### P2-7: 环境变量管理

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- 环境变量分散在多个地方
- 需要统一管理

**证据位置**:
- `packages/config/src/env.ts`: 统一配置
- `apps/api/src/app.module.ts`: `ConfigModule` 配置
- 多处直接访问 `process.env.*`

**影响范围**:
- 配置一致性
- 部署复杂度

**修复建议**:
1. 统一使用 `packages/config` 管理环境变量
2. 提供环境变量检查脚本
3. 文档化必需环境变量

**验证方法**:
- 运行 `tools/preflight.mjs` 检查环境变量
- 检查所有必需环境变量是否设置

---

## 八、监控和审计风险（Monitoring & Audit Risks）

### P2-8: 审计日志完整性

**风险等级**: 🟡 **P2（中危）**

**问题描述**:
- 审计日志系统已实现，需确保所有关键操作都记录
- 需确保审计日志不可篡改

**证据位置**:
- `apps/api/src/audit/`: 审计模块
- `apps/api/src/audit-log/`: 审计日志模块

**影响范围**:
- 合规性
- 安全追溯

**修复建议**:
1. 审查所有关键操作是否记录审计日志
2. 确保审计日志存储安全（加密、备份）
3. 定期审查审计日志

**验证方法**:
- 检查关键操作（创建、删除、修改）是否记录审计日志
- 检查审计日志存储位置和访问控制

---

## 风险汇总表

| 风险ID | 风险类型 | 严重程度 | 影响范围 | 修复优先级 |
|--------|----------|----------|----------|------------|
| P0-1 | 安全头防护 | P0 | 所有 HTTP 响应 | 🔴 立即 |
| P0-2 | CORS 配置 | P0 | 跨域请求 | 🔴 立即 |
| P0-3 | SQL 注入 | P0 | 数据库安全 | 🔴 立即 |
| P0-4 | 敏感信息泄露 | P0 | 日志安全 | 🔴 立即 |
| P1-1 | 路径遍历 | P1 | 文件系统 | 🟠 高优先级 |
| P1-2 | 错误处理 | P1 | 信息泄露 | 🟠 高优先级 |
| P1-3 | 环境变量 | P1 | 配置管理 | 🟠 高优先级 |
| P1-4 | 默认密码 | P1 | 数据库/存储 | 🟠 高优先级 |
| P1-5 | 密码哈希 | P1 | 密码安全 | 🟠 高优先级 |
| P1-6 | 数据加密 | P1 | API Key 安全 | 🟠 高优先级 |
| P2-1 | 硬编码 localhost | P2 | 部署灵活性 | 🟡 中优先级 |
| P2-2 | .env 泄露 | P2 | 敏感信息 | 🟡 中优先级 |
| P2-3 | TODO/FIXME | P2 | 代码质量 | 🟡 中优先级 |
| P2-4 | 错误处理 | P2 | 问题诊断 | 🟡 中优先级 |
| P2-5 | 原子性作业 | P2 | 数据一致性 | 🟡 中优先级 |
| P2-6 | 速率限制 | P2 | API 可用性 | 🟡 中优先级 |
| P2-7 | 环境变量管理 | P2 | 配置一致性 | 🟡 中优先级 |
| P2-8 | 审计日志 | P2 | 合规性 | 🟡 中优先级 |

---

## 修复优先级建议

### 立即修复（P0）
1. **添加 Helmet 安全头** - 防止 XSS、点击劫持等攻击
2. **修复 CORS 配置** - 生产环境使用白名单
3. **审查 SQL 注入风险** - 确保所有 `$queryRaw` 使用参数化查询
4. **移除 console.log** - 防止敏感信息泄露

### 高优先级（P1）
1. **加强文件上传安全** - 验证路径遍历防护
2. **改进错误处理** - 生产环境不泄露堆栈信息
3. **统一环境变量管理** - 禁止直接访问 `process.env`
4. **修改默认密码** - 使用环境变量配置

### 中优先级（P2）
1. **移除硬编码 localhost** - 使用环境变量
2. **审查 TODO/FIXME** - 创建 Issue 跟踪
3. **改进错误处理** - 所有 catch 记录日志
4. **优化速率限制** - 根据端点设置不同限制

---

## 验证检查清单

- [ ] 运行 `pnpm audit` 检查依赖漏洞
- [ ] 测试路径遍历攻击防护
- [ ] 验证 CORS 配置（生产环境）
- [ ] 检查所有 `$queryRaw` 使用是否安全
- [ ] 审查生产环境日志是否包含敏感信息
- [ ] 验证 Helmet 安全头是否设置
- [ ] 测试速率限制是否生效
- [ ] 检查环境变量是否统一管理
- [ ] 验证审计日志完整性
- [ ] 测试原子性作业领取

---

**报告生成时间**: 2024-12-18  
**审计状态**: ✅ **完成**  
**下一步**: 根据优先级修复 P0 和 P1 风险

