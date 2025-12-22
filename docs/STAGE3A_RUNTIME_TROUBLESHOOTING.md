# Stage3-A 运行时故障排查手册

## 常见异常 -> 证据 -> 根因 -> 处理

### 1. Job 创建后没有 Engine 绑定

**症状：**
- Job 状态为 PENDING，但 `job_engine_bindings` 表中没有对应记录
- Worker 无法领取该 Job（查询条件要求有 BOUND 状态的绑定）

**证据：**
```sql
SELECT j.id, j.type, j.status, jeb.id as binding_id
FROM shot_jobs j
LEFT JOIN job_engine_bindings jeb ON j.id = jeb.job_id
WHERE j.id = '<job_id>';
-- 结果：binding_id 为 NULL
```

**根因：**
1. `JobEngineBindingService.selectEngineForJob` 返回 null（没有可用的 Engine）
2. `bindEngineToJob` 抛出异常但被捕获（日志中有错误记录）
3. Engine 表为空或所有 Engine 的 `enabled = false`

**处理：**
1. 检查 Engine 是否可用：
   ```sql
   SELECT id, engine_key, enabled FROM engines WHERE enabled = true;
   ```
2. 如果没有可用 Engine，创建并启用一个 Engine
3. 如果有 Engine 但未绑定，手动绑定：
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
   WHERE e.enabled = true
   LIMIT 1;
   ```

---

### 2. Job 卡在 PENDING 状态（有 Engine 绑定）

**症状：**
- Job 状态为 PENDING，有 Engine 绑定且状态为 BOUND
- Worker 持续轮询但无法领取该 Job

**证据：**
```sql
SELECT j.id, j.status, jeb.status as binding_status, j.worker_id
FROM shot_jobs j
INNER JOIN job_engine_bindings jeb ON j.id = jeb.job_id
WHERE j.id = '<job_id>';
-- 结果：j.status = 'PENDING', jeb.status = 'BOUND', j.worker_id IS NULL
```

**根因：**
1. Worker 被禁用（`capabilities.disabled = true`）
2. Worker 查询条件不匹配（例如指定了 `jobType` 但 Job 类型不匹配）
3. 并发竞争失败（多个 Worker 同时领取，只有一个成功）

**处理：**
1. 检查 Worker 状态：
   ```sql
   SELECT worker_id, status, capabilities
   FROM worker_nodes
   WHERE worker_id = '<worker_id>';
   ```
2. 如果 Worker 被禁用，启用它或使用其他 Worker
3. 检查 Worker 日志，确认是否持续尝试领取
4. 如果确认是并发竞争，等待重试或手动触发领取

---

### 3. Job 卡在 DISPATCHED 状态

**症状：**
- Job 状态为 DISPATCHED，已分配给 Worker，但 Worker 未开始执行

**证据：**
```sql
SELECT j.id, j.status, j.worker_id, w.worker_id, w.status, wh.status as heartbeat_status, wh.last_seen_at
FROM shot_jobs j
INNER JOIN worker_nodes w ON j.worker_id = w.id
LEFT JOIN worker_heartbeats wh ON w.worker_id = wh.worker_id
WHERE j.id = '<job_id>';
-- 结果：j.status = 'DISPATCHED', wh.status = 'DEAD' 或 wh.last_seen_at < now() - interval '5 minutes'
```

**根因：**
1. Worker 超时（超过 `HEARTBEAT_TTL_SECONDS * 3` 未发送心跳）
2. Worker 进程崩溃或网络中断
3. Orchestrator 超时检测未触发（或触发延迟）

**处理：**
1. 等待 Orchestrator 自动回收（超时检测会将其恢复为 PENDING）
2. 手动触发回收（谨慎操作）：
   ```sql
   UPDATE shot_jobs
   SET status = 'PENDING', worker_id = NULL
   WHERE id = '<job_id>' AND status = 'DISPATCHED';
   ```
3. 检查 Worker 进程状态和日志

---

### 4. Job 卡在 RUNNING 状态

**症状：**
- Job 状态为 RUNNING，Worker 长时间未上报结果

**证据：**
```sql
SELECT 
  j.id, 
  j.status, 
  j.updated_at,
  wh.last_seen_at,
  wh.status as heartbeat_status,
  (SELECT COUNT(*) FROM audit_logs WHERE resource_id = j.id AND action = 'JOB_STARTED') as started_count,
  (SELECT COUNT(*) FROM audit_logs WHERE resource_id = j.id AND action = 'JOB_REPORT_RECEIVED') as report_count
FROM shot_jobs j
LEFT JOIN worker_nodes w ON j.worker_id = w.id
LEFT JOIN worker_heartbeats wh ON w.worker_id = wh.worker_id
WHERE j.id = '<job_id>';
-- 结果：j.status = 'RUNNING', wh.status = 'DEAD' 或 wh.last_seen_at 很久未更新
```

**根因：**
1. Worker 执行过程中崩溃
2. Worker 执行时间过长（超过预期）
3. Worker 未调用 `/api/jobs/:id/report` 接口

**处理：**
1. 检查 Worker 日志，确认是否在执行
2. 如果 Worker 超时，等待自动回收或手动触发：
   ```sql
   -- 谨慎操作：仅在确认 Worker 已死亡时使用
   UPDATE shot_jobs
   SET status = 'PENDING', worker_id = NULL
   WHERE id = '<job_id>' AND status = 'RUNNING';
   ```
3. 如果 Worker 仍在执行，等待完成或联系 Worker 维护者

---

### 5. Engine 绑定状态与 Job 状态不一致

**症状：**
- Job 状态为 SUCCEEDED，但 Engine 绑定状态仍为 EXECUTING
- Job 状态为 FAILED，但 Engine 绑定状态仍为 EXECUTING

**证据：**
```sql
SELECT 
  j.id,
  j.status as job_status,
  jeb.status as binding_status,
  jeb.error_message
