-- 验证审计确实写入（取最近 N 条）
-- 要求：审计表字段必须包含 nonce/signature/timestamp

SELECT 
  id,
  action,
  "resourceType",
  "resourceId",
  nonce,
  signature,
  timestamp,
  "createdAt",
  details
FROM audit_logs
ORDER BY "createdAt" DESC
LIMIT 20;

