CREATE TABLE IF NOT EXISTS continuity_state_locks (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  at_scene_id text,
  at_shot_id text,
  lock_reason text,
  locked_by text,
  evidence_ref text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_continuity_state_locks_entity
  ON continuity_state_locks (project_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_continuity_state_locks_scene
  ON continuity_state_locks (at_scene_id);

CREATE INDEX IF NOT EXISTS idx_continuity_state_locks_active_created
  ON continuity_state_locks (is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS continuity_state_overrides (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  at_scene_id text,
  at_shot_id text,
  override_data jsonb NOT NULL,
  override_reason text,
  override_by text,
  evidence_ref text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_continuity_state_overrides_entity
  ON continuity_state_overrides (project_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_continuity_state_overrides_scene
  ON continuity_state_overrides (at_scene_id);

CREATE INDEX IF NOT EXISTS idx_continuity_state_overrides_created
  ON continuity_state_overrides (created_at DESC);