FROM shot_jobs j
INNER JOIN job_engine_bindings jeb ON j.id = jeb.job_id
WHERE j.id = '<job_id>';
-- 结果：job_status = 'SUCCEEDED' 但 binding_status = 'EXECUTING'
```

**根因：**
1. `markBindingCompleted` 或 `markBindingFailed` 调用失败但被捕获（不影响 Job 状态）
2. 数据库事务问题（Job 状态更新成功但绑定状态更新失败）

**处理：**
1. 检查日志，确认是否有绑定状态更新失败的错误
2. 手动同步绑定状态（谨慎操作）：
   ```sql
   UPDATE job_engine_bindings
   SET status = 'COMPLETED', completed_at = now()
   WHERE job_id = '<job_id>' AND status = 'EXECUTING';
   ```
3. 如果 Job 状态为 FAILED，同步为 FAILED：
   ```sql
   UPDATE job_engine_bindings
   SET status = 'FAILED', completed_at = now(), error_message = 'Job failed'
   WHERE job_id = '<job_id>' AND status = 'EXECUTING';
   ```

---

### 6. attempts 和 retryCount 语义混淆

**症状：**
- `attempts` 值异常高（超过预期）
- 使用 `attempts` 判断是否达到最大重试（错误）

**证据：**
```sql
SELECT id, type, status, attempts, retry_count, max_retry
FROM shot_jobs
WHERE id = '<job_id>';
-- 结果：attempts = 10, retry_count = 2, max_retry = 3
```

**根因：**
- `attempts` 只在领取时递增（PENDING → DISPATCHED）
- `retryCount` 只在重试时递增（RUNNING → RETRYING）
- 如果 Job 被多次领取但未执行，`attempts` 会持续增长

**处理：**
1. 判断是否达到最大重试：使用 `retry_count >= max_retry`，不使用 `attempts`
2. `attempts` 仅用于统计领取次数，不用于业务逻辑判断
3. 如果 `attempts` 异常高，检查是否有频繁的领取-释放循环

---

### 7. NOVEL_ANALYSIS Job 创建后没有 Engine 绑定

**症状：**
- `createNovelAnalysisJob` 创建的 Job 没有 Engine 绑定

**证据：**
```sql
SELECT j.id, j.type, jeb.id as binding_id
FROM shot_jobs j
LEFT JOIN job_engine_bindings jeb ON j.id = jeb.job_id
WHERE j.type = 'NOVEL_ANALYSIS' AND j.created_at > now() - interval '1 hour'
ORDER BY j.created_at DESC
LIMIT 10;
-- 结果：部分 Job 的 binding_id 为 NULL
```

**根因：**
1. `createNovelAnalysisJob` 中自动绑定逻辑失败但被捕获
2. 没有可用的 Engine（`selectEngineForJob` 返回 null）

**处理：**
1. 检查日志，确认是否有绑定失败的错误
2. 确保有可用的 Engine（`enabled = true`）
3. 手动绑定缺失的 Job（参考问题 1 的处理方法）

---

### 8. CE09 安全链路未触发

**症状：**
- SHOT_RENDER Job 完成后，VideoJob 的 `securityProcessed` 仍为 false
- 没有创建对应的 Asset 记录

**证据：**
```sql
SELECT 
  j.id,
  j.type,
  j.status,
  vj.id as video_job_id,
  vj.security_processed,
  a.id as asset_id
FROM shot_jobs j
LEFT JOIN video_jobs vj ON j.shot_id = vj.shot_id
LEFT JOIN assets a ON a.project_id = j.project_id AND a.type = 'video'
WHERE j.id = '<job_id>' AND j.type = 'SHOT_RENDER';
-- 结果：j.status = 'SUCCEEDED', vj.security_processed = false, a.id IS NULL
```

**根因：**
1. `handleShotRenderSecurityPipeline` 未被调用（代码路径问题）
2. `handleShotRenderSecurityPipeline` 执行失败但被捕获（软失败）
3. VideoJob 不存在或已处理

**处理：**
1. 检查 `reportJobResult` 的 SUCCEEDED 分支，确认是否调用了 `handleShotRenderSecurityPipeline`
2. 检查日志，确认是否有 `CE09_SECURITY_PIPELINE_FAIL` 记录
3. 检查 audit_logs，确认是否有相关错误记录
4. 如果确认是软失败，手动触发或修复代码逻辑

---

## 诊断接口使用

### GET /api/ops/jobs/:id/diagnose

**环境限制：** 仅 dev 或设置 `ALLOW_OPS_ENDPOINTS=true`

**返回内容：**
- Job 基本信息
- Worker 信息（如果已分配）
- Engine 绑定信息
- 最近 20 条 audit_logs

**使用示例：**
```bash
curl -X GET "http://localhost:3000/api/ops/jobs/<job_id>/diagnose" \
  -H "Authorization: Bearer <token>"
```

---

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

---

## 相关文档

- `tools/ops/triage.sql` - 常用 SQL 查询
- `tools/ops/triage.md` - 运维诊断手册

