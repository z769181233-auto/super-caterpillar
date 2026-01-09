# 容量门禁与压测报告

## 执行时间

生成时间: $(date -Iseconds)

## 执行命令

```bash
# API 负载测试
node tools/load/api_smoke_load.js \
  --url http://localhost:3000 \
  --concurrent 10 \
  --requests 100 \
  --shot-id <shot-id> \
  --job-type VIDEO_RENDER \
  --auth-token <token>

# Worker 吞吐量测试
export API_URL=http://localhost:3000
export SHOT_ID=<shot-id>
export JOB_COUNT=50
export CONCURRENT=5
export AUTH_TOKEN=<token>
./tools/load/worker_throughput_test.sh
```

## 1. 容量门禁实现

### 1.1 并发渲染上限

- **VIDEO_RENDER in-progress 限制**: `MAX_CONCURRENT_VIDEO_RENDER` (默认: 10)
- **队列积压阈值**: `MAX_PENDING_VIDEO_RENDER` (默认: 50)
- **总队列积压阈值**: `MAX_PENDING_JOBS` (默认: 100)

### 1.2 错误码与前端提示

已实现以下错误码：

- `CAPACITY_EXCEEDED_CONCURRENT`: 当前并发渲染任务已达上限
- `CAPACITY_EXCEEDED_QUEUE`: 渲染队列积压过多
- `CAPACITY_EXCEEDED_TOTAL_QUEUE`: 系统队列繁忙
- `CAPACITY_EXCEEDED_USER_CONCURRENT`: 用户并发渲染任务已达上限

所有错误码均返回 HTTP 429 (Too Many Requests)，包含友好的前端提示信息。

### 1.3 细粒度限流

- **鉴权接口**: 10 次/分钟
- **签名接口**: 30 次/分钟
- **下载接口**: 200 次/分钟
- **默认接口**: 100 次/分钟

## 2. DB 索引与慢查询审计

### 2.1 索引检查

运行 `tools/db/audit-job-indexes.ts` 进行索引审计。

**关键索引需求**:

- `(status, type, priority DESC, created_at ASC)` - 用于 job 领取
- `(organization_id, status, type)` - 用于容量检查

### 2.2 连接池配置

**推荐配置** (在 `DATABASE_URL` 中设置):

```
?connection_limit=20&pool_timeout=10
```

**PostgreSQL 配置**:

- `max_connections`: 建议 100-200（根据实例数调整）
- 每个 API 实例连接池上限: 20

### 2.3 慢查询监控

启用 `pg_stat_statements` 扩展以监控慢查询：

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## 3. 存储分发“去 API 带宽化”

### 3.1 Signed URL 实现

- **端点**: `/api/storage/sign/:key` (生成签名 URL)
- **访问端点**: `/api/storage/signed/:key?expires=xxx&signature=xxx`
- **默认 TTL**: 1 小时 (可通过 `STORAGE_SIGNED_URL_TTL` 配置)
- **签名算法**: HMAC-SHA256

### 3.2 安全特性

- 使用 `timing-safe` 比较防止时序攻击
- 支持过期时间验证
- 生产环境禁用直接访问 (`ALLOW_DIRECT_STORAGE_ACCESS=false`)

### 3.3 审计

所有签名 URL 生成均记录审计日志。

## 4. 安全底座收口

### 4.1 Helmet

已集成 Helmet 中间件，提供以下安全头：

- Content-Security-Policy (生产环境)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

### 4.2 CORS 白名单

- **生产环境**: 严格白名单 (`CORS_ORIGINS` 环境变量，逗号分隔)
- **开发环境**: 允许前端 URL

### 4.3 $queryRaw 审计

- 创建 `PrismaQueryRawAuditInterceptor` 用于审计
- **生产环境禁止**: SQL 字符串拼接
- **推荐**: 使用 Prisma 模板字面量

### 4.4 console.\* 清理

- `main.ts`: 已替换为 logger
- 其他关键文件: 建议逐步替换（脚本文件可保留）

## 5. 监控与告警

### 5.1 /metrics 端点

提供 Prometheus 格式指标：

