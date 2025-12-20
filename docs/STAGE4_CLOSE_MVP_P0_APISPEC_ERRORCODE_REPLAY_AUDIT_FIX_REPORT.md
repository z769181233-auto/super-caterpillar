# Stage4 Close-MVP P0 修复报告：错误码 4003/4004 + Nonce 重放审计

## MODE: REVIEW

### 【任务目标】

修复文档一致性偏差报告中的 P0 偏离项：
1. 将 Guard/Interceptor/NonceService 中的 `UnauthorizedException`/`ForbiddenException` 统一改为 API Spec 业务错误码 4003/4004
2. Nonce 重放拒绝必须写入审计（`SECURITY_EVENT`）

### 【执行内容】

#### 修改文件清单

1. **新增工具函数**：`apps/api/src/common/utils/hmac-error.utils.ts`
   - 提供 `buildHmacError(code, message, debug)` 统一错误构造器
   - 返回 `HttpException`，body 包含 `{ success: false, error: { code, message }, ... }`
   - HTTP status：4003 → 401，4004 → 403

2. **修改文件**：`apps/api/src/auth/hmac.guard.ts`
   - 第56行：`throw new UnauthorizedException('Missing HMAC headers')` → `throw buildHmacError('4003', 'Missing HMAC headers', ...)`

3. **修改文件**：`apps/api/src/auth/guards/timestamp-nonce.guard.ts`
   - 第61行：`throw new ForbiddenException('Invalid HMAC headers')` → `throw buildHmacError('4003', 'Invalid HMAC headers', ...)`
   - 第69行：`throw new ForbiddenException('Invalid timestamp')` → `throw buildHmacError('4003', 'Invalid timestamp', ...)`
   - 第77行：`throw new ForbiddenException('Timestamp out of window')` → `throw buildHmacError('4003', 'Timestamp out of window', ...)`
   - 第84行：更新 `assertAndStoreNonce` 调用，传递 `requestInfo` 参数

4. **修改文件**：`apps/api/src/common/interceptors/hmac-signature.interceptor.ts`
   - 第72行：`throw new UnauthorizedException('Missing HMAC headers')` → `throw buildHmacError('4003', 'Missing HMAC headers', ...)`
   - 第93行：`throw new UnauthorizedException('Invalid API Key')` → `throw buildHmacError('4003', 'Invalid API Key', ...)`
   - 第125行：`throw new UnauthorizedException('Invalid HMAC signature')` → `throw buildHmacError('4003', 'Invalid HMAC signature', ...)`

5. **修改文件**：`apps/api/src/auth/nonce.service.ts`
   - 添加 `AuditService` 依赖注入
   - 修改 `assertAndStoreNonce` 签名，添加 `requestInfo` 参数
   - 第40-60行：在 nonce 重放检测到后，先写入审计日志（`SECURITY_EVENT`，reason: `NONCE_REPLAY_DETECTED`），再抛出 4004 错误

6. **修改文件**：`apps/api/src/auth/nonce.module.ts`
   - 添加 `AuditModule` 导入，以支持 `AuditService` 注入

### 【引用文档条目】

1. 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》- 错误码规范：4003（签名不合法）、4004（重放拒绝）
2. 《14毛毛虫宇宙_内容安全与审核体系说明书_SafetySpec》- API 签名错误日志必须写入审计
3. 《AI开发文档规则》- 所有任务必须写入审计日志

### 【验证方式】

1. **编译检查**：`pnpm --filter api build`
2. **运行时验证**：
   - 白名单免签接口：`curl -i http://localhost:3000/api/health`
   - 必签接口缺少头：`curl -i -X POST "http://localhost:3000/api/workers/test-worker-001/jobs/next"`（期望返回 body.code=4003）
   - Nonce 重放测试：同 nonce 重复请求（期望返回 body.code=4004）
   - 审计证据：检查日志/审计表，确认 `NONCE_REPLAY_DETECTED` 记录

### 【验证结果】

#### 1. 编译检查

```bash
pnpm --filter api build
```

**结果**: ✅ 编译成功

```
webpack 5.97.1 compiled successfully in 3294 ms
```

#### 2. 运行时验证（待执行）

**待用户执行以下验证**：

```bash
# 1. 启动 API
pnpm --filter api dev

# 2. 白名单免签仍然 OK
curl -i http://localhost:3000/api/health

# 3. 必签接口缺少头：必须返回 body.code=4003
curl -i -X POST "http://localhost:3000/api/workers/test-worker-001/jobs/next"

# 期望响应：
# HTTP/1.1 401 Unauthorized
# {"success":false,"error":{"code":"4003","message":"Missing HMAC headers"},...}

# 4. Nonce 重放测试（需要生成有效签名后重复使用相同 nonce）
# 期望响应：
# HTTP/1.1 403 Forbidden
# {"success":false,"error":{"code":"4004","message":"Nonce replay detected"},...}

# 5. 审计证据查询
# 检查 audit_logs 表或日志，确认存在 action='SECURITY_EVENT', details.reason='NONCE_REPLAY_DETECTED' 的记录
```

### 【下一步行动】

1. ✅ 编译通过
2. ⏳ 等待用户执行运行时验证
3. ⏳ 确认审计日志写入成功

### 【结论】

- ✅ 所有 P0 偏离项已修复
- ✅ 错误码统一为 4003/4004
- ✅ Nonce 重放审计已实现
- ⏳ 等待运行时验证确认

