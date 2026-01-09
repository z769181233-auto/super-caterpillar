# 上线门禁检查清单

## 执行时间

生成时间: $(date)

## ⚠️ 重要更新

**安全风险修复完成** (2025-12-18):

- ✅ P1: 僵尸任务自愈缺失 - 已修复
- ✅ P1: 鉴权时效性缺口 - 已修复
- ✅ P1: 日志敏感信息泄露 - 已修复
- ✅ P2: 定时器炸弹风险 - 已修复
- ✅ 生产开关加固完成

详见: `docs/SECURITY_FIXES_SUMMARY.md`

## 门禁 0: 一致性风险修复验证

### 检查项

- [ ] JOB_WORKER_ENABLED 统一使用 packages/config（无 split-brain）

### 验证方法

检查代码中是否还有直接读取 `process.env.JOB_WORKER_ENABLED` 的地方。

### 证据位置

- 代码: `apps/api/src/job/job.module.ts` 应使用 `env.enableInternalJobWorker`
- 代码: `apps/api/src/app.module.ts` 应使用 `env.enableInternalJobWorker`

---

## 门禁 1: 容量门禁功能验证

### 检查项

- [ ] 容量门禁服务正常工作
- [ ] 超过并发限制时返回 429 错误
- [ ] 错误码正确返回给前端
- [ ] 容量查询端点返回正确数据

### 验证命令

```bash
# 1. 检查容量门禁服务是否加载
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/jobs/capacity

# 2. 触发容量超限（需要创建超过限制的 jobs）
# 预期：返回 429 和 CAPACITY_EXCEEDED_CONCURRENT 错误码
```

### 证据位置

- 日志: `apps/api/api.log` 中搜索 `[CapacityGate]`
- API 响应: 429 状态码 + `errorCode: CAPACITY_EXCEEDED_*`
- 截图: 容量查询端点返回数据

---

## 门禁 2: Signed URL 与 Nginx 直出

### 检查项

- [ ] Signed URL 生成正常
- [ ] Nginx X-Accel-Redirect 配置正确
- [ ] 文件直出支持 Range 请求（返回 206）
- [ ] 过期签名无法访问（统一返回 404）
- [ ] 篡改签名无法访问（统一返回 404）
- [ ] 直接访问被拒绝（统一返回 404）
- [ ] 越权访问被拒绝（统一返回 404）

### 验证命令

```bash
# 环境变量设置
export API_URL="http://localhost:3000"
export NGINX_URL="http://localhost"  # 或 http://localhost:8080
export TEST_STORAGE_KEY="videos/test.mp4"
export AUTH_TOKEN_A="<token>"

# 1. 生成签名 URL（通过 API）
curl -H "Authorization: Bearer $AUTH_TOKEN_A" ${API_URL}/api/storage/sign/${TEST_STORAGE_KEY}

# 2. 使用签名 URL 访问（应通过 Nginx，不是 API_URL）
curl -I "${NGINX_URL}/api/storage/signed/videos/test.mp4?expires=xxx&tenantId=xxx&userId=xxx&signature=xxx"

# 3. 测试 Range 请求（通过 Nginx，应返回 206）
curl -H "Range: bytes=0-1023" "${NGINX_URL}/api/storage/signed/videos/test.mp4?expires=xxx&tenantId=xxx&userId=xxx&signature=xxx"

# 4. 测试过期签名（应返回 404，统一防枚举）
curl -I "${NGINX_URL}/api/storage/signed/videos/test.mp4?expires=1&tenantId=test&userId=test&signature=test"

# 5. 测试直接访问（应返回 404）
curl -I "${API_URL}/api/storage/${TEST_STORAGE_KEY}"
```

### 证据位置

- Nginx 配置: `docs/STORAGE_DELIVERY_ARCH.md`
- 日志: Nginx access.log 中查看 X-Accel-Redirect 请求
- API 日志: `apps/api/api.log` 中搜索 `[SignedUrlService]`
- 验证报告: `docs/GATEKEEPER_VERIFICATION_REPORT.md`（包含真实命令和响应码）

---

## 门禁 3: 盗链防护（权限绑定）

### 检查项

- [ ] 签名包含 tenantId + userId
- [ ] 访问前验证资源权限
- [ ] 越权访问返回 404（不泄露存在性）
- [ ] 不同租户无法访问对方资源

### 验证命令

```bash
# 环境变量设置
export API_URL="http://localhost:3000"
export NGINX_URL="http://localhost"
export TEST_STORAGE_KEY="videos/test.mp4"
export AUTH_TOKEN_A="<user_a_token>"
export AUTH_TOKEN_B="<user_b_token>"

# 1. 生成签名（应包含 tenantId + userId）
curl -H "Authorization: Bearer $AUTH_TOKEN_A" ${API_URL}/api/storage/sign/${TEST_STORAGE_KEY}

# 2. 尝试越权访问（使用其他 tenant 的签名，通过 Nginx）
# 预期：404 Not Found（统一防枚举）

# 3. 尝试访问不存在的资源
# 预期：404 Not Found（不区分不存在 vs 无权限）
```