- `scu_api_uptime_seconds`: 服务运行时间
- `scu_api_memory_*`: 内存使用情况
- `scu_api_jobs_*`: Job 统计信息
  - `scu_api_jobs_total`: 总 job 数
  - `scu_api_jobs_pending`: 待处理 job 数
  - `scu_api_jobs_running`: 运行中 job 数
  - `scu_api_jobs_failed`: 失败 job 数
  - `scu_api_jobs_video_render_pending`: 待处理 VIDEO_RENDER job 数

### 5.2 告警阈值建议

- **容量告警**: `scu_api_jobs_video_render_pending > 40` (80% 阈值)
- **失败率告警**: `scu_api_jobs_failed / scu_api_jobs_total > 0.1` (10%)
- **内存告警**: `scu_api_memory_heap_used_bytes / scu_api_memory_heap_total_bytes > 0.9` (90%)

## 6. 压测脚本与报告

### 6.1 API 负载测试

**脚本**: `tools/load/api_smoke_load.js`

**使用方法**:

```bash
node tools/load/api_smoke_load.js \
  --url http://localhost:3000 \
  --concurrent 10 \
  --requests 100 \
  --endpoint /api/health \
  --auth-token <token>
```

**输出指标**:

- 总请求数、成功率、失败率
- 响应时间统计 (P50, P95, P99)
- 错误摘要

### 6.2 Worker 吞吐量测试

**脚本**: `tools/load/worker_throughput_test.sh`

**使用方法**:

```bash
export API_URL=http://localhost:3000
export JOB_COUNT=50
export CONCURRENT=5
export AUTH_TOKEN=<token>
./tools/load/worker_throughput_test.sh
```

**输出指标**:

- Job 创建成功率
- Job 处理成功率
- 吞吐量 (jobs/sec)

### 6.3 压测结果

**实际数据**（⚠️ 必须填充真实数据，否则门禁 Gate 5 将失败）:

#### API 负载测试结果

- 总请求数: <待填充>
- 成功数: <待填充> (<待填充>%)
- 失败数: <待填充> (<待填充>%)
- 容量超限: <待填充> (<待填充>%)
- 持续时间: <待填充>s
- 请求速率: <待填充> req/s
- 响应时间:
  - Min: <待填充>ms
  - Max: <待填充>ms
  - Average: <待填充>ms
  - P50: <待填充>ms
  - P95: <待填充>ms
  - P99: <待填充>ms

#### Worker 吞吐量测试结果

- 总创建数: <待填充>
- 创建成功: <待填充> (<待填充>%)
- 创建失败: <待填充> (<待填充>%)
- 持续时间: <待填充>s
- 创建速率: <待填充> jobs/s
- Job 状态:
  - Succeeded: <待填充>
  - Failed: <待填充>
  - Pending/Running: <待填充>
  - Processed: <待填充>

**⚠️ 注意**: 门禁脚本 `tools/gate/run_launch_gates.sh` 会自动检查本报告是否包含占位符（`___`、`待填充`、`TBD` 等）。如果存在占位符，Gate 5 将失败，不允许上线。

**验收标准**:

- ✅ API 响应时间 P95 < 500ms
- ✅ Job 创建成功率 > 95%
- ✅ Job 处理成功率 > 90%
- ✅ 容量门禁正常工作（超过限制时返回 429）

## 7. 回滚方案（Feature Flags）

### 7.1 功能开关

所有功能通过环境变量控制，回滚仅需改 env + 重启：

- `CAPACITY_GATE_ENABLED=true`: 容量门禁开关（设为 false 禁用）
- `SIGNED_URL_ENABLED=true`: Signed URL 开关（设为 false 回退到直接访问，仅开发环境）
- `STORAGE_ACCEL_REDIRECT_ENABLED=true`: Nginx 直出开关（设为 false 回退到 API 直出）
- `MAX_CONCURRENT_VIDEO_RENDER`: 并发限制（默认 10）
- `MAX_PENDING_VIDEO_RENDER`: 队列积压阈值（默认 50）
- `MAX_PENDING_JOBS`: 总队列积压阈值（默认 100）
- `CORS_ORIGINS`: CORS 白名单（生产环境必需）

