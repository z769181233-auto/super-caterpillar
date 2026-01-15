-- Rollback script for CORE-3 Insight Snapshot Version Upgrade
-- Use this if revert from 1.0.0 to v1 is needed

-- 1. Update existing records (careful: this assumes only ce06-insight-snapshot needs rollback)
UPDATE "NovelInsightSnapshot"
SET "engineVersion" = 'ce06-insight-snapshot@v1'
WHERE "engineVersion" = 'ce06-insight-snapshot@1.0.0';

-- 2. Audit the rollback
