-- register_engines.sql
INSERT INTO engines (id, "engineKey", name, "organizationId", "createdAt", "updatedAt") 
VALUES ('eng-ce06', 'ce06_novel_parsing', 'CE06 Novel Parsing', 'org-wangu-prod', NOW(), NOW()) 
ON CONFLICT ("engineKey") DO NOTHING;

INSERT INTO engines (id, "engineKey", name, "organizationId", "createdAt", "updatedAt") 
VALUES ('eng-ce03', 'ce03_visual_density', 'CE03 Visual Density', 'org-wangu-prod', NOW(), NOW()) 
ON CONFLICT ("engineKey") DO NOTHING;

INSERT INTO engines (id, "engineKey", name, "organizationId", "createdAt", "updatedAt") 
VALUES ('eng-ce04', 'ce04_visual_enrichment', 'CE04 Visual Enrichment', 'org-wangu-prod', NOW(), NOW()) 
ON CONFLICT ("engineKey") DO NOTHING;

INSERT INTO engines (id, "engineKey", name, "organizationId", "createdAt", "updatedAt") 
VALUES ('eng-real-shot', 'real_shot_render', 'Real Shot Render (SD)', 'org-wangu-prod', NOW(), NOW()) 
ON CONFLICT ("engineKey") DO NOTHING;
