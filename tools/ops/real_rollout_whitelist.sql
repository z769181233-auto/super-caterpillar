-- ENABLE REAL MODE (WHITELIST)
-- Target: proj_seed_1769264696_19483
UPDATE "projects"
SET "settingsJson" = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(coalesce("settingsJson",'{}'::jsonb), '{ce23RealShadowEnabled}', 'true'::jsonb, true),
      '{ce23RealEnabled}', 'true'::jsonb, true
    ),
    '{ce23RealGuardrailEnabled}', 'true'::jsonb, true
  ),
  '{ce23RealThreshold}', '0.80'::jsonb, true
)
WHERE id IN ('proj_seed_1769264696_19483')
RETURNING id, "settingsJson";
