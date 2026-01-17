-- Rollback Migration: Remove graph_state_snapshot and project_id from novel_scenes
-- Date: 2026-01-17

DROP INDEX IF EXISTS idx_novel_scenes_project_id;
DROP INDEX IF EXISTS idx_novel_scenes_graph_state_snapshot;
ALTER TABLE novel_scenes DROP COLUMN IF EXISTS project_id;
ALTER TABLE novel_scenes DROP COLUMN IF EXISTS graph_state_snapshot;
