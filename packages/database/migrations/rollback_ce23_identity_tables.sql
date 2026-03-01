-- Rollback Migration: Drop CE23 Identity Consistency Tables
-- Reverses P13-0.1

-- 1. Drop Child Table (Scores) First
DROP TABLE IF EXISTS "shot_identity_scores";

-- 2. Drop Parent Table (Anchors)
DROP TABLE IF EXISTS "identity_anchors";
