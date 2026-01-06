-- P0 CE Chain Verification SQL Set
-- Usage: Execute each query in sequence to verify P0 baseline state.

-- Query 1: Verify Full CE Chain Existence (via novelSourceId correlation)
-- Expected: At least 1 completed chain (CE06->CE03->CE04)
SELECT COUNT(DISTINCT ns_id) AS completed_chains
FROM (
  SELECT (payload::json->>'novelSourceId') AS ns_id
  FROM shot_jobs
  WHERE type = 'CE06_NOVEL_PARSING' AND status = 'SUCCEEDED'
    AND (payload::json->>'novelSourceId') IS NOT NULL
) ce06
WHERE EXISTS (
  SELECT 1 FROM shot_jobs ce03
  WHERE ce03.type = 'CE03_VISUAL_DENSITY' AND ce03.status = 'SUCCEEDED'
    AND (ce03.payload::json->>'novelSourceId') = ce06.ns_id
)
AND EXISTS (
  SELECT 1 FROM shot_jobs ce04
  WHERE ce04.type = 'CE04_VISUAL_ENRICHMENT' AND ce04.status = 'SUCCEEDED'
    AND (ce04.payload::json->>'novelSourceId') = ce06.ns_id
);

-- Query 2: Verify SSOT Data Persistence - visual_density_score
-- Expected: >0 rows with valid scores
SELECT COUNT(*) AS scenes_with_density_score
FROM novel_scenes
WHERE visual_density_score IS NOT NULL;

-- Query 3: Verify SSOT Data Persistence - enriched_text
-- Expected: >0 rows with enriched text
SELECT COUNT(*) AS scenes_with_enriched_text
FROM novel_scenes
WHERE enriched_text IS NOT NULL;

-- Query 4: Verify Job-Engine Binding Atomicity
-- Expected: 0 orphan jobs (all SUCCEEDED CE jobs must have bindings)
SELECT COUNT(*) AS orphan_jobs
FROM shot_jobs j
LEFT JOIN job_engine_bindings b ON j.id = b."jobId"
WHERE j.type IN ('CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT')
AND j.status = 'SUCCEEDED'
AND b.id IS NULL;

-- Sample Details: Top 5 Recent Completed CE Jobs
SELECT
  j.id,
  j.type,
  j.status,
  j.payload::json->>'novelSourceId' AS novel_source_id,
  j."createdAt"
FROM shot_jobs j
WHERE j.type IN ('CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT')
  AND j.status = 'SUCCEEDED'
ORDER BY j."createdAt" DESC
LIMIT 5;
