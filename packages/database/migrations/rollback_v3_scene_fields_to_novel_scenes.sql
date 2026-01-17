-- ROLLBACK: 移除 V3.0 Scene 字段
DROP INDEX IF EXISTS idx_novel_scenes_env_tags_gin;
DROP INDEX IF EXISTS idx_novel_scenes_location_slug;

ALTER TABLE novel_scenes
  DROP COLUMN IF EXISTS environment_tags,
  DROP COLUMN IF EXISTS time_of_day,
  DROP COLUMN IF EXISTS location_slug;
