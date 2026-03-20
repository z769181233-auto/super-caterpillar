-- Append-only continuity state evidence snapshots.
-- P4 minimal scope: preserve each audit/check run without mutating continuity_states semantics.

CREATE TABLE IF NOT EXISTS continuity_state_snapshots (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  shot_id uuid NULL,
  trace_id text NULL,
  source text NOT NULL,
  snapshot_type text NOT NULL,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_ref text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_continuity_state_snapshots_scene_created
  ON continuity_state_snapshots (scene_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_continuity_state_snapshots_trace
  ON continuity_state_snapshots (trace_id);

CREATE INDEX IF NOT EXISTS idx_continuity_state_snapshots_type
  ON continuity_state_snapshots (snapshot_type);
