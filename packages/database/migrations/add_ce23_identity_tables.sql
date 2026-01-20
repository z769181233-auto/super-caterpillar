-- Forward Migration: Add CE23 Identity Consistency Tables
-- P13-0.1: Minimal Schema for Identity Anchors and Scores

-- 1. Identity Anchors (Role: Store the reference 'truth' for a character)
CREATE TABLE IF NOT EXISTS "identity_anchors" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "project_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "reference_asset_id" TEXT NOT NULL,
    "identity_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Anchors
CREATE INDEX IF NOT EXISTS "idx_identity_anchors_project_char" ON "identity_anchors" ("project_id", "character_id");
CREATE INDEX IF NOT EXISTS "idx_identity_anchors_ref_asset" ON "identity_anchors" ("reference_asset_id");
-- Optional unique constraint to prevent duplicate anchors for same hash per char (can be relaxed later)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_identity_anchors_unique_hash" ON "identity_anchors" ("project_id", "character_id", "identity_hash");


-- 2. Shot Identity Scores (Role: Audit log of identity consistency per shot)
CREATE TABLE IF NOT EXISTS "shot_identity_scores" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "shot_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "reference_anchor_id" UUID NOT NULL,
    "target_asset_id" TEXT NOT NULL,
    "identity_score" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL CHECK (verdict IN ('PASS', 'FAIL')),
    "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Key to Anchor (Hard constraint, consistency dependency)
    CONSTRAINT "fk_score_anchor" FOREIGN KEY ("reference_anchor_id") REFERENCES "identity_anchors"("id") ON DELETE CASCADE
);

-- Indexes for Scores
CREATE INDEX IF NOT EXISTS "idx_shot_identity_scores_shot" ON "shot_identity_scores" ("shot_id");
CREATE INDEX IF NOT EXISTS "idx_shot_identity_scores_anchor" ON "shot_identity_scores" ("reference_anchor_id");
CREATE INDEX IF NOT EXISTS "idx_shot_identity_scores_char" ON "shot_identity_scores" ("character_id");
CREATE INDEX IF NOT EXISTS "idx_shot_identity_scores_created" ON "shot_identity_scores" ("created_at");

-- Note: No FKs to 'shots' or 'assets' tables yet to avoid cross-type issues during migration.
-- P13-0.5 can harden these FKs if types are confirmed consistent.
