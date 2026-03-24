-- Append-only planner run evidence for Film IR.
-- P1 minimal scope: do not mutate existing film_ir records, only capture planner executions.

CREATE TABLE IF NOT EXISTS film_ir_runs (
  id uuid PRIMARY KEY,
  scene_id uuid NOT NULL,
  project_id uuid NOT NULL,
  film_ir_id uuid NULL,
  planner_version text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  status text NOT NULL,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot jsonb NULL,
  validation_valid boolean NULL,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text NULL,
  evidence_ref text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_film_ir_runs_scene_created
  ON film_ir_runs (scene_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_film_ir_runs_film_ir
  ON film_ir_runs (film_ir_id);

CREATE INDEX IF NOT EXISTS idx_film_ir_runs_status
  ON film_ir_runs (status);
