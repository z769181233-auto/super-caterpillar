CREATE TYPE "AssetRole" AS ENUM (
  'PRIMARY',
  'SHOT_SOURCE',
  'SCENE_MASTER',
  'EPISODE_MASTER',
  'PREVIEW'
);

ALTER TABLE "assets"
ADD COLUMN "role" "AssetRole" NOT NULL DEFAULT 'PRIMARY';

UPDATE "assets"
SET "role" = CASE
  WHEN "type" = 'VIDEO' AND "ownerType" = 'SHOT' THEN 'SHOT_SOURCE'::"AssetRole"
  WHEN "type" = 'VIDEO' AND "ownerType" = 'SCENE' THEN 'SCENE_MASTER'::"AssetRole"
  WHEN "type" = 'VIDEO' AND "ownerType" = 'EPISODE' THEN 'EPISODE_MASTER'::"AssetRole"
  ELSE 'PRIMARY'::"AssetRole"
END;

ALTER TABLE "assets"
DROP CONSTRAINT "assets_ownerType_ownerId_type_key";

CREATE UNIQUE INDEX "assets_ownerType_ownerId_type_role_key"
ON "assets"("ownerType", "ownerId", "type", "role");

CREATE INDEX "assets_projectId_type_role_idx"
ON "assets"("projectId", "type", "role");
