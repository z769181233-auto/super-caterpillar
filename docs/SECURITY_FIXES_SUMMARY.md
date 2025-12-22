# 安全风险修复总结

## 修复时间
2025-12-18

## 修复的风险项

### P1 - 僵尸任务自愈缺失 ✅

**问题**: JobService 缺失对长期处于 `RUNNING` 状态任务的清理/重置逻辑。

**修复**:
- 创建 `JobWatchdogService`，每 5 分钟扫描并恢复僵尸任务
- 检查 Worker 心跳超时，自动将任务恢复为 RETRYING 状态
- 支持 Feature Flag: `JOB_WATCHDOG_ENABLED=true`

**文件**:
- `apps/api/src/job/job-watchdog.service.ts` (新建)
- `apps/api/src/job/job.module.ts` (注册服务)
- `apps/api/src/app.module.ts` (导入 ScheduleModule)

---

### P1 - 鉴权时效性缺口 ✅

**问题**: `JwtStrategy` 盲目信任 JWT 载荷中的 `orgId`，缺失每请求归属校验。

**修复**:
- 在 `JwtStrategy.validate` 中增加实时组织成员身份校验
- 检查用户是否仍然是组织成员或组织所有者
- 用户被移出组织后，旧 Token 立即失效

**文件**:
- `apps/api/src/auth/jwt.strategy.ts`

**代码变更**:
```typescript
// 修复前：直接从 payload 获取
organizationId: payload.orgId || null

// 修复后：实时校验
const membership = await this.prisma.organizationMember.findFirst({
  where: { organizationId: payload.orgId, userId: user.id },
});
// 验证通过后才返回 organizationId
```

---

### P1 - 日志敏感信息泄露 ✅

**问题**: `AllExceptionsFilter` 在记录异常时包含全量 Stack Trace。

**修复**:
- 生产环境不输出 stack trace 和 payload
- 仅记录 errorId 用于追踪
- 开发环境保持完整信息输出

**文件**:
- `apps/api/src/common/filters/all-exceptions.filter.ts`

**代码变更**:
```typescript
// 修复前：生产环境也输出 stack
stack: err?.stack

// 修复后：生产环境仅记录 errorId
if (isProduction) {
  // 仅记录 errorId，不输出 stack
} else {
  // 开发环境输出完整信息
}
```

---

### P2 - 定时器炸弹风险 ✅

**问题**: HMAC Nonce 回退机制为每条 nonce 启动独立定时器。

**修复**:
- 移除独立 `setTimeout`，改用统一清理任务
- 使用 `@Cron` 装饰器，每 1 分钟清理一次过期 nonce
- 避免高并发场景下事件循环拥堵

**文件**:
- `apps/api/src/auth/hmac/hmac-auth.service.ts`

**代码变更**:
```typescript
// 修复前：每个 nonce 独立定时器
setTimeout(() => this.nonceCache.delete(key), this.NONCE_TTL);

// 修复后：统一清理任务
@Cron(CronExpression.EVERY_MINUTE)
cleanupExpiredNonces(): void {
  // 统一清理所有过期 nonce
}
```

---

## 生产开关加固

### ✅ 直接存储访问控制

**修复**: `ALLOW_DIRECT_STORAGE_ACCESS=false` 时，`/api/storage/:key` 统一返回 404

**文件**: `apps/api/src/storage/storage.controller.ts`

---

### ✅ Nginx 直出强制

**修复**: `STORAGE_ACCEL_REDIRECT_ENABLED=true` 时，确保走 X-Accel-Redirect（API 不读文件）

**文件**: `apps/api/src/storage/storage.controller.ts`

---

### ✅ CORS 生产强制

**修复**: `NODE_ENV=production` 时，`CORS_ORIGINS` 缺失则启动失败

**文件**: `apps/api/src/main.ts`

**代码变更**:
```typescript
if (env.isProduction) {
  if (!process.env.CORS_ORIGINS) {
    logger.error('[FATAL] CORS_ORIGINS is required in production');
    process.exit(1);
  }
}
```

---

## 验证

运行门禁验证脚本：
```bash
bash tools/gate/run_launch_gates.sh
```

**预期输出**:
- ✅ Direct access 404
- ✅ Signed range 206 (如果有有效签名 URL)
- ✅ Expired/tampered/unauthorized 全 404
- ✅ CORS 生产白名单生效（不再出现 localhost）

---

## 环境变量

新增/修改的环境变量：
- `JOB_WATCHDOG_ENABLED=true`: 启用任务看门狗（默认启用）
- `JOB_WATCHDOG_TIMEOUT_MS=3600000`: 任务超时时间（默认 1 小时）
- `ALLOW_DIRECT_STORAGE_ACCESS=false`: 禁用直接存储访问（生产环境）
- `STORAGE_ACCEL_REDIRECT_ENABLED=true`: 启用 Nginx 直出（默认）
- `CORS_ORIGINS`: 生产环境必需，逗号分隔的源列表

---

**修复完成时间**: 2025-12-18  
**验证状态**: 待运行 `tools/gate/run_launch_gates.sh`

