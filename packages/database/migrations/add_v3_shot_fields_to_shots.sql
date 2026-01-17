-- PLAN-2: 补齐 V3.0 Shot 字段到 shots
ALTER TABLE shots
  ADD COLUMN IF NOT EXISTS visual_prompt TEXT,
  ADD COLUMN IF NOT EXISTS negative_prompt TEXT,
  ADD COLUMN IF NOT EXISTS action_description TEXT,
  ADD COLUMN IF NOT EXISTS dialogue_content TEXT,
  ADD COLUMN IF NOT EXISTS sound_fx TEXT,
  ADD COLUMN IF NOT EXISTS asset_bindings JSONB,
  ADD COLUMN IF NOT EXISTS controlnet_settings JSONB,
  ADD COLUMN IF NOT EXISTS duration_sec DECIMAL(4,2);
