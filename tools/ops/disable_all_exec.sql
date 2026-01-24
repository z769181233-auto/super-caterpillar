-- DISABLE ALL (EMERGENCY)
UPDATE "projects"
SET "settingsJson" = jsonb_set(
  jsonb_set(
    coalesce("settingsJson", '{}'::jsonb),
    '{ce23RealShadowEnabled}',
    'false'::jsonb,
    true
  ),
  '{ce23RealEnabled}',
  'false'::jsonb,
  true
)
WHERE id IN ('proj_seed_1769264696_19483')
RETURNING id, "settingsJson";
