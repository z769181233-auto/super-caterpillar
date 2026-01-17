-- rollback_shots_director_control_cols.sql

DROP INDEX IF EXISTS idx_shots_director_controls;

ALTER TABLE shots
  DROP COLUMN IF EXISTS shot_type,
  DROP COLUMN IF EXISTS camera_movement,
  DROP COLUMN IF EXISTS camera_angle,
  DROP COLUMN IF EXISTS lighting_preset;
