-- Migration: Add graph_state_snapshot and project_id to novel_scenes
-- Purpose: V3.0 P0-2 Context Injection Consistency Support
-- Date: 2026-01-17

ALTER TABLE novel_scenes
ADD COLUMN IF NOT EXISTS graph_state_snapshot JSONB,
ADD COLUMN IF NOT EXISTS project_id TEXT;

-- GIN index for snapshot
CREATE INDEX IF NOT EXISTS idx_novel_scenes_graph_state_snapshot
ON novel_scenes
USING gin (graph_state_snapshot);

-- Index for projectId
CREATE INDEX IF NOT EXISTS idx_novel_scenes_project_id
ON novel_scenes (project_id);