### 7.2 回滚步骤

```bash
# 1. 禁用容量门禁
export CAPACITY_GATE_ENABLED=false

# 2. 禁用 Signed URL（回退到直接访问，仅开发环境）
export SIGNED_URL_ENABLED=false

# 3. 禁用 Nginx 直出（回退到 API 直出）
export STORAGE_ACCEL_REDIRECT_ENABLED=false

# 4. 重启服务
docker-compose restart api
# 或
pm2 restart api
```

### 7.2 数据库回滚

如需回滚索引变更：

```sql
DROP INDEX IF EXISTS idx_shot_jobs_status_type_priority_created;
DROP INDEX IF EXISTS idx_shot_jobs_org_status_type;
```

### 7.3 代码回滚

所有变更均向后兼容，可通过以下方式回滚：

1. 移除容量门禁检查（注释掉 `checkVideoRenderCapacity` 调用）
2. 恢复直接存储访问（设置 `ALLOW_DIRECT_STORAGE_ACCESS=true`）
3. 禁用 Helmet（注释掉 `app.use(helmet(...))`）

## 8. 上线检查清单

- [ ] 一致性风险修复（JOB_WORKER_ENABLED 统一使用 packages/config）
- [ ] 容量门禁测试通过
- [ ] 压测报告生成（P95 < 500ms，成功率 > 95%）
- [ ] 压测数据已填充（无占位符，否则 Gate 5 失败）
- [ ] DB 索引审计通过
- [ ] 连接池配置验证
- [ ] Signed URL 功能测试（Range 206, 过期/篡改/越权 404）
- [ ] CORS 白名单配置（生产环境必需）
- [ ] Helmet 安全头验证
- [ ] Metrics 端点可访问
- [ ] 告警阈值配置
- [ ] 回滚方案验证
- [ ] 运行门禁脚本验证：`bash tools/gate/run_launch_gates.sh`

## 9. 安全风险修复

### 9.1 P1 风险修复

#### ✅ 僵尸任务自愈缺失

- **修复**: 实现 `JobWatchdogService`，每 5 分钟扫描并恢复长期 RUNNING 状态任务
- **配置**: `JOB_WATCHDOG_ENABLED=true` (默认启用)
- **超时时间**: `JOB_WATCHDOG_TIMEOUT_MS=3600000` (默认 1 小时)

#### ✅ 鉴权时效性缺口

- **修复**: `JwtStrategy.validate` 中增加实时组织成员身份校验
- **影响**: 用户被移出组织后，旧 Token 立即失效

#### ✅ 日志敏感信息泄露

- **修复**: 生产环境不输出全量 stack trace，仅记录 errorId
- **影响**: 防止生产环境日志泄露代码路径和内部逻辑

### 9.2 P2 风险修复

#### ✅ 定时器炸弹风险

- **修复**: HMAC Nonce 清理改用统一定时任务（每 1 分钟），避免每个 nonce 独立定时器
- **影响**: 高并发场景下避免事件循环拥堵

### 9.3 生产开关加固

#### ✅ 直接存储访问控制

- **修复**: `ALLOW_DIRECT_STORAGE_ACCESS=false` 时，`/api/storage/:key` 统一返回 404
- **影响**: 防止存储路径枚举

#### ✅ Nginx 直出强制

- **修复**: `STORAGE_ACCEL_REDIRECT_ENABLED=true` 时，确保走 X-Accel-Redirect（API 不读文件）
- **影响**: 减少 API 带宽消耗

#### ✅ CORS 生产强制

- **修复**: `NODE_ENV=production` 时，`CORS_ORIGINS` 缺失则启动失败
- **影响**: 防止生产环境 CORS 配置错误

## 10. 结论

**状态**: ✅ 实现完成，包含安全风险修复，待压测验证

**下一步**:

1. 执行压测脚本并记录结果
2. 根据压测结果调整容量限制
3. 配置监控告警
4. 执行上线检查清单
5. 运行门禁验证脚本：`bash tools/gate/run_launch_gates.sh`

---

**注意**: 本报告应在实际压测后更新具体数据。
