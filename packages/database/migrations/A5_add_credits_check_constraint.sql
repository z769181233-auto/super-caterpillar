-- A5任务：Billing 竞态条件修复
-- 添加 CHECK 约束确保 credits >= 0

-- 1. 确保现有数据符合约束（修复任何负值）
UPDATE organizations
SET credits = 0
WHERE credits < 0;

-- 2. 添加 CHECK 约束（PostgreSQL）
ALTER TABLE organizations
ADD CONSTRAINT credits_non_negative CHECK (credits >= 0);

-- 3. 创建索引优化并发查询性能
CREATE INDEX IF NOT EXISTS idx_organizations_credits ON organizations(credits);

-- ROLLBACK方案（如需回滚）:
-- ALTER TABLE organizations DROP CONSTRAINT IF EXISTS credits_non_negative;
-- DROP INDEX IF EXISTS idx_organizations_credits;
