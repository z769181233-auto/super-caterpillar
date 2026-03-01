-- add_shots_director_control_cols.sql
-- V3.0 P1-1: 导演控制字段显式化

ALTER TABLE shots
  ADD COLUMN IF NOT EXISTS shot_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS camera_movement VARCHAR(50),
  ADD COLUMN IF NOT EXISTS camera_angle VARCHAR(50),
  ADD COLUMN IF NOT EXISTS lighting_preset VARCHAR(50);

-- 常用过滤索引
CREATE INDEX IF NOT EXISTS idx_shots_director_controls ON shots(shot_type, camera_movement);
