-- Query to extract Identity Anchor fields from Audit Logs
-- Input: :jobId (Using sed to replace placeholder or just simple LIMIT 1 DESC)

SELECT 
  id,
  action,
  details->'identity' as identity_info,
  details->'identity'->'anchors' as anchors,
  details->'identity'->'mode' as check_mode
FROM audit_logs
WHERE action = 'ce07.shot_render.success'
ORDER BY "createdAt" DESC
LIMIT 1;
