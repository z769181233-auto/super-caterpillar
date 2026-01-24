-- APPLYING SHADOW MODE TO ALL PROJECTS (DEV SIMULATION)
UPDATE "projects"
SET "settingsJson" = jsonb_set(
  jsonb_set(
    coalesce("settingsJson", '{}'::jsonb),
    '{ce23RealShadowEnabled}',
    'true'::jsonb,
    true
  ),
  '{ce23RealEnabled}',
  'false'::jsonb,
  true
); -- No WHERE clause for broad dev rollout
