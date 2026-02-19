-- repair_and_start_v5.sql

BEGIN;

-- 1. 注册核心引擎 (Ensuring Engines Exist)
INSERT INTO engines (id, "engineKey", name, "organizationId", "createdAt", "updatedAt") 
VALUES ('eng-ce06', 'ce06_novel_parsing', 'CE06 Novel Parsing', 'org-wangu-prod', NOW(), NOW()) 
ON CONFLICT ("engineKey") DO UPDATE SET name = EXCLUDED.name;

INSERT INTO engines (id, "engineKey", name, "organizationId", "createdAt", "updatedAt") 
VALUES ('eng-ce03', 'ce03_visual_density', 'CE03 Visual Density', 'org-wangu-prod', NOW(), NOW()) 
ON CONFLICT ("engineKey") DO UPDATE SET name = EXCLUDED.name;

INSERT INTO engines (id, "engineKey", name, "organizationId", "createdAt", "updatedAt") 
VALUES ('eng-ce04', 'ce04_visual_enrichment', 'CE04 Visual Enrichment', 'org-wangu-prod', NOW(), NOW()) 
ON CONFLICT ("engineKey") DO UPDATE SET name = EXCLUDED.name;

INSERT INTO engines (id, "engineKey", name, "organizationId", "createdAt", "updatedAt") 
VALUES ('eng-real-shot', 'real_shot_render', 'Real Shot Render (SD)', 'org-wangu-prod', NOW(), NOW()) 
ON CONFLICT ("engineKey") DO UPDATE SET name = EXCLUDED.name;

-- 2. 确保项目骨架存在
INSERT INTO projects (id, name, "ownerId", "organizationId", status, "createdAt", "updatedAt") 
VALUES ('wangu_ep1_v5', '萬古神帝 - 第一集 (V5 旗艦)', 'user-wangu-prod', 'org-wangu-prod', 'in_progress', NOW(), NOW()) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO episodes (id, "projectId", index, name) 
VALUES ('ep-wangu_ep1_v5', 'wangu_ep1_v5', 1, '第1章：重生') 
ON CONFLICT (id) DO NOTHING;

INSERT INTO scenes (id, "episodeId", project_id, scene_index, title, created_at, updated_at) 
VALUES ('sc-wangu_ep1_v5', 'ep-wangu_ep1_v5', 'wangu_ep1_v5', 1, '開場', NOW(), NOW()) 
ON CONFLICT (id) DO NOTHING;

INSERT INTO shots (id, "sceneId", "organizationId", index, type) 
VALUES ('sh-wangu_ep1_v5', 'sc-wangu_ep1_v5', 'org-wangu-prod', 1, 'DEFAULT') 
ON CONFLICT (id) DO NOTHING;

-- 3. 注入首个子任务 (CE06 Novel Parsing)
-- 注意：这里使用 DO UPDATE 确保 Payload 最新
INSERT INTO shot_jobs (id, "projectId", "organizationId", "episodeId", "sceneId", "shotId", type, status, priority, payload, "createdAt", "updatedAt", "traceId") 
VALUES (
    'job-ce06-jumpstart-wangu_ep1_v5', 
    'wangu_ep1_v5', 
    'org-wangu-prod', 
    'ep-wangu_ep1_v5', 
    'sc-wangu_ep1_v5', 
    'sh-wangu_ep1_v5', 
    'CE06_NOVEL_PARSING', 
    'PENDING', 
    200, 
    '{"novelSourceId": "n-wangu_ep1_v5", "projectId": "wangu_ep1_v5", "rootJobId": "job-pipe-wangu_ep1_v5", "traceId": "trace_wangu_ep1_v5_20260219_210032", "organizationId": "org-wangu-prod", "episodeId": "ep-wangu_ep1_v5", "sceneId": "sc-wangu_ep1_v5", "shotId": "sh-wangu_ep1_v5"}', 
    NOW(), 
    NOW(), 
    'trace_wangu_ep1_v5_20260219_210032'
) 
ON CONFLICT (id) DO UPDATE SET status = 'PENDING', "updatedAt" = NOW();

-- 4. 绑定引擎 (Correcting the missing engineId issue)
INSERT INTO job_engine_bindings (id, "jobId", "engineId", "engineKey", status, "createdAt", "updatedAt") 
VALUES (
    'bind-ce06-wangu_ep1_v5', 
    'job-ce06-jumpstart-wangu_ep1_v5', 
    'eng-ce06', 
    'ce06_novel_parsing', 
    'BOUND', 
    NOW(), 
    NOW()
) 
ON CONFLICT (id) DO UPDATE SET "engineId" = 'eng-ce06', status = 'BOUND';

COMMIT;
