-- 按状态聚合（pending/running/success/failed）

SELECT 
  status,
  COUNT(*) as count,
  MIN("createdAt") as earliest,
  MAX("updatedAt") as latest
FROM "ShotJob"
GROUP BY status
ORDER BY count DESC;

