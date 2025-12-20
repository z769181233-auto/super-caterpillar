# Stage5 P0 最终验收执行指南

## 前置条件

1. ✅ 代码修复已完成（`apps/api/src/auth/nonce.service.ts`）
2. ✅ Prisma Client 已重新生成
3. ✅ 验证脚本已创建（`tools/dev/stage5-p0-verification.sh`）
4. ⏳ **API 服务需要运行**

## 执行步骤

### 步骤 1: 启动 API 服务

```bash
pnpm --filter api dev
```

**等待看到**: `Nest application successfully started` 或 `API Server is running on: http://localhost:3000`

### 步骤 2: 执行 P0 自动验证脚本

在**新的终端窗口**中执行：

```bash
cd /Users/adam/Desktop/adam/毛毛虫宇宙/Super\ Caterpillar
bash tools/dev/stage5-p0-verification.sh
```

**必须满足的 4 个硬条件**:
1. ✅ 第一次请求：≠ 4003 / ≠ 4004
2. ✅ nonce_store：COUNT > 0（能查到第一次请求的 nonce）
3. ✅ 第二次请求（同 nonce）：必须返回 4004
4. ✅ audit_logs：只能在第二次请求产生 NONCE_REPLAY_DETECTED

### 步骤 3: 运行 E2E 测试

```bash
HMAC_API_KEY="ak_worker_dev_0000000000000000" \
HMAC_SECRET="super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678" \
API_BASE_URL="http://localhost:3000" \
pnpm exec ts-node apps/api/test/hmac-security.e2e-spec.ts
```

**必须看到**: `通过: 4/4`

### 步骤 4: 记录验证结果

将以下信息记录到报告中：
- 验证脚本的完整输出
- E2E 测试的完整输出
- nonce_store 查询结果
- audit_logs 查询结果

## 验收标准

**Stage5 = DONE 的条件（缺一不可）**:
1. ✅ 自动脚本 PASS（4 个硬条件全部满足）
2. ✅ E2E 4/4 PASS
3. ✅ 报告更新完成（真实证据）

**否则**: Stage5 = NOT DONE

