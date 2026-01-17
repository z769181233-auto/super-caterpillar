-- Rollback: Remove graph_state_snapshot from scenes table
-- Purpose: Rollback V3.0 Core Consistency Anchor migration
-- Date: 2026-01-16

-- Drop the index first
DROP INDEX IF EXISTS idx_scenes_graph_state;

-- Remove the column
ALTER TABLE scenes 
DROP COLUMN IF EXISTS graph_state_snapshot;
