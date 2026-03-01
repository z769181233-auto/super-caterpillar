-- Stage3-A: 运维诊断常用 SQL
-- 用于快速定位 Job 问题

-- ============================================
-- 1. 查询 Job 完整信息（含 Engine 绑定）
-- ============================================
SELECT 
  j.id,
  j.type,
  j.status,
  j.priority,
  j.max_retry,
  j.retry_count,
  j.attempts,
  j.worker_id,
  j.task_id,
  j.created_at,
  j.updated_at,
  j.last_error,
  j.trace_id,
  w.worker_id as worker_worker_id,
  w.status as worker_status,
  w.last_heartbeat as worker_last_heartbeat,
  jeb.id as binding_id,
  jeb.engine_key,
  jeb.status as binding_status,
  jeb.bound_at,
  jeb.executed_at,
  jeb.completed_at,
  jeb.error_message as binding_error
FROM shot_jobs j
LEFT JOIN worker_nodes w ON j.worker_id = w.id
LEFT JOIN job_engine_bindings jeb ON j.id = jeb.job_id
WHERE j.id = '<job_id>';

-- ============================================
-- 2. 查询 Job 的 audit_logs（最近 20 条）
-- ============================================
SELECT 
  id,
  action,
  resource_type,
  resource_id,
  details,
  created_at
FROM audit_logs
WHERE resource_id = '<job_id>'
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- 3. 查询未绑定 Engine 的 PENDING Job
-- ============================================
SELECT 
  j.id,
  j.type,
  j.status,
  j.created_at,
  j.updated_at
FROM shot_jobs j
LEFT JOIN job_engine_bindings jeb ON j.id = jeb.job_id
WHERE j.status = 'PENDING'
  AND jeb.id IS NULL
ORDER BY j.created_at ASC
LIMIT 50;

-- ============================================
-- 4. 查询绑定状态异常的 Job
-- ============================================
SELECT 
  j.id,
  j.type,
  j.status as job_status,
  jeb.status as binding_status,
  jeb.bound_at,
  jeb.executed_at,
  jeb.completed_at,
  jeb.error_message
FROM shot_jobs j
INNER JOIN job_engine_bindings jeb ON j.id = jeb.job_id
WHERE 
  -- Job 已完成但绑定未完成
  (j.status IN ('SUCCEEDED', 'FAILED') AND jeb.status NOT IN ('COMPLETED', 'FAILED'))
  OR
  -- Job 运行中但绑定未执行
  (j.status = 'RUNNING' AND jeb.status = 'BOUND')
  OR
  -- 绑定失败但 Job 未失败
  (jeb.status = 'FAILED' AND j.status != 'FAILED')
ORDER BY j.updated_at DESC
LIMIT 50;

-- ============================================
-- 5. 查询 Worker 超时但 Job 未回收的情况
-- ============================================
SELECT 
  j.id,
  j.type,
  j.status,
  j.worker_id,
  w.worker_id as worker_worker_id,
  w.status as worker_status,
  w.last_heartbeat,
  wh.last_seen_at,
  wh.status as heartbeat_status
FROM shot_jobs j
INNER JOIN worker_nodes w ON j.worker_id = w.id
LEFT JOIN worker_heartbeats wh ON w.worker_id = wh.worker_id
WHERE j.status IN ('DISPATCHED', 'RUNNING')
  AND (
    wh.status = 'DEAD'
    OR (wh.last_seen_at < NOW() - INTERVAL '5 minutes' AND wh.status != 'DEAD')
  )
ORDER BY j.updated_at DESC
LIMIT 50;

-- ============================================
-- 6. 查询重试次数超限的 Job
-- ============================================
SELECT 
  id,
  type,
  status,
  retry_count,
  max_retry,
  attempts,
  last_error,
  created_at,
  updated_at
FROM shot_jobs
WHERE retry_count >= max_retry
  AND status != 'FAILED'
ORDER BY updated_at DESC
LIMIT 50;

