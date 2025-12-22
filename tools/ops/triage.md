# Stage3-A 运维诊断手册

## 快速定位

### 1. Job 卡在 PENDING 状态

**症状：** Job 长时间处于 PENDING，未被 Worker 领取

**排查步骤：**
1. 检查是否有 Engine 绑定：
   ```sql
   SELECT j.id, j.type, j.status, jeb.id as binding_id, jeb.status as binding_status
   FROM shot_jobs j
   LEFT JOIN job_engine_bindings jeb ON j.id = jeb.job_id
   WHERE j.id = '<job_id>';
   ```
2. 如果没有绑定，检查 Engine 是否可用：
   ```sql
   SELECT id, engine_key, enabled FROM engines WHERE enabled = true;
   ```
3. 如果有绑定但状态不是 BOUND，检查绑定状态

**处理：**
- 如果没有 Engine 绑定：手动绑定 Engine 或检查 Engine 选择逻辑
- 如果绑定状态异常：检查 `JobEngineBindingService.selectEngineForJob` 逻辑

### 2. Job 卡在 DISPATCHED 状态

**症状：** Job 被领取（DISPATCHED）但 Worker 未开始执行

**排查步骤：**
1. 检查 Worker 是否在线：
   ```sql
   SELECT w.worker_id, w.status, w.last_heartbeat, wh.status as heartbeat_status
   FROM worker_nodes w
   LEFT JOIN worker_heartbeats wh ON w.worker_id = wh.worker_id
   WHERE w.id = '<worker_id>';
   ```
2. 检查 Worker 是否超时（HEARTBEAT_TTL_SECONDS * 3）

**处理：**
- Worker 超时：等待 Orchestrator 自动回收（或手动触发）
- Worker 在线但未执行：检查 Worker 日志，确认是否调用了 `/api/jobs/:id/start`

### 3. Job 卡在 RUNNING 状态

**症状：** Job 长时间处于 RUNNING，Worker 未上报结果

**排查步骤：**
1. 检查 Worker 心跳：
   ```sql
   SELECT worker_id, last_seen_at, status
   FROM worker_heartbeats
   WHERE worker_id = '<worker_id>';
   ```
2. 检查 audit_logs，确认最后一条记录：
   ```sql
   SELECT action, details, created_at
   FROM audit_logs
   WHERE resource_id = '<job_id>'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

**处理：**
- Worker 超时：等待自动回收或手动触发回收
- Worker 在线：检查 Worker 日志，确认是否调用了 `/api/jobs/:id/report`

### 4. Job 重试次数超限

**症状：** `retry_count >= max_retry` 但 Job 状态不是 FAILED

**排查步骤：**
```sql
SELECT id, type, status, retry_count, max_retry, last_error
FROM shot_jobs
WHERE retry_count >= max_retry
  AND status != 'FAILED';
```

**处理：**
- 手动标记为 FAILED（使用 `forceFailJob` 接口）
- 检查重试逻辑是否正确更新状态

### 5. Engine 绑定状态异常

**症状：** Job 状态与 Engine 绑定状态不一致

**排查步骤：**
```sql
SELECT 
  j.id,
  j.status as job_status,
  jeb.status as binding_status,
  jeb.error_message
FROM shot_jobs j
INNER JOIN job_engine_bindings jeb ON j.id = jeb.job_id
WHERE j.id = '<job_id>';
```

**处理：**
- Job SUCCEEDED 但绑定未 COMPLETED：检查 `markBindingCompleted` 是否被调用
- Job FAILED 但绑定未 FAILED：检查 `markBindingFailed` 是否被调用
- 绑定失败但 Job 未失败：检查绑定失败是否影响 Job 状态

## 常用操作

### 手动绑定 Engine

```sql
INSERT INTO job_engine_bindings (
  id, job_id, engine_id, engine_key, status, bound_at, created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  '<job_id>',
  e.id,
  e.engine_key,
  'BOUND',
  now(),
  now(),
  now()
FROM engines e
WHERE e.engine_key = '<engine_key>'
  AND e.enabled = true
LIMIT 1;
```

### 手动回收超时 Job

```sql
-- 查找超时 Worker 的 Job
SELECT j.id, j.status, j.worker_id
FROM shot_jobs j
INNER JOIN worker_heartbeats wh ON j.worker_id = (
  SELECT id FROM worker_nodes WHERE worker_id = wh.worker_id
)
WHERE j.status IN ('DISPATCHED', 'RUNNING')
  AND wh.status = 'DEAD';

-- 手动回收（谨慎操作）
UPDATE shot_jobs
SET status = 'PENDING', worker_id = NULL
WHERE id IN ('<job_id_1>', '<job_id_2>');
```

### 重置重试计数

```sql
-- 谨慎操作：仅在确认需要时使用
UPDATE shot_jobs
SET retry_count = 0, status = 'PENDING', worker_id = NULL
WHERE id = '<job_id>';
```

## 禁止操作

### ⚠️ 生产环境禁止

1. **直接修改 Job 状态**（绕过状态机）
   - ❌ `UPDATE shot_jobs SET status = 'SUCCEEDED' WHERE id = '...'`
   - ✅ 使用 `reportJobResult` 接口

2. **删除 audit_logs**
   - ❌ `DELETE FROM audit_logs WHERE ...`
   - ✅ 只查询，不删除

3. **修改 Engine 绑定状态**（绕过业务逻辑）
   - ❌ `UPDATE job_engine_bindings SET status = 'COMPLETED' WHERE ...`
   - ✅ 通过 Job 状态转换自动更新

4. **批量修改 Worker 状态**
   - ❌ `UPDATE worker_nodes SET status = 'offline' WHERE ...`
   - ✅ 等待超时检测自动更新

## 诊断接口

### GET /api/ops/jobs/:id/diagnose

**环境限制：** 仅 dev 或设置 `ALLOW_OPS_ENDPOINTS=true`

**返回内容：**
- Job 基本信息（id, type, status, attempts, retryCount 等）
- Worker 信息（如果已分配）
- Engine 绑定信息
- 最近 20 条 audit_logs

**使用示例：**
```bash
curl -X GET "http://localhost:3000/api/ops/jobs/<job_id>/diagnose" \
  -H "Authorization: Bearer <token>"
```

## 常见问题

### Q: Job 创建后没有 Engine 绑定

**A:** 检查：
1. Engine 是否可用（`enabled = true`）
2. `JobEngineBindingService.selectEngineForJob` 是否返回结果
3. 绑定失败是否被捕获（检查日志）

### Q: Worker 领取不到 Job

**A:** 检查：
1. Job 是否有 Engine 绑定且状态为 BOUND
2. Job 状态是否为 PENDING
3. Worker 是否被禁用（`capabilities.disabled = true`）

### Q: attempts 和 retryCount 的区别

**A:**
- `attempts`: 领取次数（PENDING → DISPATCHED 时递增）
- `retryCount`: 重试次数（RUNNING → RETRYING 时递增）
- 判断是否达到最大重试：使用 `retryCount >= maxRetry`，不使用 `attempts`

