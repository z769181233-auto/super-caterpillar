ALTER TABLE "billing_ledger"
ADD COLUMN IF NOT EXISTS "tenant_id" TEXT,
ADD COLUMN IF NOT EXISTS "trace_id" TEXT,
ADD COLUMN IF NOT EXISTS "item_type" TEXT,
ADD COLUMN IF NOT EXISTS "item_id" TEXT,
ADD COLUMN IF NOT EXISTS "charge_code" TEXT,
ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'CREDIT',
ADD COLUMN IF NOT EXISTS "evidence_ref" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP;

UPDATE "billing_ledger"
SET
  "tenant_id" = COALESCE("tenant_id", "project_id"::text),
  "trace_id" = COALESCE("trace_id", "job_id"::text),
  "item_type" = COALESCE("item_type", 'JOB'),
  "item_id" = COALESCE("item_id", "job_id"::text),
  "charge_code" = COALESCE(
    "charge_code",
    CASE
      WHEN "billing_state" = 'RESERVED' THEN 'JOB_RESERVED'
      WHEN "billing_state" = 'COMMITTED' THEN 'JOB_COMMITTED'
      WHEN "billing_state" = 'RELEASED' THEN 'JOB_RELEASED'
      ELSE 'JOB_UNKNOWN'
    END
  ),
  "currency" = COALESCE("currency", 'CREDIT'),
  "status" = COALESCE(
    "status",
    CASE
      WHEN "billing_state" = 'RESERVED' THEN 'PENDING'
      WHEN "billing_state" = 'COMMITTED' THEN 'POSTED'
      WHEN "billing_state" = 'RELEASED' THEN 'REVERSED'
      ELSE 'FAILED'
    END
  ),
  "updated_at" = COALESCE("updated_at", "created_at")
WHERE
  "tenant_id" IS NULL
  OR "trace_id" IS NULL
  OR "item_type" IS NULL
  OR "item_id" IS NULL
  OR "charge_code" IS NULL
  OR "currency" IS NULL
  OR "status" IS NULL
  OR "updated_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_billing_ledger_ssot_lookup"
ON "billing_ledger" ("tenant_id", "trace_id", "item_type", "item_id", "charge_code");

CREATE INDEX IF NOT EXISTS "idx_billing_ledger_trace_id"
ON "billing_ledger" ("trace_id");

CREATE INDEX IF NOT EXISTS "idx_billing_ledger_status"
ON "billing_ledger" ("status");
