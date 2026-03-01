-- V3 Contract Views
-- STRICTLY follow Bible V3 Snake Case

-- 1. v3_novels
CREATE OR REPLACE VIEW v3_novels AS
SELECT
    id,
    project_id,
    title,
    author,
    raw_file_url,
    total_tokens,
    status,
    created_at,
    updated_at
FROM novels;

-- 2. v3_novel_chapters
CREATE OR REPLACE VIEW v3_novel_chapters AS
SELECT
    id,
    novel_source_id AS novel_id,
    volume_id,
    index,
    title,
    raw_content,
    created_at
FROM novel_chapters;

-- 3. v3_scenes
CREATE OR REPLACE VIEW v3_scenes AS
SELECT
    id,
    chapter_id,
    scene_index AS index,
    title,
    enriched_text,
    visual_density_score AS visual_density,
    status,
    created_at
FROM scenes;

-- 4. v3_shots
-- Note: sceneId is camelCase in DB, map to scene_id
-- Note: duration_sec is the V3 Decimal field
CREATE OR REPLACE VIEW v3_shots AS
SELECT
    id,
    "sceneId" AS scene_id,
    index,
    shot_type,
    visual_prompt,
    camera_movement,
    duration_sec,
    render_status,
    result_image_url
FROM shots;
