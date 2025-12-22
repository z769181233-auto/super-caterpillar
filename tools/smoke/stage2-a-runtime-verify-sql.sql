-- Stage2-A 运行时验证 SQL 脚本
-- 用于创建测试数据和验证状态

-- 1. 创建测试 Worker（如果不存在）
INSERT INTO worker_nodes (id, worker_id, status, capabilities, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'test_worker_001',
  'online',
  '{}'::jsonb,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM worker_nodes WHERE worker_id = 'test_worker_001'
)
RETURNING id, worker_id;

-- 2. 查找或创建测试 Project（使用现有项目）
-- 假设至少有一个项目存在
SELECT id, name, organization_id 
FROM projects 
ORDER BY created_at DESC 
LIMIT 1;

-- 3. 创建测试 Job（PENDING 状态）
-- 注意：需要替换 <project_id>, <organization_id>, <episode_id>, <scene_id>, <shot_id>
-- 这里使用一个简化的方法：直接插入，使用最小必需字段

-- 先查找一个现有的 shot
SELECT s.id as shot_id, s.scene_id, sc.episode_id, e.season_id, se.project_id, se.organization_id
FROM shots s
JOIN scenes sc ON s.scene_id = sc.id
JOIN episodes e ON sc.episode_id = e.id
JOIN seasons se ON e.season_id = se.id
ORDER BY s.created_at DESC
LIMIT 1;

-- 4. 创建 PENDING Job（使用上面查询的结果）
-- INSERT INTO shot_jobs (id, organization_id, project_id, episode_id, scene_id, shot_id, type, status, payload, priority, max_retry, created_at, updated_at)
-- VALUES (
--   gen_random_uuid(),
--   '<organization_id>',
--   '<project_id>',
--   '<episode_id>',
--   '<scene_id>',
--   '<shot_id>',
--   'CE03_VISUAL_DENSITY',
--   'PENDING',
--   '{}'::jsonb,
--   0,
--   3,
--   now(),
--   now()
-- )
-- RETURNING id, status;

-- 5. 验证 Job 状态
-- SELECT id, status, worker_id, type, created_at
-- FROM shot_jobs
-- WHERE id = '<job_id>';

-- 6. 创建 WorkerHeartbeat
INSERT INTO worker_heartbeats (worker_id, last_seen_at, status, created_at, updated_at)
VALUES (
  'test_worker_001',
  now(),
  'ALIVE',
  now(),
  now()
)
ON CONFLICT (worker_id) DO UPDATE
SET last_seen_at = now(), status = 'ALIVE', updated_at = now()
RETURNING worker_id, last_seen_at, status;

-- 7. 验证 WorkerHeartbeat
SELECT worker_id, last_seen_at, status
FROM worker_heartbeats
WHERE worker_id = 'test_worker_001';

-- 8. 模拟 Worker 超时（回拨 last_seen_at）
UPDATE worker_heartbeats
SET last_seen_at = now() - interval '5 minutes',
    status = 'DEAD'
WHERE worker_id = 'test_worker_001';

-- 9. 查询 audit_logs
SELECT action, resource_type, resource_id, details, created_at
FROM audit_logs
WHERE action IN ('WORKER_DEAD_RECOVERY', 'JOB_REPORT_RECEIVED')
ORDER BY created_at DESC
LIMIT 10;

