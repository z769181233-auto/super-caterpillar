UPDATE "api_keys"
SET "secretVersion" = COALESCE("secretVersion", 1)
WHERE "secretEnc" IS NOT NULL
  AND "secretVersion" IS NULL;

ALTER TABLE "api_keys"
DROP CONSTRAINT IF EXISTS "api_keys_secret_triplet_consistency";

ALTER TABLE "api_keys"
ADD CONSTRAINT "api_keys_secret_triplet_consistency"
CHECK (
  num_nonnulls("secretEnc", "secretEncIv", "secretEncTag") IN (0, 3)
);

ALTER TABLE "api_keys"
DROP CONSTRAINT IF EXISTS "api_keys_secret_source_present";

ALTER TABLE "api_keys"
ADD CONSTRAINT "api_keys_secret_source_present"
CHECK (
  "secretHash" IS NOT NULL OR "secretEnc" IS NOT NULL
);

ALTER TABLE "api_keys"
DROP CONSTRAINT IF EXISTS "api_keys_secret_version_required";

ALTER TABLE "api_keys"
ADD CONSTRAINT "api_keys_secret_version_required"
CHECK (
  "secretEnc" IS NULL OR "secretVersion" IS NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_api_keys_legacy_secret_hash_pending"
ON "api_keys" ("updatedAt")
WHERE "secretHash" IS NOT NULL
  AND "secretEnc" IS NULL;
