-- Migration: Add graph_state_snapshot to scenes table
-- Purpose: V3.0 Core Consistency Anchor for character state tracking
-- Date: 2026-01-16

-- Add the column
ALTER TABLE scenes 
ADD COLUMN graph_state_snapshot JSONB DEFAULT NULL;

-- Create GIN index for efficient JSONB queries
CREATE INDEX idx_scenes_graph_state ON scenes 
USING gin(graph_state_snapshot);

-- Add comment for documentation
COMMENT ON COLUMN scenes.graph_state_snapshot IS 
'V3.0 Core Consistency Anchor: Tracks character states, items, locations per scene. Format: {"characters": [{"id": "char_xxx", "status": "healthy", "items": ["sword"], "location": "forest"}], "scene_index": N}';
