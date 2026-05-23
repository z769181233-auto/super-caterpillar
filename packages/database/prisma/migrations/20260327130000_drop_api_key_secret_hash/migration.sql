DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "api_keys"
    WHERE "secretHash" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot drop api_keys.secretHash while legacy secrets still exist';
  END IF;
END $$;

DROP INDEX IF EXISTS "idx_api_keys_legacy_secret_hash_pending";

ALTER TABLE "api_keys"
DROP CONSTRAINT IF EXISTS "api_keys_secret_source_present";

ALTER TABLE "api_keys"
DROP COLUMN IF EXISTS "secretHash";

ALTER TABLE "api_keys"
ADD CONSTRAINT "api_keys_secret_source_present"
CHECK (
  "secretEnc" IS NOT NULL
);
