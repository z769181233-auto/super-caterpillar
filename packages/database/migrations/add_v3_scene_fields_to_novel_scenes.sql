-- PLAN-1: 补齐 V3.0 Scene 字段到 novel_scenes
ALTER TABLE novel_scenes
  ADD COLUMN IF NOT EXISTS location_slug TEXT,
  ADD COLUMN IF NOT EXISTS time_of_day TEXT,
  ADD COLUMN IF NOT EXISTS environment_tags TEXT[];

CREATE INDEX IF NOT EXISTS idx_novel_scenes_location_slug ON novel_scenes(location_slug);
CREATE INDEX IF NOT EXISTS idx_novel_scenes_env_tags_gin ON novel_scenes USING gin(environment_tags);