### 证据位置

- 代码: `apps/api/src/storage/signed-url.service.ts` 中签名 payload
- 日志: `apps/api/api.log` 中搜索 `[StorageAuth]` 或权限检查日志
- 测试报告: `docs/GATEKEEPER_VERIFICATION_REPORT.md`

---

## 门禁 4: 压测验收

### 检查项

- [ ] API 负载测试通过（P95 < 500ms）
- [ ] Worker 吞吐量测试通过（成功率 > 95%）
- [ ] 容量门禁在压测下正常工作
- [ ] 无内存泄漏

### 验证命令

```bash
# 1. 运行 API 负载测试
node tools/load/api_smoke_load.js \
  --url http://localhost:3000 \
  --concurrent 10 \
  --requests 100 \
  --endpoint /api/jobs \
  --auth-token <token>

# 2. 运行 Worker 吞吐量测试
export API_URL=http://localhost:3000
export JOB_COUNT=50
export CONCURRENT=5
export AUTH_TOKEN=<token>
./tools/load/worker_throughput_test.sh

# 3. 检查压测报告
cat docs/LAUNCH_CAPACITY_REPORT.md
```

### 证据位置

- 压测输出: 终端输出（P50/P95/P99 数据）
- 报告: `docs/LAUNCH_CAPACITY_REPORT.md`（包含真实数据）
- 监控: `/metrics` 端点数据

---

## 门禁 5: Feature Flags 回滚验证

### 检查项

- [ ] 所有功能开关可配置
- [ ] 禁用开关后功能不生效
- [ ] 回滚仅需改 env + 重启

### 验证命令

```bash
# 1. 禁用容量门禁
export CAPACITY_GATE_ENABLED=false
# 重启 API，验证容量检查不生效

# 2. 禁用 Signed URL
export SIGNED_URL_ENABLED=false
# 重启 API，验证直接访问恢复

# 3. 禁用 Nginx 直出
export STORAGE_ACCEL_REDIRECT_ENABLED=false
# 重启 API，验证回退到 API 直出
```

### 证据位置

- 环境变量: `.env` 文件
- 代码: `apps/api/src/capacity/capacity-gate.service.ts` 中检查 `CAPACITY_GATE_ENABLED`
- 日志: 功能开关状态日志

---

## 门禁 6: E2E 全流程验证

### 检查项

- [ ] 所有 smoke 测试通过
- [ ] Video E2E 测试通过
- [ ] 无回归问题

### 验证命令

```bash
# 1. 运行所有 smoke 测试
bash tools/smoke/run_all.sh

# 2. 运行 Video E2E 测试
bash tools/smoke/run_video_e2e.sh

# 3. 检查测试结果
# 预期：所有测试通过
```

### 证据位置

- 测试输出: 终端输出
- 测试日志: `logs/` 目录
- 测试报告: `reports/` 目录

---

## 验收标准

### 必须全部通过

- ✅ 门禁 0: 一致性风险修复（JOB_WORKER_ENABLED 统一）
- ✅ 门禁 1: 容量门禁功能正常
- ✅ 门禁 2: Signed URL + Nginx 直出正常（Range 206, 过期/篡改/越权 404）
- ✅ 门禁 3: 盗链防护有效（统一 404）
- ✅ 门禁 4: 压测数据达标（P95 < 500ms, 成功率 > 95%）
- ✅ 门禁 5: Feature Flags 可回滚
- ✅ 门禁 6: E2E 测试全部通过
- ✅ 门禁 7: 容量报告数据完整（无占位符）

### 自动化验证

运行 `bash tools/gate/run_launch_gates.sh` 必须全部通过：

- Direct access ... HTTP 404 ✅
- Signed Range ... HTTP 206 ✅
- Expired ... HTTP 404 ✅
- Tampered ... HTTP 404 ✅
- Unauthorized ... HTTP 404 ✅

### 验收人签字

- [ ] 开发负责人: **\*\***\_**\*\***
- [ ] 测试负责人: **\*\***\_**\*\***
- [ ] 运维负责人: **\*\***\_**\*\***

---

## 上线后监控

### 关键指标

- 容量使用率: `/api/jobs/capacity`
- 错误率: `/metrics` 中的 `scu_api_jobs_failed`
- 响应时间: `/metrics` 中的响应时间指标
- 存储访问: Nginx access.log 中的 `/protected_storage/*` 请求

### 告警阈值

- 容量使用率 > 80%
- 错误率 > 10%
- P95 响应时间 > 1000ms

---

**注意**: 所有门禁必须提供证据（日志/截图/命令输出），否则不允许上线。
